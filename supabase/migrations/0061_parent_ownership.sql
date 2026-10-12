-- ═══════════════════════════════════════════════════════════════════
-- 0061 — Un enregistrement ne peut pointer que vers les données de son
-- propriétaire. Audit du 2026-10-12.
--
-- Les policies RLS ne vérifiaient que owner_id = auth.uid() sur la ligne
-- écrite, jamais le parent. Un compte gratuit qui connaissait l'id d'un
-- devis (renvoyé par la page publique de signature) pouvait y insérer une
-- ligne « Remise −5 000 € » avec son propre owner_id : elle apparaissait sur
-- la page du client et dans le PDF signé, invisible pour l'artisan.
--
-- 1. Trigger générique : depuis le navigateur (anon / authenticated), le
--    parent référencé (devis, facture, client…) doit appartenir au même
--    owner_id. Le serveur (service_role) n'est pas concerné.
-- 2. Policies d'insertion « with check (true) » fermées sur les journaux
--    écrits uniquement par le serveur (claude_api_logs, newsletter) ;
--    coherence_validations réservé aux comptes connectés. app_logs reste
--    ouvert : le journal d'erreurs du navigateur (index.html) l'utilise
--    avant même la connexion.
-- 3. Champs posés par la signature du client (page publique, serveur) :
--    non modifiables depuis l'application. Un devis « marqué comme signé »
--    à la main ne peut donc pas se faire passer pour une signature
--    électronique du client.
--
-- Idempotente : peut être rejouée sans erreur.
-- ═══════════════════════════════════════════════════════════════════

-- ─── 1. Parent du même propriétaire ─────────────────────────────────
-- Arguments : table parente, colonne de la clé étrangère.
create or replace function public.check_parent_owner()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_parent uuid;
  v_old    uuid;
  v_ok     boolean;
begin
  if current_user not in ('anon', 'authenticated') then
    return new;
  end if;
  v_parent := (to_jsonb(new) ->> tg_argv[1])::uuid;
  if v_parent is null then
    return new;
  end if;
  if tg_op = 'UPDATE' then
    v_old := (to_jsonb(old) ->> tg_argv[1])::uuid;
    if v_old is not distinct from v_parent and old.owner_id is not distinct from new.owner_id then
      return new;
    end if;
  end if;
  execute format('select exists (select 1 from public.%I where id = $1 and owner_id = $2)', tg_argv[0])
     into v_ok
    using v_parent, new.owner_id;
  if not v_ok then
    raise exception 'Accès refusé : % appartient à un autre compte.',
      case tg_argv[0] when 'devis' then 'ce devis' when 'invoices' then 'cette facture'
                      when 'clients' then 'ce client' else tg_argv[0] end
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists t_lignes_devis_parent_owner on public.lignes_devis;
create trigger t_lignes_devis_parent_owner
  before insert or update on public.lignes_devis
  for each row execute function public.check_parent_owner('devis', 'devis_id');

drop trigger if exists t_lignes_invoices_parent_owner on public.lignes_invoices;
create trigger t_lignes_invoices_parent_owner
  before insert or update on public.lignes_invoices
  for each row execute function public.check_parent_owner('invoices', 'invoice_id');

drop trigger if exists t_devis_documents_parent_owner on public.devis_documents;
create trigger t_devis_documents_parent_owner
  before insert or update on public.devis_documents
  for each row execute function public.check_parent_owner('devis', 'devis_id');

drop trigger if exists t_devis_client_owner on public.devis;
create trigger t_devis_client_owner
  before insert or update on public.devis
  for each row execute function public.check_parent_owner('clients', 'client_id');

drop trigger if exists t_devis_root_owner on public.devis;
create trigger t_devis_root_owner
  before insert or update on public.devis
  for each row execute function public.check_parent_owner('devis', 'root_devis_id');

drop trigger if exists t_invoices_client_owner on public.invoices;
create trigger t_invoices_client_owner
  before insert or update on public.invoices
  for each row execute function public.check_parent_owner('clients', 'client_id');

drop trigger if exists t_invoices_devis_owner on public.invoices;
create trigger t_invoices_devis_owner
  before insert or update on public.invoices
  for each row execute function public.check_parent_owner('devis', 'devis_id');

drop trigger if exists t_invoices_avoir_owner on public.invoices;
create trigger t_invoices_avoir_owner
  before insert or update on public.invoices
  for each row execute function public.check_parent_owner('invoices', 'avoir_of_invoice_id');

-- ─── 2. Journaux : écriture réservée au serveur ─────────────────────
-- Le service_role contourne la RLS : sans policy d'insertion, seul le
-- serveur écrit.
drop policy if exists "system insert claude logs" on public.claude_api_logs;
drop policy if exists "public_insert" on public.newsletter_subscribers;

drop policy if exists "anon insert coherence_validations" on public.coherence_validations;
drop policy if exists "authenticated insert coherence_validations" on public.coherence_validations;
create policy "authenticated insert coherence_validations"
  on public.coherence_validations for insert to authenticated
  with check (true);

-- ─── 3. Signature du client : posée par le serveur uniquement ───────
create or replace function public.protect_client_signature_fields()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user not in ('anon', 'authenticated') then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.client_accepted_at    := null;
    new.client_refused_at     := null;
    new.client_refusal_reason := null;
  else
    new.client_accepted_at    := old.client_accepted_at;
    new.client_refused_at     := old.client_refused_at;
    new.client_refusal_reason := old.client_refusal_reason;
  end if;
  return new;
end;
$$;

drop trigger if exists t_devis_protect_client_signature on public.devis;
create trigger t_devis_protect_client_signature
  before insert or update on public.devis
  for each row execute function public.protect_client_signature_fields();

-- ─── Vérifications (à lancer après application) ─────────────────────
--   Depuis l'app (console navigateur, connecté), avec l'id d'un devis d'un autre compte :
--   await supabase.from('lignes_devis').insert({ devis_id: '<autre>', owner_id: '<moi>', designation: 'x' })  -- erreur 42501

-- ─── Tracking ─────────────────────────────────────────────────────────────
insert into public.schema_migrations (version, label, applied_at)
values ('0061', 'parent_ownership', now())
on conflict (version) do nothing;
