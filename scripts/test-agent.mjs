#!/usr/bin/env node
// Banc de test de l'Agent IA Zenbat — appelle l'API Anthropic en direct avec
// le même `system` prompt que `AgentIA.jsx`, puis analyse chaque réponse.
//
// Usage :
//   ANTHROPIC_KEY=sk-ant-... node scripts/test-agent.mjs
//   --limit N         n'envoie que les N premiers prompts
//   --concurrency N   nombre de requêtes en parallèle (défaut 3)
//   --model ID        modèle (défaut claude-haiku-4-5-20251001)
//   --sector NAME     filtre sur un secteur (btp, beaute, tech…)
//   --kind T1|T2|T3|ADV  filtre sur le type de prompt
//   --out DIR         dossier de sortie (défaut scripts/agent-test-data)

import { writeFile, mkdir } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { buildSystemPrompt } from "../src/lib/agentIA/prompt.js";
import { extractDevisJson } from "../src/lib/agentIA/extractDevis.js";
import { PROMPTS } from "./agent-test-prompts.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── CLI ──────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const flag = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
};
const LIMIT       = Number(flag("limit", PROMPTS.length));
const CONCURRENCY = Math.max(1, Number(flag("concurrency", 3)));
const MODEL       = flag("model", "claude-haiku-4-5-20251001");
const SECTOR      = flag("sector", null);
const KIND        = flag("kind", null);
const OUT_DIR     = resolve(__dirname, flag("out", "agent-test-data"));

const API_KEY = process.env.ANTHROPIC_KEY || process.env.ANTHROPIC_API_KEY;
if (!API_KEY) {
  console.error("✗ ANTHROPIC_KEY (ou ANTHROPIC_API_KEY) manquante dans l'env.");
  process.exit(1);
}

// ── Sélection ────────────────────────────────────────────────────────────────
const selected = PROMPTS
  .filter(p => !SECTOR || p.sector === SECTOR)
  .filter(p => !KIND   || p.kind   === KIND)
  .slice(0, LIMIT);

console.log(`▶ ${selected.length} prompt(s) — modèle ${MODEL} — concurrence ${CONCURRENCY}\n`);

// ── Appel Anthropic ──────────────────────────────────────────────────────────
async function callClaude({ system, userMessage }) {
  const t0 = Date.now();
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 6000,
      temperature: 0.2,
      system,
      messages: [{ role: "user", content: userMessage }],
    }),
  });
  const data = await res.json().catch(() => ({}));
  const duration = Date.now() - t0;
  if (!res.ok) {
    return { ok: false, status: res.status, error: data?.error?.message || JSON.stringify(data).slice(0, 200), duration };
  }
  const text = (data.content || []).filter(c => c.type === "text").map(c => c.text).join("");
  return {
    ok: true, status: 200, duration, text,
    inputTokens: data.usage?.input_tokens, outputTokens: data.usage?.output_tokens,
    cacheReadTokens: data.usage?.cache_read_input_tokens, cacheWriteTokens: data.usage?.cache_creation_input_tokens,
  };
}

// ── Analyse de la réponse ────────────────────────────────────────────────────
const REFUSAL_RE = /ne r[ée]alis(ons|e|ent) pas|ne fais(ons|ent)? pas|ne propos(ons|e|ent) pas|ne traitons pas|pas (notre|de) sp[ée]cialit[ée]/i;

