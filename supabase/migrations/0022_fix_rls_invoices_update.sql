-- Corrige la politique RLS invoices_update_own :
-- le WITH CHECK manquait la condition "not locked", permettant théoriquement
-- à un utilisateur de tenter de se déverrouiller une facture via l'API Supabase.
-- Le trigger autolock_invoice_on_emission (migration 0009) reste le premier rempart,
-- mais la RLS doit être cohérente avec la politique de la table.

drop policy if exists "invoices_update_own" on public.invoices;

create policy "invoices_update_own" on public.invoices
  for update
  using (auth.uid() = owner_id and not locked)
  with check (auth.uid() = owner_id and not locked);
