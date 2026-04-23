-- ═══════════════════════════════════════════════════════════════════
-- Conformité : factures d'avoir (correction d'une facture émise)
-- CGI art. 289 : une facture émise est immuable. Toute correction
-- passe obligatoirement par un avoir référençant la facture initiale.
-- ═══════════════════════════════════════════════════════════════════

alter table public.invoices
  add column if not exists avoir_of_invoice_id uuid
  references public.invoices(id) on delete set null;

create index if not exists invoices_avoir_of_idx
  on public.invoices(avoir_of_invoice_id);

-- Crée un avoir (brouillon) à partir d'une facture émise. L'avoir :
--   • récupère client, lignes et champs métier de la facture d'origine,
--   • garde une référence à l'original (avoir_of_invoice_id),
--   • part en statut 'brouillon' non verrouillé pour ajustement,
--   • reçoit un numéro via next_invoice_number() (continuité chrono.).
-- Les montants sont laissés positifs : le caractère "avoir" est déterminé
-- par avoir_of_invoice_id IS NOT NULL. L'utilisateur peut ensuite ajuster
-- les quantités avant émission ; la génération Factur-X positionnera
-- le code de type de document (381 = credit note) côté client.
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
    raise exception 'Impossible de créer un avoir sur une facture supprimée.';
  end if;
  if v_src.avoir_of_invoice_id is not null then
    raise exception 'Un avoir ne peut pas servir de base à un autre avoir.';
  end if;

  v_numero := public.next_invoice_number(extract(year from now())::int);

  insert into public.invoices (
    owner_id, client_id, numero, objet, operation_type,
    statut, locked,
    montant_ht, montant_tva, montant_ttc,
    retenue_garantie_pct, retenue_garantie_eur,
    date_emission, date_echeance,
    ville_chantier, notes,
    avoir_of_invoice_id
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
    v_src.id
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
  where l.invoice_id = p_invoice_id;

  return v_new_id;
end;
$$;

revoke all on function public.create_avoir_from(uuid) from public;
grant execute on function public.create_avoir_from(uuid) to authenticated;
