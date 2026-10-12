-- ═══════════════════════════════════════════════════════════════════
-- 0060 — Numéro de facture attribué à l'émission (CGI art. 242 nonies A)
-- Audit du 2026-10-12.
--
-- Avant : le numéro était pris dès la création du brouillon (max + 1).
--   • un brouillon supprimé laissait un trou dans la séquence, ou son
--     numéro était repris par le brouillon suivant ;
--   • deux brouillons émis dans le désordre donnaient des numéros qui ne
--     suivaient pas l'ordre des dates ;
--   • la date d'émission restait celle du brouillon ;
--   • le navigateur pouvait choisir son propre numéro.
--
-- Après :
--   1. Un brouillon n'a pas de numéro (numero NULL). L'application affiche
--      « Brouillon ».
--   2. Le numéro définitif et la date du jour sont posés par le serveur, au
--      moment de l'émission, par emit_invoice() : sous verrou par artisan,
--      dans la même transaction que le verrouillage de la facture. Pas de
--      trou, pas de doublon, numéros dans l'ordre chronologique.
--   3. Depuis le navigateur (anon / authenticated), le numéro ne peut être
--      ni posé ni modifié, et une facture ne peut pas être émise
--      directement : l'émission passe par /api/facturx (action « emit »).
--   4. facturx_archived_at : date du premier Factur-X archivé. Tant qu'elle
--      est vide, /api/facturx peut remplacer le PDF de travail déposé par
--      notify-telegram ; ensuite l'archive n'est plus jamais écrasée.
--
-- Les brouillons existants perdent leur numéro provisoire : ils recevront
-- le numéro suivant à leur émission. Les factures émises ne changent pas.
--
-- Idempotente : peut être rejouée sans erreur.
-- ═══════════════════════════════════════════════════════════════════

-- ─── 1. Colonnes ────────────────────────────────────────────────────
alter table public.invoices alter column numero drop not null;

alter table public.invoices
  add column if not exists facturx_archived_at timestamptz;

-- Brouillons existants : plus de numéro provisoire.
update public.invoices
   set numero = null
 where locked is not true
   and statut = 'brouillon'
   and numero is not null;

-- Une facture émise a toujours un numéro.
alter table public.invoices drop constraint if exists invoices_numero_if_locked;
alter table public.invoices
  add constraint invoices_numero_if_locked check (locked is not true or numero is not null);

-- ─── 2. Le navigateur ne touche ni au numéro ni à l'émission ───────
create or replace function public.protect_invoice_numbering()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user not in ('anon', 'authenticated') then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.numero := null;
    new.facturx_archived_at := null;
    return new;
  end if;
  -- UPDATE : le numéro et l'archivage restent ceux de la base.
  new.numero := old.numero;
  new.facturx_archived_at := old.facturx_archived_at;
  if old.locked is not true and (new.locked is true or new.statut <> 'brouillon') then
    raise exception 'L''émission d''une facture passe par le serveur (numéro attribué à l''émission).'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists t_invoices_numbering on public.invoices;
create trigger t_invoices_numbering
  before insert or update on public.invoices
  for each row execute function public.protect_invoice_numbering();

