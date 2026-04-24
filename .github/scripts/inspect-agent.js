#!/usr/bin/env node
/**
 * inspect-agent.js — Agent autonome d'inspection des logs d'erreur
 *
 * Utilisation : node .github/scripts/inspect-agent.js
 * Variables requises : SUPABASE_URL, SUPABASE_SERVICE_KEY, ANTHROPIC_API_KEY
 *
 * Ce script :
 *  1. Lit les logs non résolus (6 dernières heures) dans Supabase
 *  2. Déduplique et groupe par message
 *  3. Lit index.html
 *  4. Appelle Claude pour analyser et proposer des correctifs
 *  5. Applique les correctifs dans index.html (backup .bak avant tout patch)
 *  6. Écrit RAPPORT_BUGS.md
 *  7. Marque les logs inspectés resolved=true
 *  8. Git commit + push si des corrections ont été appliquées
 */

import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../..');

const SUPABASE_URL       = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const ANTHROPIC_API_KEY  = process.env.ANTHROPIC_API_KEY;

const LOOKBACK_HOURS  = 6;
const INDEX_HTML_PATH = path.join(REPO_ROOT, 'index.html');
const INDEX_HTML_BAK  = path.join(REPO_ROOT, 'index.html.bak');
const RAPPORT_PATH    = path.join(REPO_ROOT, 'RAPPORT_BUGS.md');

