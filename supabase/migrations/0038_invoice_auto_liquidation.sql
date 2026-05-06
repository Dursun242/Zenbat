-- 0038_invoice_auto_liquidation.sql
-- Ajoute le flag auto_liquidation_btp aux factures + devis pour gérer
-- l'autoliquidation TVA (sous-traitance BTP, art. 283-2 nonies CGI).
-- Quand le flag est à true :
--   • TVA forcée à 0 sur toutes les lignes
--   • mention obligatoire affichée sur le PDF / Factur-X
--
-- Met à jour create_avoir_from() pour propager le flag à l'avoir.
--
-- À appliquer manuellement dans le SQL Editor Supabase (cf. CLAUDE.md).

alter table public.invoices
  add column if not exists auto_liquidation_btp boolean not null default false;

alter table public.devis
  add column if not exists auto_liquidation_btp boolean not null default false;

-- Réécriture de create_avoir_from() pour inclure le nouveau champ.
-- (Définition complète recopiée à l'identique de 0010 + ajout du champ.)
create or replace function public.create_avoir_from(p_invoice_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_src     public.invoices%rowtype;
  v_new_id  uuid;
  v_numero  text;
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

  v_numero := public.next_invoice_number(extract(year from now())::int);

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
    v_src.owner_id, v_src.client_id, v_numero,
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

  -- Copie des lignes (mêmes quantités ; l'utilisateur ajustera si besoin)
  insert into public.lignes_invoices (
    invoice_id, owner_id, position, type_ligne,
    lot, designation, unite, quantite, prix_unitaire, tva_rate
  )
  select
    v_new_id, l.owner_id, l.position, l.type_ligne,
    l.lot, l.designation, l.unite,
    l.quantite, l.prix_unitaire, l.tva_rate
  from public.lignes_invoices l
  where l.invoice_id = v_src.id;

  return v_new_id;
end;
$$;
