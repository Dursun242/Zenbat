-- ═══════════════════════════════════════════════════════════════════
-- Garantit que invoices.avoir_of_invoice_id existe.
--
-- La migration 0010_credit_notes.sql ajoutait cette colonne ET créait la
-- fonction create_avoir_from(). Sur certaines instances Supabase (cf.
-- même pattern que 0005/b2b_accounts), la fonction a été créée mais le
-- ALTER TABLE ne s'est pas appliqué — d'où l'erreur runtime :
--   ERROR 42703: record "v_src" has no field "avoir_of_invoice_id"
--
-- Ce patch est idempotent : si la colonne et l'index existent déjà,
-- aucun effet (IF NOT EXISTS).
-- ═══════════════════════════════════════════════════════════════════

alter table public.invoices
  add column if not exists avoir_of_invoice_id uuid
  references public.invoices(id) on delete set null;

create index if not exists invoices_avoir_of_idx
  on public.invoices(avoir_of_invoice_id);
