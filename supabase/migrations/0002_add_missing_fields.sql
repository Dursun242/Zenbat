-- =========================================================
-- Zenbat — Champs manquants utilisés par le front
-- =========================================================

-- clients : champs enrichis pour la fiche contact
alter table public.clients
  add column if not exists telephone_fixe text,
  add column if not exists tva_intra       text,
  add column if not exists activite        text;

-- Alignement du check constraint : le front peut émettre 'artisan'
alter table public.clients drop constraint if exists clients_type_check;
alter table public.clients
  add constraint clients_type_check
  check (type in ('entreprise','particulier','artisan'));

-- lignes_devis : taux de TVA par ligne (5.5 / 10 / 20)
alter table public.lignes_devis
  add column if not exists tva_rate numeric(5,2) not null default 20.00;

-- devis : statut 'envoye' déjà dans l'enum, on ajoute juste un index sur updated_at
create index if not exists devis_updated_idx on public.devis(updated_at desc);
