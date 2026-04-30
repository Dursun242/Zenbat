import { useState, useMemo, useRef } from "react";
import { CLAUDE_MODEL } from "../../lib/constants.js";
import { getToken } from "../../lib/getToken.js";
import { buildSystemPrompt } from "../../lib/agentIA/prompt.js";
import { extractDevisJson } from "../../lib/agentIA/extractDevis.js";
import { requestClaude, ClaudeApiError } from "../../lib/agentIA/stream.js";
import { PROMPTS } from "../../lib/agentIA/testPrompts.js";

const CONCURRENCY = 3;
const REFUSAL_RE = /ne r[ée]alis(ons|e|ent) pas|ne fais(ons|ent)? pas|ne propos(ons|e|ent) pas|ne traitons pas|pas (notre|de) sp[ée]cialit[ée]/i;

function analyseResponse(rawText) {
  if (!rawText) return { hasDevis: false, parseOk: false, isRefusal: false, askedQuestionFirst: false, nLines: 0, nLots: 0, nullPriceLines: 0, totalHt: 0, objet: "" };
  const beforeBlock = rawText.split("<DEVIS>")[0] || "";
  const askedQuestionFirst = /\?/.test(beforeBlock) && beforeBlock.length > 30;
  const visibleBefore = rawText.replace(/<DEVIS>[\s\S]*/g, "").trim();
  const isRefusal = !rawText.includes("<DEVIS>") && REFUSAL_RE.test(visibleBefore);

  const json = extractDevisJson(rawText);
  if (!json) return { hasDevis: false, parseOk: false, isRefusal, askedQuestionFirst, nLines: 0, nLots: 0, nullPriceLines: 0, totalHt: 0, objet: "" };
  let parsed;
  try { parsed = JSON.parse(json); }
  catch { return { hasDevis: true, parseOk: false, isRefusal, askedQuestionFirst, nLines: 0, nLots: 0, nullPriceLines: 0, totalHt: 0, objet: "" }; }

  const lignes = Array.isArray(parsed.lignes) ? parsed.lignes : [];
  const ouvrages = lignes.filter(l => l.type_ligne === "ouvrage");
  const nullPriceLines = ouvrages.filter(l => l.prix_unitaire == null || l.prix_unitaire === 0).length;
  const totalHt = ouvrages.reduce((s, l) => s + (Number(l.quantite) || 0) * (Number(l.prix_unitaire) || 0), 0);
  return {
    hasDevis: true, parseOk: true, isRefusal, askedQuestionFirst,
    nLines: ouvrages.length,
    nLots: lignes.filter(l => l.type_ligne === "lot").length,
    nullPriceLines,
    totalHt: Math.round(totalHt * 100) / 100,
    objet: parsed.objet || "",
  };
}

function downloadCsv(rows) {
  const header = ["i","sector","kind","prompt","status","duration_ms","has_devis","parse_ok","is_refusal","asked_question_first","n_lots","n_lines","null_price_lines","total_ht","objet","error"];
  const escape = (v) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [header.join(",")]
    .concat(rows.map(r => header.map(h => escape(r[h])).join(",")))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url;
  a.download = `agent-test-${new Date().toISOString().replace(/[:.]/g, "-")}.csv`;
  document.body.appendChild(a); a.click();
  setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
}