// Validation des variables d'environnement
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !ANTHROPIC_API_KEY) {
  console.error('❌ Variables manquantes : SUPABASE_URL, SUPABASE_SERVICE_KEY, ANTHROPIC_API_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

// ─── Helpers ───────────────────────────────────────────────────────────────

function execSafe(cmd, label) {
  try {
    execSync(cmd, { stdio: 'inherit', cwd: REPO_ROOT });
    return true;
  } catch (e) {
    console.warn(`⚠️ ${label} échoué :`, e.message);
    return false;
  }
}

function extractJson(text) {
  // Essaie d'extraire le JSON brut ou depuis un bloc ```json
  const blockMatch = text.match(/```(?:json)?\n?([\s\S]*?)\n?```/);
  const raw = blockMatch ? blockMatch[1] : text;
  return JSON.parse(raw);
}

// ─── Main ──────────────────────────────────────────────────────────────────

async function main() {
  // 1. Lecture des logs non résolus des 6 dernières heures
  const since = new Date(Date.now() - LOOKBACK_HOURS * 3600 * 1000).toISOString();
  console.log(`🔍 Lecture des logs Supabase depuis ${since}…`);

  const { data: logs, error: logsError } = await supabase
    .from('app_logs')
    .select('*')
    .eq('resolved', false)
    .gte('created_at', since)
    .order('created_at', { ascending: false });

  if (logsError) {
    console.error('❌ Erreur Supabase :', logsError.message);
    process.exit(1);
  }

  // 2. Aucun log → exit propre
  if (!logs || logs.length === 0) {
    console.log('✅ Aucune erreur détectée dans les dernières 6h.');
    process.exit(0);
  }

  console.log(`📊 ${logs.length} log(s) trouvé(s).`);

  // 3. Déduplication / groupement par message
  const groups = {};
  for (const log of logs) {
    const key = log.message.slice(0, 120);
    if (!groups[key]) groups[key] = { ...log, count: 0, ids: [] };
    groups[key].count++;
    groups[key].ids.push(log.id);
  }

  const allIds  = logs.map(l => l.id);
  const summary = Object.values(groups).map(g => ({
    message:     g.message,
    level:       g.level,
    count:       g.count,
    stack:       g.stack,
    context:     g.context,
    first_seen:  g.created_at,
  }));

  console.log(`🗂️  ${summary.length} erreur(s) unique(s) après déduplication.`);

  // 4. Lecture de index.html
  let htmlSource;
  try {
    htmlSource = fs.readFileSync(INDEX_HTML_PATH, 'utf-8');
  } catch (e) {
    console.error('❌ Impossible de lire index.html :', e.message);
    process.exit(1);
  }

  // 5. Appel Claude
  console.log('🤖 Appel Claude pour analyse des erreurs…');

  const prompt = `Tu es un expert en débogage d'applications web PWA (Vite + React + Supabase).

## Erreurs détectées — ${summary.length} uniques, ${logs.length} occurrences totales

\`\`\`json
${JSON.stringify(summary, null, 2)}
\`\`\`

## Code source index.html

\`\`\`html
${htmlSource}
\`\`\`

Analyse ces erreurs. Identifie leur cause racine dans le code de index.html.
Propose les corrections exactes si elles concernent ce fichier.

Réponds UNIQUEMENT en JSON valide, sans texte autour :
{
  "rapport": "Description détaillée du problème et de la cause racine",
  "corrections": [
    {
      "recherche": "texte exact et unique à rechercher dans index.html",
      "remplacement": "texte de remplacement complet"
    }
  ]
}

Si les erreurs sont réseau, utilisateur, ou hors index.html : retourne "corrections": [].`;

  let claudeResponse;
  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    });
    const rawText = response.content[0]?.type === 'text' ? response.content[0].text : '{}';
    claudeResponse = extractJson(rawText);
  } catch (e) {
    console.error('❌ Erreur Claude :', e.message);
    // On continue sans corrections pour quand même marquer resolved et écrire le rapport
    claudeResponse = { rapport: `Erreur lors de l'appel Claude : ${e.message}`, corrections: [] };
  }

  console.log('📋 Rapport Claude reçu.');

  const corrections = Array.isArray(claudeResponse.corrections) ? claudeResponse.corrections : [];
  const applied = [];
  const failed  = [];
  let patchApplied = false;

  // 6. Application des correctifs
  if (corrections.length > 0) {
    // 7. Backup index.html avant tout patch
    try {
      fs.copyFileSync(INDEX_HTML_PATH, INDEX_HTML_BAK);
      console.log('💾 Backup créé : index.html.bak');
    } catch (e) {
      console.error('❌ Impossible de créer le backup :', e.message);
      process.exit(1);
    }

    let html = htmlSource;

    for (const correction of corrections) {
      try {
        if (!correction.recherche || !html.includes(correction.recherche)) {
          console.warn(`⚠️  Correction non trouvée : "${String(correction.recherche).slice(0, 60)}…"`);
          failed.push(correction);
          continue;
        }
        // Remplacement de la première occurrence unique
        html = html.replace(correction.recherche, correction.remplacement);
        applied.push(correction);
        console.log(`✅ Correction appliquée : "${String(correction.recherche).slice(0, 60)}…"`);
      } catch (e) {
        console.warn('⚠️  Erreur lors du patch :', e.message);
        failed.push(correction);
      }
    }

    if (applied.length > 0) {
      try {
        fs.writeFileSync(INDEX_HTML_PATH, html, 'utf-8');
        patchApplied = true;
        console.log(`✅ ${applied.length} correction(s) écrite(s) dans index.html.`);
      } catch (e) {
        // 8. Restauration du backup si l'écriture échoue
        console.error('❌ Échec écriture — restauration du backup…');
        try { fs.copyFileSync(INDEX_HTML_BAK, INDEX_HTML_PATH); } catch (_) {}
        process.exit(1);
      }
    }
  }

  // 9. Écriture de RAPPORT_BUGS.md
  const timestamp = new Date().toISOString();
  const erreursMd = summary.map(e =>
    `### [${e.level.toUpperCase()}] ${e.message.slice(0, 120)}\n` +
    `- **Occurrences** : ${e.count}\n` +
    `- **Première détection** : ${e.first_seen}\n` +
    (e.stack ? `- **Stack** :\n\`\`\`\n${e.stack.slice(0, 800)}\n\`\`\`` : '')
  ).join('\n\n');

  const correctionsMd = applied.length === 0
    ? '_Aucune correction automatique appliquée._'
    : applied.map((c, i) =>
        `### Correction ${i + 1}\n**Recherche :**\n\`\`\`\n${c.recherche}\n\`\`\`\n**Remplacement :**\n\`\`\`\n${c.remplacement}\n\`\`\``
      ).join('\n\n');

  const rapport = `# Rapport d'inspection automatique

**Généré le** : ${timestamp}
**Logs analysés** : ${logs.length} occurrences, ${summary.length} erreurs uniques
**Corrections appliquées** : ${applied.length}

## Analyse

${claudeResponse.rapport}

## Erreurs détectées

${erreursMd}

## Corrections

${correctionsMd}
`;

  try {
    fs.writeFileSync(RAPPORT_PATH, rapport, 'utf-8');
    console.log('📄 RAPPORT_BUGS.md écrit.');
  } catch (e) {
    console.warn('⚠️  Impossible d\'écrire RAPPORT_BUGS.md :', e.message);
  }

  // 10. Marquage resolved=true dans Supabase
  if (allIds.length > 0) {
    const { error: updateError } = await supabase
      .from('app_logs')
      .update({ resolved: true })
      .in('id', allIds);

    if (updateError) {
      console.warn('⚠️  Erreur lors du marquage resolved :', updateError.message);
    } else {
      console.log(`✅ ${allIds.length} log(s) marqué(s) resolved=true.`);
    }
  }

  // 11. Git commit + push si des corrections ont été appliquées
  if (patchApplied) {
    const date = new Date().toISOString().slice(0, 16).replace('T', ' ');
    execSafe('git add RAPPORT_BUGS.md index.html', 'git add');
    execSafe(
      `git commit -m "🤖 Auto-fix ${date} — ${applied.length} correction(s), ${summary.length} erreur(s)"`,
      'git commit'
    );
    execSafe('git push', 'git push');
    console.log('🚀 Commit et push effectués.');
  } else {
    // Commit du rapport seul (sans patch) si des erreurs ont été analysées
    execSafe('git add RAPPORT_BUGS.md', 'git add rapport');
    execSafe(
      `git diff --staged --quiet || git commit -m "📋 Rapport inspection ${new Date().toISOString().slice(0, 10)}"`,
      'git commit rapport'
    );
    execSafe('git push', 'git push rapport');
    console.log('ℹ️  Aucune correction code — rapport seul commité.');
  }

  console.log('\n✅ Inspection terminée.');
}

main().catch(e => {
  console.error('❌ Erreur fatale :', e);
  process.exit(1);
});
