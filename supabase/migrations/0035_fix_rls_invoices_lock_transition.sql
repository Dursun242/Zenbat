-- ═══════════════════════════════════════════════════════════════════
-- 0035 — Corrige la transition brouillon → émise bloquée par WITH CHECK
--
-- Bug : depuis la migration 0022, la policy invoices_update_own avait
--   with check (auth.uid() = owner_id and not locked)
-- qui rejette TOUT UPDATE produisant une ligne avec locked=true.
--
-- Or le flux d'émission Factur-X envoie justement statut='envoyee' +
-- locked=true en un seul UPDATE. Séquence Postgres :
--   1. USING filtre la ligne cible (OLD.locked=false → OK)
--   2. BEFORE trigger autolock_invoice_on_emission pose new.locked := true
--   3. WITH CHECK évalué sur NEW post-trigger → not locked = false → REJECT
--
-- Résultat : l'UPDATE échoue silencieusement, la facture reste brouillon
-- en DB. L'UI affichait pourtant "envoyée + verrouillée" via setInvoices,
-- d'où le bug : à la session suivante, listInvoices() relit la DB et
-- ramène le brouillon.
--
-- Fix : retirer `not locked` de WITH CHECK. La sécurité reste intacte :
--   • USING (not locked) empêche déjà tout UPDATE ciblant une ligne
--     déjà verrouillée → impossible de la déverrouiller.
--   • Le trigger autolock_invoice_on_emission (migration 0009) force
--     new.locked := true dès que new.statut quitte 'brouillon', et
--     refuse new.locked=false si old.locked=true.
-- ═══════════════════════════════════════════════════════════════════

drop policy if exists "invoices_update_own" on public.invoices;

create policy "invoices_update_own" on public.invoices
  for update
  using (auth.uid() = owner_id and not locked)
  with check (auth.uid() = owner_id);
