# Banc de test Agent IA

Script qui rejoue ~110 prompts d'artisans contre l'API Anthropic en utilisant
le **même** `system` prompt que `AgentIA.jsx` (via `buildSystemPrompt`),
puis sort un CSV + un JSON pour analyse.

## Lancer

```bash
ANTHROPIC_KEY=sk-ant-xxx npm run test:agent
```

Options :

```bash
node scripts/test-agent.mjs --limit 20            # 20 premiers prompts
node scripts/test-agent.mjs --concurrency 5       # 5 requêtes en parallèle
node scripts/test-agent.mjs --sector btp          # uniquement BTP
node scripts/test-agent.mjs --kind T2             # uniquement TYPE 2
node scripts/test-agent.mjs --model claude-sonnet-4-6
```

## Sorties

- `scripts/agent-test-data/agent-test-<timestamp>.csv` — une ligne par prompt
  avec : `has_devis`, `parse_ok`, `n_lines`, `total_ht`, `null_price_lines`,
  `is_refusal`, `asked_question_first`, tokens entrée/sortie, durée.
- `scripts/agent-test-data/agent-test-<timestamp>.json` — détail complet
  avec le texte brut de chaque réponse (pour relire à la main).

Les sorties sont gitignored.

## Métriques surveillées

| Métrique | Comportement attendu |
|----------|---------------------|
| `has_devis` | ≈100% sauf cas adversariaux (ADV) |
| `parse_ok` | 100% des `has_devis` |
| `asked_question_first` | <5% (la règle N°1 interdit la liste de questions) |
| `null_price_lines` | 0 sur ouvrages (RÈGLE ABSOLUE SUR LES PRIX) |
| `n_lines` (T1) | 1 |
| `n_lines` (T3) | ≥4 ouvrages, ≥2 lots |

## Coût estimé

Système ≈20k chars (5k tokens), réponse ≈1-2k tokens. Avec
prompt-caching côté frontend mais **pas** dans ce script
(simplicité), compter ~150-200k tokens en entrée et ~100-150k
en sortie pour un run complet.
