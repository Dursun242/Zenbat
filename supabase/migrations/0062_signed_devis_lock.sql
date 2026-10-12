-- ═══════════════════════════════════════════════════════════════════
-- 0062 — Devis signé : contenu figé, preuve de signature protégée.
-- Audit du 2026-10-12.
--
-- Avant : rien en base n'empêchait de modifier les lignes d'un devis
-- accepté (le verrou n'existait que dans l'écran), ni de repasser un devis
-- signé en ligne par le client à « envoyé » pour le modifier puis le
-- remettre « accepté » : le PDF aurait affiché « Signé électroniquement »
-- sur un contenu que le client n'a pas vu.
--
-- Depuis l'application (anon / authenticated) :
--   1. Les lignes d'un devis accepté, ou signé en ligne par le client
--      (client_accepted_at), ne peuvent plus être ajoutées, modifiées ni
--      supprimées. Pour changer un devis signé : créer un nouvel indice.
--   2. Un devis signé en ligne par le client ne peut plus quitter le statut
--      « accepté », sauf pour être remplacé par un indice (« remplace »).
--      Son objet, son montant et sa TVA sont figés.
--   3. Storage : le dossier {user}/devis-signes/ (PDF signés archivés par
--      /api/devis-public) est réservé au serveur, comme {user}/invoices/.
--
-- Le serveur (service_role) n'est pas concerné.
-- Idempotente : peut être rejouée sans erreur.
-- ═══════════════════════════════════════════════════════════════════

-- ─── 1. Lignes d'un devis signé ─────────────────────────────────────
create or replace function public.protect_signed_devis_lines()
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
    case when tg_op <> 'INSERT' then old.devis_id end,
    case when tg_op <> 'DELETE' then new.devis_id end
  ], null);
  if exists (
    select 1 from public.devis
     where id = any(v_ids)
       and (statut = 'accepte' or client_accepted_at is not null)
  ) then
    raise exception 'Devis signé : ses lignes ne peuvent plus être modifiées (crée un nouvel indice).'
      using errcode = '42501';
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists t_lignes_devis_protect_signed on public.lignes_devis;
create trigger t_lignes_devis_protect_signed
  before insert or update or delete on public.lignes_devis
  for each row execute function public.protect_signed_devis_lines();

-- ─── 2. Devis signé en ligne par le client ──────────────────────────
create or replace function public.protect_esigned_devis()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user not in ('anon', 'authenticated') or old.client_accepted_at is null then
    return new;
  end if;
  if new.statut not in ('accepte', 'remplace') then
    raise exception 'Devis signé par le client : il ne peut plus changer de statut (crée un nouvel indice).'
      using errcode = '42501';
  end if;
  if new.objet is distinct from old.objet
     or new.montant_ht is distinct from old.montant_ht
     or new.tva_rate is distinct from old.tva_rate
     or new.auto_liquidation_btp is distinct from old.auto_liquidation_btp then
    raise exception 'Devis signé par le client : son contenu ne peut plus être modifié (crée un nouvel indice).'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists t_devis_protect_esigned on public.devis;
create trigger t_devis_protect_esigned
  before update on public.devis
  for each row execute function public.protect_esigned_devis();

-- ─── 3. Storage : PDF signés réservés au serveur ────────────────────
drop policy if exists "devis_pdf_insert_own" on storage.objects;
create policy "devis_pdf_insert_own" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'devis-pdfs'
    and (storage.foldername(name))[1] = auth.uid()::text
    and coalesce((storage.foldername(name))[2], '') not in ('invoices', 'devis-signes')
  );

drop policy if exists "devis_pdf_update_own" on storage.objects;
create policy "devis_pdf_update_own" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'devis-pdfs'
    and (storage.foldername(name))[1] = auth.uid()::text
    and coalesce((storage.foldername(name))[2], '') not in ('invoices', 'devis-signes')
  );

drop policy if exists "devis_pdf_delete_own" on storage.objects;
create policy "devis_pdf_delete_own" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'devis-pdfs'
    and (storage.foldername(name))[1] = auth.uid()::text
    and coalesce((storage.foldername(name))[2], '') not in ('invoices', 'devis-signes')
  );

-- ─── Vérifications (à lancer après application) ─────────────────────
--   Depuis l'app (console navigateur, connecté), sur un devis accepté :
--   await supabase.from('lignes_devis').update({ quantite: 99 }).eq('devis_id', '<devis accepté>')  -- erreur 42501

-- ─── Tracking ─────────────────────────────────────────────────────────────
insert into public.schema_migrations (version, label, applied_at)
values ('0062', 'signed_devis_lock', now())
on conflict (version) do nothing;
