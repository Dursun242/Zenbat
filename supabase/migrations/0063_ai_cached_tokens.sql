-- 0063 — Suivi du cache de prompt IA
--
-- Mistral met en cache le début du prompt quand il est identique d'une
-- requête à l'autre et facture ces tokens 10 % du prix d'entrée normal.
-- Le prompt de l'agent devis a été réordonné pour que ~85 % soit commun à
-- tous les artisans (cf src/lib/agentIA/prompt.js).
--
-- cached_input_tokens = part de input_tokens servie depuis le cache
-- (Mistral : usage.prompt_tokens_details.cached_tokens, déjà comptée dans
-- input_tokens). 0 = pas de cache ou fournisseur Anthropic.
--
-- Sans cette migration, api/claude.js retente l'insertion sans la colonne et
-- api/admin-stats.js relit sans elle : rien ne casse, on perd juste la mesure.
--
-- Diagnostic (taux de cache sur 7 jours, agent devis) :
--   select count(*) as appels,
--          sum(input_tokens) as entree,
--          sum(cached_input_tokens) as dont_cache,
--          round(100.0 * sum(cached_input_tokens) / nullif(sum(input_tokens), 0), 1) as pct_cache
--   from public.claude_api_logs
--   where use_case = 'devis' and created_at > now() - interval '7 days';

alter table public.claude_api_logs
  add column if not exists cached_input_tokens integer not null default 0;

-- ─── Tracking ─────────────────────────────────────────────────────────────
insert into public.schema_migrations (version, label, applied_at)
values ('0063', 'ai_cached_tokens', now())
on conflict (version) do nothing;
