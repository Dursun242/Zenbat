-- ═══════════════════════════════════════════════════════════════════
-- 0040 — Retire le schéma hérité Odoo Sign et B2Brouter
--
-- Contexte : les intégrations Odoo Sign et B2Brouter ont été retirées
-- du code (commit 5f0e3cb). Les colonnes et table associées n'étaient
-- plus écrites mais restaient en base. Cette migration les supprime.
--
-- ⚠ DESTRUCTIF : les données contenues dans ces colonnes / cette table
-- seront perdues définitivement. Si vous avez besoin d'archiver un
-- historique de signatures Odoo ou d'envois B2Brouter, exporter AVANT
-- d'appliquer cette migration.
--
-- Objets supprimés :
--   - Table `b2b_accounts` (avec ses 3 policies RLS et son trigger
--     updated_at, droppés par CASCADE)
--   - Colonnes `b2brouter_invoice_id`, `b2brouter_status`,
--     `b2brouter_last_event` sur `invoices` (+ index `invoices_b2b_idx`)
--   - Colonnes `odoo_sign_id`, `odoo_sign_url` sur `devis`
--
-- Conservés volontairement :
--   - `signed_at` et `signed_by` sur `devis` (utilisés par le flux de
--     signature manuelle dans DevisDetail.jsx)
--   - Statut 'en_signature' (utilisé pour les workflows externes)
-- ═══════════════════════════════════════════════════════════════════

begin;

-- 1. Table b2b_accounts : CASCADE droppe les policies et le trigger
drop table if exists public.b2b_accounts cascade;

-- 2. Index B2Brouter sur invoices
drop index if exists public.invoices_b2b_idx;

-- 3. Colonnes B2Brouter sur invoices
alter table public.invoices drop column if exists b2brouter_invoice_id;
alter table public.invoices drop column if exists b2brouter_status;
alter table public.invoices drop column if exists b2brouter_last_event;

-- 4. Colonnes Odoo Sign sur devis
alter table public.devis drop column if exists odoo_sign_id;
alter table public.devis drop column if exists odoo_sign_url;

commit;