function analyse(rawText) {
  if (!rawText) return { hasDevis: false, parseOk: false, isRefusal: false, nLines: 0, nLots: 0, nullPriceLines: 0, totalHt: 0, objet: "", askedQuestionFirst: false };

  const visibleBefore = rawText.replace(/<DEVIS>[\s\S]*/g, "").trim();
  const beforeBlock   = rawText.split("<DEVIS>")[0] || "";
  const askedQuestionFirst = /\?/.test(beforeBlock) && beforeBlock.length > 30;
  const isRefusal     = !rawText.includes("<DEVIS>") && REFUSAL_RE.test(visibleBefore);

  const json = extractDevisJson(rawText);
  if (!json) {
    return { hasDevis: false, parseOk: false, isRefusal, nLines: 0, nLots: 0, nullPriceLines: 0, totalHt: 0, objet: "", askedQuestionFirst };
  }
  let parsed;
  try { parsed = JSON.parse(json); }
  catch { return { hasDevis: true, parseOk: false, isRefusal, nLines: 0, nLots: 0, nullPriceLines: 0, totalHt: 0, objet: "", askedQuestionFirst }; }

  const lignes = Array.isArray(parsed.lignes) ? parsed.lignes : [];
  const ouvrages = lignes.filter(l => l.type_ligne === "ouvrage");
  const nLots = lignes.filter(l => l.type_ligne === "lot").length;
  const nullPriceLines = ouvrages.filter(l => l.prix_unitaire == null || l.prix_unitaire === 0).length;
  const totalHt = ouvrages.reduce((s, l) => s + (Number(l.quantite) || 0) * (Number(l.prix_unitaire) || 0), 0);

  return {
    hasDevis: true,
    parseOk: true,
    isRefusal,
    nLines: ouvrages.length,
    nLots,
    nullPriceLines,
    totalHt: Math.round(totalHt * 100) / 100,
    objet: parsed.objet || "",
    askedQuestionFirst,
    nChampsACompleter: Array.isArray(parsed.champs_a_completer) ? parsed.champs_a_completer.length : 0,
    nSuggestions:      Array.isArray(parsed.suggestions)        ? parsed.suggestions.length        : 0,
  };
}

// ── Boucle avec concurrence limitée ──────────────────────────────────────────
const results = new Array(selected.length);
let nextIndex = 0, done = 0;

async function worker(workerId) {
  while (true) {
    const i = nextIndex++;
    if (i >= selected.length) return;
    const item = selected[i];
    const system = buildSystemPrompt({ brand: item.brand, historySummary: null });
    let r;
    try {
      const call = await callClaude({ system, userMessage: item.prompt });
      const ana  = call.ok ? analyse(call.text) : null;
      r = { i, ...item, ...call, ...(ana || {}), system_chars: system.length };
    } catch (e) {
      r = { i, ...item, ok: false, error: e.message || String(e) };
    }
    results[i] = r;
    done++;
    const status = r.ok ? (r.hasDevis ? "✓" : "·") : "✗";
    const tag = `[${String(done).padStart(3)}/${selected.length}]`;
    const meta = r.ok
      ? `${r.nLines || 0}L · ${(r.totalHt || 0).toFixed(0)}€ · ${r.duration}ms`
      : `${r.status || "?"} ${r.error || ""}`.slice(0, 60);
    console.log(`${tag} ${status} [${item.kind} ${item.sector}] ${item.prompt.slice(0, 60)} → ${meta}`);
  }
}

const start = Date.now();
await Promise.all(Array.from({ length: CONCURRENCY }, (_, k) => worker(k)));
const totalMs = Date.now() - start;

