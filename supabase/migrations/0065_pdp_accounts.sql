-- ═══════════════════════════════════════════════════════════════════
-- 0065 — Super PDP (plateforme agréée) : compte relié par artisan
--
-- Étape 1 de l'intégration (cf. api/_pdp.js, docs/superpdp/REPRISE.md) :
-- chaque artisan relie son propre compte Super PDP (OAuth « authorization
-- code » + PKCE) pour recevoir ses factures fournisseurs.
--
-- pdp_accounts      : un compte relié par utilisateur. Jetons chiffrés
--                     (AES-256-GCM, clé PDP_TOKEN_KEY côté Vercel) ;
--                     token_version sert de verrou optimiste quand le
--                     refresh token tourne.
-- pdp_oauth_states  : `state` à usage unique + code_verifier PKCE entre le
--                     clic « Connecter » et le retour de Super PDP (15 min).
--
-- Les deux tables sont réservées au serveur (service_role) : RLS activée
-- sans aucune policy, droits retirés à anon / authenticated. L'app lit le
-- statut de connexion via /api/facturx (action pdp_status).
--
-- Remplace la migration 0039_pdp_accounts de la branche
-- claude/integrate-superdpd-ZpSGG (jamais appliquée, compte partagé v0).
-- ═══════════════════════════════════════════════════════════════════

create table if not exists public.pdp_accounts (
  user_id             uuid primary key references auth.users(id) on delete cascade,
  pdp_company_id      bigint,
  siren               text,
  company_name        text,
  env                 text,          -- 'sandbox' | 'production' (companies/me)
  verification_status text,          -- 'verified' | 'needs_review' | 'failed'
  access_token_enc    text,
  refresh_token_enc   text not null,
  token_expires_at    timestamptz,
  token_version       integer not null default 0,
  connected_at        timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create table if not exists public.pdp_oauth_states (
  state         text primary key,
  user_id       uuid not null references auth.users(id) on delete cascade,
  code_verifier text not null,
  created_at    timestamptz not null default now()
);
create index if not exists pdp_oauth_states_user_idx on public.pdp_oauth_states(user_id);

alter table public.pdp_accounts     enable row level security;
alter table public.pdp_oauth_states enable row level security;
revoke all on public.pdp_accounts     from anon, authenticated;
revoke all on public.pdp_oauth_states from anon, authenticated;

-- ─── Vérification ─────────────────────────────────────────────────────────
--   select relname, relrowsecurity from pg_class
--    where relname in ('pdp_accounts', 'pdp_oauth_states');   -- true, true

-- ─── Tracking ─────────────────────────────────────────────────────────────
insert into public.schema_migrations (version, label, applied_at)
values ('0065', 'pdp_accounts', now())
on conflict (version) do nothing;