export default function AdminAgentBenchmark() {
  const [running,    setRunning]    = useState(false);
  const [progress,   setProgress]   = useState({ done: 0, total: 0 });
  const [results,    setResults]    = useState([]);
  const [error,      setError]      = useState(null);
  const [filter,     setFilter]     = useState("all");
  const [openDetail, setOpenDetail] = useState(null);
  const cancelRef = useRef(false);

  const total = PROMPTS.length;

  const summary = useMemo(() => {
    if (results.length === 0) return null;
    const ok        = results.filter(r => r.status === 200).length;
    const withDevis = results.filter(r => r.has_devis).length;
    const parseOk   = results.filter(r => r.parse_ok).length;
    const refusals  = results.filter(r => r.is_refusal).length;
    const askedQ    = results.filter(r => r.asked_question_first).length;
    const nullPrice = results.filter(r => r.null_price_lines > 0).length;
    return { ok, withDevis, parseOk, refusals, askedQ, nullPrice, total: results.length };
  }, [results]);

  const filtered = useMemo(() => {
    if (filter === "all")          return results;
    if (filter === "refusals")     return results.filter(r => r.is_refusal);
    if (filter === "no_devis")     return results.filter(r => r.status === 200 && !r.has_devis);
    if (filter === "asked_first")  return results.filter(r => r.asked_question_first);
    if (filter === "null_price")   return results.filter(r => r.null_price_lines > 0);
    if (filter === "errors")       return results.filter(r => r.status !== 200);
    return results.filter(r => r.kind === filter || r.sector === filter);
  }, [results, filter]);

  const run = async () => {
    if (running) return;
    setRunning(true); setError(null); setResults([]); setOpenDetail(null);
    setProgress({ done: 0, total });
    cancelRef.current = false;

    const token = await getToken();
    const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};
    const out = new Array(total);
    let nextIndex = 0, doneCount = 0;

    const worker = async () => {
      while (!cancelRef.current) {
        const i = nextIndex++;
        if (i >= total) return;
        const item = PROMPTS[i];
        const t0 = Date.now();
        let row;
        try {
          const system = buildSystemPrompt({ brand: item.brand, historySummary: null });
          const text = await requestClaude({
            body: {
              model: CLAUDE_MODEL,
              max_tokens: 6000,
              temperature: 0.2,
              system,
              messages: [{ role: "user", content: item.prompt }],
            },
            authHeaders,
          });
          const a = analyseResponse(text);
          row = {
            i, sector: item.sector, kind: item.kind, prompt: item.prompt,
            status: 200, duration_ms: Date.now() - t0,
            has_devis: a.hasDevis, parse_ok: a.parseOk, is_refusal: a.isRefusal,
            asked_question_first: a.askedQuestionFirst,
            n_lots: a.nLots, n_lines: a.nLines, null_price_lines: a.nullPriceLines,
            total_ht: a.totalHt, objet: a.objet, error: "",
            _rawText: text,
          };
        } catch (e) {
          row = {
            i, sector: item.sector, kind: item.kind, prompt: item.prompt,
            status: e instanceof ClaudeApiError ? 0 : -1,
            duration_ms: Date.now() - t0,
            has_devis: false, parse_ok: false, is_refusal: false,
            asked_question_first: false, n_lots: 0, n_lines: 0,
            null_price_lines: 0, total_ht: 0, objet: "",
            error: e.message || String(e),
          };
        }
        out[i] = row;
        doneCount++;
        setProgress({ done: doneCount, total });
        setResults([...out].filter(Boolean).sort((a, b) => a.i - b.i));
      }
    };

    try {
      await Promise.all(Array.from({ length: CONCURRENCY }, worker));
    } catch (e) {
      setError(e.message || "Erreur inattendue");
    } finally {
      setRunning(false);
    }
  };

  const cancel = () => { cancelRef.current = true; };

  return (
    <div style={{ background: "white", borderRadius: 14, overflow: "hidden", marginBottom: 16, boxShadow: "0 1px 4px rgba(0,0,0,.06)" }}>
      <div style={{ padding: "12px 16px", borderBottom: "1px solid #F0EBE3", display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ fontWeight: 700, fontSize: 13, color: "#1A1612", flex: 1 }}>
          Banc de test Agent IA · {total} prompts
        </div>
        {!running ? (
          <button onClick={run}
            style={{ background: "#16a34a", color: "white", border: "none", borderRadius: 8, padding: "6px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
            ▶ Lancer le test
          </button>
        ) : (
          <button onClick={cancel}
            style={{ background: "#ef4444", color: "white", border: "none", borderRadius: 8, padding: "6px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
            ■ Arrêter
          </button>
        )}
      </div>

      <div style={{ padding: "12px 16px" }}>
        <div style={{ fontSize: 11, color: "#6B6358", marginBottom: 10, lineHeight: 1.5 }}>
          Envoie {total} requêtes à <code>/api/claude</code> avec le même <code>system</code> que l'agent en prod.
          Mesure : taux de devis générés, refus IA, questions avant <code>&lt;DEVIS&gt;</code>, lignes à prix nul.
          Compte ~3 min et ~110 appels sur ton quota IA quotidien (200/jour pour le compte admin).
        </div>

        {error && (
          <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "8px 12px", color: "#991b1b", fontSize: 12, marginBottom: 10 }}>
            ❌ {error}
          </div>
        )}

        {(running || progress.done > 0) && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, color: "#6B6358", marginBottom: 4 }}>
              {progress.done} / {progress.total} {running ? "en cours…" : "terminé"}
            </div>
            <div style={{ background: "#F0EBE3", height: 6, borderRadius: 3, overflow: "hidden" }}>
              <div style={{ background: "#16a34a", height: "100%", width: `${(progress.done / progress.total) * 100}%`, transition: "width .2s" }}/>
            </div>
          </div>
        )}

        {summary && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 8, marginBottom: 14 }}>
              <Kpi value={summary.withDevis} total={summary.total} label="Devis OK" color="#22c55e" />
              <Kpi value={summary.parseOk}   total={summary.withDevis} label="JSON OK" color="#3b82f6" />
              <Kpi value={summary.refusals}  total={summary.total} label="Refus IA" color="#ef4444" highlightHigh />
              <Kpi value={summary.askedQ}    total={summary.total} label="Questions avant" color="#f59e0b" highlightHigh />
              <Kpi value={summary.nullPrice} total={summary.total} label="Prix manquants" color="#f59e0b" highlightHigh />
              <Kpi value={summary.total - summary.ok} total={summary.total} label="Erreurs" color="#6b7280" highlightHigh />
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
              {[
                ["all", "Toutes"], ["refusals", "Refus"], ["no_devis", "Sans devis"],
                ["asked_first", "Q avant"], ["null_price", "Prix nul"], ["errors", "Erreurs"],
                ["T1", "T1"], ["T2", "T2"], ["T3", "T3"], ["ADV", "ADV"],
              ].map(([k, label]) => (
                <button key={k} onClick={() => setFilter(k)}
                  style={{ background: filter === k ? "#1A1612" : "#FAF7F2", color: filter === k ? "white" : "#6B6358",
                           border: "1px solid #E8E2D8", borderRadius: 16, padding: "3px 10px", fontSize: 11, cursor: "pointer", fontWeight: 600 }}>
                  {label}
                </button>
              ))}
              <button onClick={() => downloadCsv(results)}
                style={{ marginLeft: "auto", background: "#FAF7F2", border: "1px solid #E8E2D8", borderRadius: 16, padding: "3px 10px", fontSize: 11, cursor: "pointer", fontWeight: 600, color: "#3D3028" }}>
                ⬇ CSV
              </button>
            </div>

            <div style={{ maxHeight: 420, overflowY: "auto", border: "1px solid #F0EBE3", borderRadius: 10 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                <thead style={{ position: "sticky", top: 0, background: "#FAF7F2", zIndex: 1 }}>
                  <tr>
                    <Th>#</Th><Th>Type</Th><Th>Secteur</Th><Th>Prompt</Th>
                    <Th>État</Th><Th>Lignes</Th><Th>Total HT</Th><Th>ms</Th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(r => (
                    <tr key={r.i} onClick={() => setOpenDetail(r)} style={{ cursor: "pointer", borderBottom: "1px solid #F0EBE3" }}>
                      <Td>{r.i + 1}</Td>
                      <Td><span style={{ background: "#F0EBE3", borderRadius: 4, padding: "1px 6px", fontWeight: 700 }}>{r.kind}</span></Td>
                      <Td>{r.sector}</Td>
                      <Td title={r.prompt} style={{ maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.prompt}</Td>
                      <Td>{rowStatus(r)}</Td>
                      <Td>{r.has_devis ? `${r.n_lines} (${r.n_lots} lots)` : "—"}</Td>
                      <Td>{r.total_ht ? `${r.total_ht.toLocaleString("fr-FR")} €` : "—"}</Td>
                      <Td style={{ color: "#9A8E82" }}>{r.duration_ms}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {openDetail && <DetailModal row={openDetail} onClose={() => setOpenDetail(null)} />}
    </div>
  );
}

function Kpi({ value, total, label, color, highlightHigh }) {
  const pct = total ? Math.round((value / total) * 100) : 0;
  const danger = highlightHigh && value > 0;
  return (
    <div style={{ background: "#FAF7F2", borderRadius: 10, padding: "10px 8px", textAlign: "center" }}>
      <div style={{ fontSize: 18, fontWeight: 800, color: danger ? "#ef4444" : color }}>{value}</div>
      <div style={{ fontSize: 9, color: "#9A8E82", marginTop: 2, lineHeight: 1.2 }}>{label}<br/>{total ? `${pct}%` : ""}</div>
    </div>
  );
}

function Th({ children }) {
  return <th style={{ textAlign: "left", padding: "6px 10px", fontSize: 9, fontWeight: 700, color: "#9A8E82", letterSpacing: ".5px", textTransform: "uppercase" }}>{children}</th>;
}
function Td({ children, ...rest }) {
  return <td {...rest} style={{ padding: "6px 10px", color: "#3D3028", ...(rest.style || {}) }}>{children}</td>;
}

function rowStatus(r) {
  if (r.status !== 200)         return <span style={{ color: "#ef4444" }} title={r.error}>✗ erreur</span>;
  if (r.is_refusal)             return <span style={{ color: "#ef4444" }}>⛔ refus</span>;
  if (r.asked_question_first)   return <span style={{ color: "#f59e0b" }}>❓ Q avant</span>;
  if (!r.has_devis)             return <span style={{ color: "#f59e0b" }}>⚠ sans devis</span>;
  if (!r.parse_ok)              return <span style={{ color: "#f59e0b" }}>⚠ JSON KO</span>;
  if (r.null_price_lines > 0)   return <span style={{ color: "#f59e0b" }}>⚠ prix nul ({r.null_price_lines})</span>;
  return <span style={{ color: "#22c55e" }}>✓</span>;
}

function DetailModal({ row, onClose }) {
  return (
    <div onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={e => e.stopPropagation()}
        style={{ background: "white", borderRadius: 14, maxWidth: 720, width: "100%", maxHeight: "85vh", overflowY: "auto", padding: 18 }}>
        <div style={{ display: "flex", alignItems: "start", gap: 10, marginBottom: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, color: "#9A8E82", letterSpacing: ".5px", textTransform: "uppercase" }}>{row.kind} · {row.sector}</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#1A1612", marginTop: 2 }}>{row.prompt}</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "#9A8E82", lineHeight: 1 }}>×</button>
        </div>
        {row.error && (
          <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "8px 12px", color: "#991b1b", fontSize: 12, marginBottom: 10 }}>
            {row.error}
          </div>
        )}
        {row._rawText && (
          <pre style={{ background: "#FAF7F2", border: "1px solid #F0EBE3", borderRadius: 8, padding: 12, fontSize: 11, lineHeight: 1.5, whiteSpace: "pre-wrap", wordBreak: "break-word", color: "#1A1612", maxHeight: "60vh", overflowY: "auto" }}>
            {row._rawText}
          </pre>
        )}
      </div>
    </div>
  );
}