// ── Sortie CSV + JSON ────────────────────────────────────────────────────────
await mkdir(OUT_DIR, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-");

const csvHeader = ["i","sector","kind","prompt","status","duration_ms","has_devis","parse_ok","is_refusal","asked_question_first","n_lots","n_lines","null_price_lines","total_ht","objet","n_champs_a_completer","n_suggestions","input_tokens","output_tokens","cache_read","cache_write","error"].join(",");
const escapeCsv = (v) => {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const csvRows = results.map(r => [
  r.i, r.sector, r.kind, r.prompt, r.status ?? "", r.duration ?? "",
  r.hasDevis ?? "", r.parseOk ?? "", r.isRefusal ?? "", r.askedQuestionFirst ?? "",
  r.nLots ?? "", r.nLines ?? "", r.nullPriceLines ?? "", r.totalHt ?? "", r.objet ?? "",
  r.nChampsACompleter ?? "", r.nSuggestions ?? "",
  r.inputTokens ?? "", r.outputTokens ?? "", r.cacheReadTokens ?? "", r.cacheWriteTokens ?? "",
  r.error ?? "",
].map(escapeCsv).join(","));
await writeFile(resolve(OUT_DIR, `agent-test-${stamp}.csv`), [csvHeader, ...csvRows].join("\n"), "utf8");

// On stocke aussi le détail brut (texte complet) pour analyse manuelle.
await writeFile(
  resolve(OUT_DIR, `agent-test-${stamp}.json`),
  JSON.stringify(results.map(r => ({
    i: r.i, sector: r.sector, kind: r.kind, prompt: r.prompt,
    status: r.status, duration: r.duration, error: r.error,
    text: r.text,
    analysis: r.ok ? {
      hasDevis: r.hasDevis, parseOk: r.parseOk, isRefusal: r.isRefusal, askedQuestionFirst: r.askedQuestionFirst,
      nLines: r.nLines, nLots: r.nLots, nullPriceLines: r.nullPriceLines,
      totalHt: r.totalHt, objet: r.objet,
      nChampsACompleter: r.nChampsACompleter, nSuggestions: r.nSuggestions,
    } : null,
    usage: r.ok ? {
      input: r.inputTokens, output: r.outputTokens,
      cacheRead: r.cacheReadTokens, cacheWrite: r.cacheWriteTokens,
    } : null,
  })), null, 2),
  "utf8",
);

// ── Récap console ────────────────────────────────────────────────────────────
const ok        = results.filter(r => r.ok).length;
const failed    = results.filter(r => !r.ok).length;
const withDevis = results.filter(r => r.hasDevis).length;
const parseOk   = results.filter(r => r.parseOk).length;
const refusals  = results.filter(r => r.isRefusal).length;
const askedQ    = results.filter(r => r.askedQuestionFirst).length;
const nullPrice = results.filter(r => r.nullPriceLines > 0).length;

const byKind = {};
for (const r of results) {
  const k = r.kind;
  byKind[k] ??= { total: 0, withDevis: 0, askedQ: 0, refusals: 0 };
  byKind[k].total++;
  if (r.hasDevis) byKind[k].withDevis++;
  if (r.askedQuestionFirst) byKind[k].askedQ++;
  if (r.isRefusal) byKind[k].refusals++;
}

const totalIn  = results.reduce((s, r) => s + (r.inputTokens  || 0), 0);
const totalOut = results.reduce((s, r) => s + (r.outputTokens || 0), 0);
const totalCacheRead  = results.reduce((s, r) => s + (r.cacheReadTokens  || 0), 0);
const totalCacheWrite = results.reduce((s, r) => s + (r.cacheWriteTokens || 0), 0);

console.log("\n══════════════ RÉCAP ══════════════");
console.log(`Durée totale       : ${(totalMs / 1000).toFixed(1)}s`);
console.log(`Réponses OK        : ${ok}/${results.length}`);
console.log(`Erreurs HTTP/réseau: ${failed}`);
console.log(`Devis générés      : ${withDevis} (${((withDevis / ok) * 100 || 0).toFixed(0)}%)`);
console.log(`JSON parse OK      : ${parseOk}/${withDevis}`);
console.log(`Refus IA           : ${refusals}`);
console.log(`Questions avant <DEVIS> : ${askedQ}`);
console.log(`Lignes prix manquant : ${nullPrice} devis concernés`);
console.log(`Tokens input/output: ${totalIn} / ${totalOut}`);
console.log(`Cache read/write   : ${totalCacheRead} / ${totalCacheWrite}`);
console.log("\nPar type :");
for (const [k, v] of Object.entries(byKind)) {
  console.log(`  ${k.padEnd(3)} → ${v.withDevis}/${v.total} devis · ${v.askedQ} questions · ${v.refusals} refus`);
}
console.log(`\nFichiers : ${OUT_DIR}/agent-test-${stamp}.{csv,json}`);
