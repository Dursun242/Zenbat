-- ═══════════════════════════════════════════════════════════════════
-- Conformité fiscale / juridique FR
--   • Factures : conservation obligatoire 10 ans (LPF art. L102 B)
--     → pas de hard-delete, soft-delete via deleted_at.
--     → auto-verrou (locked=true) dès que la facture quitte 'brouillon'.
--   • Devis acceptés / en signature = contrats (code civ.) : delete bloqué.
-- ═══════════════════════════════════════════════════════════════════

-- ─── 1. Soft-delete sur invoices ───────────────────────────────────
alter table public.invoices
  add column if not exists deleted_at timestamptz;

create index if not exists invoices_deleted_at_idx
  on public.invoices(deleted_at);

-- Hard-delete autorisé uniquement sur brouillons non verrouillés.
-- Les factures émises sont conservées (soft-delete = update deleted_at).
drop policy if exists "invoices_delete_own" on public.invoices;
create policy "invoices_delete_own" on public.invoices
  for delete using (
    auth.uid() = owner_id
    and not locked
    and statut = 'brouillon'
  );

-- ─── 2. Trigger d'auto-verrou sur invoices ─────────────────────────
-- Règle fiscale : une facture émise est immuable (CGI art. 289).
-- Dès que le statut quitte 'brouillon' pour un statut définitif,
-- on verrouille automatiquement. On ne déverrouille JAMAIS.
create or replace function public.autolock_invoice_on_emission()
returns trigger
language plpgsql
as $$
begin
  -- Une facture émise ne redevient jamais 'brouillon'.
  if old.statut <> 'brouillon' and new.statut = 'brouillon' then
    new.statut := old.statut;
  end if;

  -- Dès qu'on quitte 'brouillon', verrou activé, pour toujours.
  if new.statut <> 'brouillon' then
    new.locked := true;
  end if;

  -- Un verrou, une fois posé, ne se retire pas.
  if old.locked is true then
    new.locked := true;
  end if;

  return new;
end;
$$;

drop trigger if exists t_invoices_autolock on public.invoices;
create trigger t_invoices_autolock
  before update on public.invoices
  for each row execute function public.autolock_invoice_on_emission();

-- ─── 3. Soft-delete sur devis ──────────────────────────────────────
alter table public.devis
  add column if not exists deleted_at timestamptz;

create index if not exists devis_deleted_at_idx
  on public.devis(deleted_at);

-- Delete bloqué sur les statuts "engageants" (contrats).
-- 'brouillon' et 'refuse' restent supprimables — pas de valeur juridique.
drop policy if exists "devis_delete_own" on public.devis;
create policy "devis_delete_own" on public.devis
  for delete using (
    auth.uid() = owner_id
    and statut in ('brouillon', 'refuse')
  );

-- ─── 4. Soft-delete sur lignes_invoices (même règle que parent) ────
alter table public.lignes_invoices
  add column if not exists deleted_at timestamptz;

-- Pas de policy DELETE user-facing sur les lignes : elles sont toujours
-- manipulées via la facture (update parent), sauf cascade.

-- ─── 5. Fonction helper : soft-delete d'une facture ────────────────
-- Exposée côté client pour éviter les updates manuels incohérents.
create or replace function public.soft_delete_invoice(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- RLS appliquée via auth.uid() dans le WHERE
  update public.invoices
     set deleted_at = now()
   where id = p_id
     and owner_id = auth.uid()
     and statut = 'brouillon'
     and not locked;
  if not found then
    raise exception 'Cette facture ne peut pas être supprimée (émise ou verrouillée).';
  end if;
end;
$$;

revoke all on function public.soft_delete_invoice(uuid) from public;
grant execute on function public.soft_delete_invoice(uuid) to authenticated;

-- ─── 6. Fonction helper : soft-delete d'un devis "engageant" ───────
-- (hors 'brouillon' et 'refuse' où le hard-delete reste possible).
create or replace function public.soft_delete_devis(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_statut text;
begin
  select statut into v_statut
    from public.devis
   where id = p_id and owner_id = auth.uid();

  if v_statut is null then
    raise exception 'Devis introuvable.';
  end if;

  if v_statut in ('accepte', 'en_signature') then
    raise exception 'Un devis % ne peut pas être supprimé (contrat en cours).', v_statut;
  end if;

  update public.devis
     set deleted_at = now()
   where id = p_id and owner_id = auth.uid();
end;
$$;

revoke all on function public.soft_delete_devis(uuid) from public;
grant execute on function public.soft_delete_devis(uuid) to authenticated;
