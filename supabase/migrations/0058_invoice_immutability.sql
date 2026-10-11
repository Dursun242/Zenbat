-- ═══════════════════════════════════════════════════════════════════
-- 0058 — Factures émises réellement immuables (CGI art. 289)
-- Audit du 2026-10-11, deuxième série.
--
-- Le verrou de 0009 empêchait seulement de repasser une facture en
-- brouillon. Restaient modifiables après émission :
--   • les lignes (policy lignes_invoices_all_own de 0005 : FOR ALL, sans
--     condition sur la facture) ;
--   • le numéro, les montants, les dates, le client… via le service_role ;
--   • le PDF Factur-X archivé dans Storage (policies update/delete de 0001
--     sur tout le bucket devis-pdfs) ;
--   • et une facture pouvait être insérée directement « émise ».
--
-- 1. Trigger sur lignes_invoices : depuis l'application (anon /
--    authenticated), aucune ligne d'une facture verrouillée ne peut être
--    ajoutée, modifiée ou supprimée.
-- 2. Trigger sur invoices : une fois locked, les champs qui font la facture
--    (numéro, montants, dates, client, TVA…) sont figés pour tout le monde.
--    Restent modifiables : statut de paiement, envoi au client, masquage
--    (deleted_at), qui passent par le service_role.
-- 3. Insertion depuis l'application : toujours en brouillon non verrouillé.
-- 4. Storage : le navigateur ne peut plus écrire ni supprimer dans
--    {user}/invoices/ (archives Factur-X). Seuls /api/facturx et
--    notify-telegram (service_role) y déposent.
--
-- Idempotente : peut être rejouée sans erreur.
-- ═══════════════════════════════════════════════════════════════════

-- ─── 1. Lignes d'une facture verrouillée ────────────────────────────
create or replace function public.protect_locked_invoice_lines()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_ids uuid[];
begin
  if current_user not in ('anon', 'authenticated') then
    return coalesce(new, old);
  end if;
  v_ids := array_remove(array[
    case when tg_op <> 'INSERT' then old.invoice_id end,
    case when tg_op <> 'DELETE' then new.invoice_id end
  ], null);
  if exists (select 1 from public.invoices where id = any(v_ids) and locked) then
    raise exception 'Facture émise : ses lignes ne peuvent plus être modifiées (faites un avoir).'
      using errcode = '42501';
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists t_lignes_invoices_protect_locked on public.lignes_invoices;
create trigger t_lignes_invoices_protect_locked
  before insert or update or delete on public.lignes_invoices
  for each row execute function public.protect_locked_invoice_lines();

-- ─── 2. Champs figés d'une facture verrouillée ──────────────────────
create or replace function public.protect_locked_invoice_fields()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  c text;
  frozen text[] := array[
    'owner_id', 'numero', 'client_id', 'devis_id', 'objet', 'operation_type',
    'invoice_type', 'avoir_of_invoice_id', 'auto_liquidation_btp',
    'montant_ht', 'montant_tva', 'montant_ttc',
    'retenue_garantie_pct', 'retenue_garantie_eur',
    'date_emission', 'date_echeance', 'ville_chantier'
  ];
begin
  if old.locked is not true then
    return new;
  end if;
  foreach c in array frozen loop
    if (to_jsonb(new) -> c) is distinct from (to_jsonb(old) -> c) then
      raise exception 'Facture % émise : le champ % ne peut plus être modifié (faites un avoir).', old.numero, c
        using errcode = '42501';
    end if;
  end loop;
  return new;
end;
$$;

drop trigger if exists t_invoices_protect_locked on public.invoices;
create trigger t_invoices_protect_locked
  before update on public.invoices
  for each row execute function public.protect_locked_invoice_fields();

-- ─── 3. Insertion depuis l'application : brouillon obligatoire ──────
create or replace function public.force_draft_on_invoice_insert()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user in ('anon', 'authenticated') then
    new.statut := 'brouillon';
    new.locked := false;
  end if;
  return new;
end;
$$;

drop trigger if exists t_invoices_force_draft on public.invoices;
create trigger t_invoices_force_draft
  before insert on public.invoices
  for each row execute function public.force_draft_on_invoice_insert();

-- ─── 4. Storage : archives Factur-X réservées au serveur ────────────
-- Le navigateur garde l'accès à ses PDF de devis ({user}/{devis}.pdf).
drop policy if exists "devis_pdf_insert_own" on storage.objects;
create policy "devis_pdf_insert_own" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'devis-pdfs'
    and (storage.foldername(name))[1] = auth.uid()::text
    and coalesce((storage.foldername(name))[2], '') <> 'invoices'
  );

drop policy if exists "devis_pdf_update_own" on storage.objects;
create policy "devis_pdf_update_own" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'devis-pdfs'
    and (storage.foldername(name))[1] = auth.uid()::text
    and coalesce((storage.foldername(name))[2], '') <> 'invoices'
  );

drop policy if exists "devis_pdf_delete_own" on storage.objects;
create policy "devis_pdf_delete_own" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'devis-pdfs'
    and (storage.foldername(name))[1] = auth.uid()::text
    and coalesce((storage.foldername(name))[2], '') <> 'invoices'
  );

-- ─── Vérifications (à lancer après application) ─────────────────────
--   select tgname from pg_trigger
--    where tgname in ('t_lignes_invoices_protect_locked','t_invoices_protect_locked','t_invoices_force_draft');  -- 3 lignes
--   Depuis l'app, sur une facture émise : modifier une ligne → erreur 42501.

-- ─── Tracking ─────────────────────────────────────────────────────────────
insert into public.schema_migrations (version, label, applied_at)
values ('0058', 'invoice_immutability', now())
on conflict (version) do nothing;