-- ─── 3. Émission : numéro + date + verrou, en une transaction ───────
-- Appelée par /api/facturx (service_role) après contrôle du propriétaire.
-- Les montants sont calculés par le serveur depuis les lignes en base
-- (src/lib/invoiceCalc.js, seul calcul des montants) et passés ici.
-- Idempotente : une facture déjà émise renvoie son numéro sans changement.
create or replace function public.emit_invoice(
  p_invoice_id uuid,
  p_owner_id   uuid,
  p_ht         numeric,
  p_tva        numeric,
  p_ttc        numeric
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v       public.invoices%rowtype;
  v_today date;
  v_year  int;
  v_seq   int;
  v_num   text;
  v_due   date;
begin
  select * into v
    from public.invoices
   where id = p_invoice_id and owner_id = p_owner_id
   for update;
  if not found then
    raise exception 'Facture introuvable ou accès refusé.' using errcode = 'P0002';
  end if;
  if v.deleted_at is not null then
    raise exception 'Cette facture a été supprimée.' using errcode = 'P0001';
  end if;

  if v.locked is true then
    return jsonb_build_object(
      'numero', v.numero, 'date_emission', v.date_emission, 'date_echeance', v.date_echeance,
      'statut', v.statut, 'locked', true, 'already', true);
  end if;
  if v.statut <> 'brouillon' then
    raise exception 'Seul un brouillon peut être émis.' using errcode = 'P0001';
  end if;

  -- Un seul numéro attribué à la fois par artisan.
  perform pg_advisory_xact_lock(hashtextextended('zenbat:invoice_numbering:' || p_owner_id::text, 0));

  v_today := (now() at time zone 'Europe/Paris')::date;
  v_year  := extract(year from v_today)::int;

  -- Factures masquées (deleted_at) comprises : leur numéro reste pris.
  select coalesce(max(substring(i.numero from '^FAC-\d{4}-(\d+)$')::int), 0) + 1
    into v_seq
    from public.invoices i
   where i.owner_id = p_owner_id
     and i.numero like 'FAC-' || v_year || '-%';

  v_num := 'FAC-' || v_year || '-' ||
           case when v_seq < 10000 then lpad(v_seq::text, 4, '0') else v_seq::text end;

  -- L'échéance garde le même délai, compté depuis la date d'émission.
  v_due := case
    when v.date_echeance is not null and v.date_emission is not null and v.date_echeance >= v.date_emission
      then v_today + (v.date_echeance - v.date_emission)
    else v.date_echeance
  end;

  update public.invoices
     set numero        = v_num,
         date_emission = v_today,
         date_echeance = v_due,
         statut        = 'envoyee',
         locked        = true,
         montant_ht    = p_ht,
         montant_tva   = p_tva,
         montant_ttc   = p_ttc
   where id = p_invoice_id;

  return jsonb_build_object(
    'numero', v_num, 'date_emission', v_today, 'date_echeance', v_due,
    'statut', 'envoyee', 'locked', true, 'already', false);
end;
$$;

revoke all on function public.emit_invoice(uuid, uuid, numeric, numeric, numeric) from public;
revoke all on function public.emit_invoice(uuid, uuid, numeric, numeric, numeric) from anon, authenticated;
grant execute on function public.emit_invoice(uuid, uuid, numeric, numeric, numeric) to service_role;

-- ─── 4. next_invoice_number : aperçu du prochain numéro ─────────────
-- Ne réserve rien. Les anciennes versions de l'application l'appellent
-- encore à la création d'un brouillon : le trigger du point 2 efface ce
-- numéro à l'insertion.
create or replace function public.next_invoice_number(p_year int default null)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_year int := coalesce(p_year, extract(year from (now() at time zone 'Europe/Paris'))::int);
  v_seq  int;
begin
  select coalesce(max(substring(numero from '^FAC-\d{4}-(\d+)$')::int), 0) + 1
    into v_seq
    from public.invoices
   where owner_id = auth.uid()
     and numero like 'FAC-' || v_year || '-%';
  return 'FAC-' || v_year || '-' ||
         case when v_seq < 10000 then lpad(v_seq::text, 4, '0') else v_seq::text end;
end;
$$;

revoke all on function public.next_invoice_number(int) from public;
grant execute on function public.next_invoice_number(int) to authenticated;

-- ─── 5. Avoir : créé en brouillon, sans numéro ──────────────────────
-- Reprise de 0057 ; seul le numéro change (NULL jusqu'à l'émission).
create or replace function public.create_avoir_from(p_invoice_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_src     public.invoices%rowtype;
  v_new_id  uuid;
begin
  select * into v_src
    from public.invoices
   where id = p_invoice_id and owner_id = auth.uid();
  if not found then
    raise exception 'Facture introuvable ou accès refusé.';
  end if;

  if v_src.deleted_at is not null then
    raise exception 'Cette facture a été supprimée.';
  end if;
  if v_src.avoir_of_invoice_id is not null then
    raise exception 'On ne peut pas créer un avoir à partir d''un avoir.';
  end if;
  if v_src.locked is not true then
    raise exception 'Un avoir se fait sur une facture émise.';
  end if;

  insert into public.invoices (
    owner_id, client_id, numero, objet, operation_type,
    statut, locked,
    montant_ht, montant_tva, montant_ttc,
    retenue_garantie_pct, retenue_garantie_eur,
    date_emission, date_echeance,
    ville_chantier, notes,
    avoir_of_invoice_id,
    auto_liquidation_btp
  ) values (
    v_src.owner_id, v_src.client_id, null,
    'Avoir sur ' || v_src.numero || coalesce(' — ' || v_src.objet, ''),
    v_src.operation_type,
    'brouillon', false,
    v_src.montant_ht, v_src.montant_tva, v_src.montant_ttc,
    v_src.retenue_garantie_pct, v_src.retenue_garantie_eur,
    current_date, null,
    v_src.ville_chantier,
    'Avoir émis en rectification de la facture ' || v_src.numero || '.',
    v_src.id,
    v_src.auto_liquidation_btp
  )
  returning id into v_new_id;

  insert into public.lignes_invoices (
    invoice_id, owner_id, position, type_ligne,
    lot, designation, unite, quantite, prix_unitaire, tva_rate
  )
  select
    v_new_id, l.owner_id, l.position, l.type_ligne,
    l.lot, l.designation, l.unite,
    l.quantite, l.prix_unitaire, l.tva_rate
  from public.lignes_invoices l
  where l.invoice_id = v_src.id
    and l.deleted_at is null;

  return v_new_id;
end;
$$;

-- ─── Vérifications (à lancer après application) ─────────────────────
--   select count(*) from public.invoices where locked is not true and numero is not null;  -- 0
--   select has_function_privilege('authenticated', 'public.emit_invoice(uuid,uuid,numeric,numeric,numeric)', 'execute');  -- false
--   Depuis l'app (console navigateur, connecté) :
--   await supabase.from('invoices').update({ statut: 'envoyee' }).eq('id', '<brouillon>')  -- erreur 42501

-- ─── Tracking ─────────────────────────────────────────────────────────────
insert into public.schema_migrations (version, label, applied_at)
values ('0060', 'invoice_numbering_at_emission', now())
on conflict (version) do nothing;
