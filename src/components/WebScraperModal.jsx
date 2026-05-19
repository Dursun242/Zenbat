import { useState } from "react";
import { createPortal } from "react-dom";
import { displayName } from "../lib/utils.js";
import { getToken } from "../lib/getToken.js";

const MAX_URLS = 5;

// Une carte de résultat scrape : soit erreur, soit contact extrait éditable.
function ResultCard({ result, included, onToggle, onEdit, canEdit }) {
  if (result.error) {
    return (
      <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 12, padding: 12, fontSize: 12 }}>
        <div style={{ color: "#991b1b", fontWeight: 600, marginBottom: 4, wordBreak: "break-all" }}>
          ⚠️ {result.url}
        </div>
        <div style={{ color: "#7f1d1d" }}>{result.error}</div>
      </div>
    );
  }
  const c = result.contact;
  const name = displayName(c);
  const subtitle = [c.email, c.telephone].filter(Boolean).join(" · ");
  const loc = [c.code_postal, c.ville].filter(Boolean).join(" ");
  return (
    <div style={{ background: "white", border: `1.5px solid ${included ? "#22c55e" : "#E8E2D8"}`, borderRadius: 12, padding: 12, display: "flex", alignItems: "flex-start", gap: 10 }}>
      <input type="checkbox" checked={included} onChange={onToggle}
        style={{ marginTop: 2, width: 18, height: 18, accentColor: "#22c55e", cursor: "pointer", flexShrink: 0 }}/>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#1A1612", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {name === "—" ? <span style={{ color: "#9A8E82", fontStyle: "italic" }}>Sans nom (à compléter)</span> : name}
        </div>
        {c.activite && (
          <div style={{ fontSize: 11, color: "#6B6358", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {c.activite}
          </div>
        )}
        <div style={{ fontSize: 11, color: "#9A8E82", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {subtitle || loc || "Aucune info contact détectée"}
          {subtitle && loc && <span style={{ color: "#C8BFB5" }}> · {loc}</span>}
        </div>
        <div style={{ fontSize: 10, color: "#9A8E82", marginTop: 4, wordBreak: "break-all" }}>
          {result.url}
        </div>
      </div>
      {canEdit && (
        <button onClick={onEdit}
          style={{ background: "#F0EBE3", border: "none", borderRadius: 8, padding: "6px 10px", fontSize: 11, fontWeight: 600, color: "#6B6358", cursor: "pointer", flexShrink: 0 }}>
          ✏️
        </button>
      )}
    </div>
  );
}

export default function WebScraperModal({ onSave, onClose, onEditOne }) {
  const [phase, setPhase] = useState("input"); // input | loading | review
  const [urlsText, setUrlsText] = useState("");
  const [results, setResults] = useState([]);
  const [included, setIncluded] = useState({}); // url -> bool
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);

  const parsedUrls = urlsText
    .split(/[\n,]+/)
    .map(s => s.trim())
    .filter(Boolean);
  const tooMany = parsedUrls.length > MAX_URLS;
  const canScrape = parsedUrls.length > 0 && !tooMany && phase === "input";

  const onScrape = async () => {
    setError("");
    setPhase("loading");
    try {
      const token = await getToken();
      const res = await fetch("/api/claude", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ scrape_urls: parsedUrls }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Erreur scrape");
      const arr = Array.isArray(data?.results) ? data.results : [];
      setResults(arr);
      // Coche par défaut tous les résultats sans erreur qui ont au moins un champ utile
      const inc = {};
      arr.forEach(r => {
        if (!r.error) {
          const c = r.contact || {};
          const hasAny = c.raison_sociale || c.nom || c.prenom || c.email || c.telephone;
          inc[r.url] = !!hasAny;
        }
      });
      setIncluded(inc);
      setPhase("review");
    } catch (err) {
      setError(err?.message || "Erreur réseau");
      setPhase("input");
    }
  };

  const onCreate = async () => {
    setCreating(true);
    const toCreate = results.filter(r => !r.error && included[r.url]);
    try {
      for (const r of toCreate) {
        // Le parent reçoit le contact brut + l'URL source et décide du mapping
        // (client vs prospect vs autre schéma) avant persistance.
        await onSave(r.contact, r.url);
      }
      onClose();
    } catch (err) {
      setError("Erreur lors de la création : " + (err?.message || ""));
      setCreating(false);
    }
  };

  const includedCount = results.filter(r => !r.error && included[r.url]).length;
  const errorCount    = results.filter(r => r.error).length;

  return createPortal(
    <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(15,23,42,.7)", zIndex: 9999, fontFamily: "'DM Sans',sans-serif" }}>
      <div onClick={creating ? undefined : onClose} style={{ position: "absolute", inset: 0 }}/>
      <div style={{
        position: "absolute", left: 0, right: 0, bottom: 0,
        maxHeight: "92dvh", height: "92dvh",
        background: "#FAF7F2",
        borderTopLeftRadius: 20, borderTopRightRadius: 20,
        display: "flex", flexDirection: "column",
      }}>
        <div style={{ padding: "14px 18px", borderBottom: "1px solid #F0EBE3", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0, background: "white", borderTopLeftRadius: 20, borderTopRightRadius: 20 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#1A1612" }}>
              {phase === "review" ? "Vérifier les contacts" : "Importer depuis sites web"}
            </div>
            <div style={{ fontSize: 11, color: "#9A8E82", marginTop: 2 }}>
              {phase === "review"
                ? `${includedCount} sélectionné${includedCount > 1 ? "s" : ""}${errorCount ? ` · ${errorCount} échec${errorCount > 1 ? "s" : ""}` : ""}`
                : `Colle jusqu'à ${MAX_URLS} URLs (une par ligne)`}
            </div>
          </div>
          <button onClick={onClose} disabled={creating}
            style={{ background: "#F0EBE3", border: "none", borderRadius: 10, width: 32, height: 32, cursor: creating ? "not-allowed" : "pointer", fontSize: 14, color: "#6B6358" }}>✕</button>
        </div>

        <div style={{ flex: 1, minHeight: 0, overflowY: "auto", WebkitOverflowScrolling: "touch", padding: 16 }}>
          {phase === "input" && (
            <>
              <textarea
                value={urlsText}
                onChange={e => setUrlsText(e.target.value)}
                placeholder={"https://www.dupont-maconnerie.fr\nhttps://plomberie-martin.com\n…"}
                rows={8}
                style={{ width: "100%", background: "white", border: "1px solid #E8E2D8", borderRadius: 12, padding: 14, fontSize: 13, color: "#1A1612", outline: "none", resize: "vertical", fontFamily: "monospace", boxSizing: "border-box" }}
              />
              <div style={{ marginTop: 8, fontSize: 11, color: tooMany ? "#dc2626" : "#9A8E82" }}>
                {parsedUrls.length}/{MAX_URLS} URLs
                {tooMany && ` — trop d'URLs (max ${MAX_URLS} par lot)`}
              </div>
              <div style={{ marginTop: 16, padding: 12, background: "#eef2ff", border: "1px solid #c7d2fe", borderRadius: 12, fontSize: 12, color: "#4338ca" }}>
                💡 L'IA extrait raison sociale, email, téléphone, adresse et SIRET depuis chaque page. Tu pourras vérifier et ajuster avant création.
              </div>
              {error && (
                <div style={{ marginTop: 12, padding: "10px 14px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, fontSize: 12, color: "#991b1b" }}>
                  {error}
                </div>
              )}
            </>
          )}

          {phase === "loading" && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 14 }}>
              <span style={{ display: "inline-block", width: 32, height: 32, border: "3px solid #c7d2fe", borderTopColor: "#4338ca", borderRadius: "50%", animation: "spin .8s linear infinite" }}/>
              <div style={{ fontSize: 13, color: "#4338ca", fontWeight: 600 }}>Analyse de {parsedUrls.length} site{parsedUrls.length > 1 ? "s" : ""}…</div>
              <div style={{ fontSize: 11, color: "#9A8E82" }}>Ça peut prendre 10 à 30 secondes</div>
            </div>
          )}

          {phase === "review" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {results.map(r => (
                <ResultCard
                  key={r.url}
                  result={r}
                  included={!!included[r.url]}
                  onToggle={() => setIncluded(prev => ({ ...prev, [r.url]: !prev[r.url] }))}
                  onEdit={() => onEditOne?.(r.contact, r.url)}
                  canEdit={!!onEditOne}
                />
              ))}
              {error && (
                <div style={{ padding: "10px 14px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, fontSize: 12, color: "#991b1b" }}>
                  {error}
                </div>
              )}
            </div>
          )}
        </div>

        <div style={{ padding: "12px 16px calc(12px + env(safe-area-inset-bottom))", borderTop: "1px solid #F0EBE3", display: "flex", gap: 10, flexShrink: 0, background: "white" }}>
          {phase === "input" && (
            <>
              <button onClick={onClose}
                style={{ flex: 1, background: "white", border: "1px solid #E8E2D8", borderRadius: 12, padding: 12, fontSize: 13, fontWeight: 600, color: "#6B6358", cursor: "pointer" }}>
                Annuler
              </button>
              <button onClick={onScrape} disabled={!canScrape}
                style={{ flex: 2, background: canScrape ? "#1A1612" : "#cbd5e1", color: "white", border: "none", borderRadius: 12, padding: 12, fontSize: 13, fontWeight: 700, cursor: canScrape ? "pointer" : "not-allowed" }}>
                Scraper {parsedUrls.length > 0 ? `(${parsedUrls.length})` : ""}
              </button>
            </>
          )}
          {phase === "review" && (
            <>
              <button onClick={() => { setPhase("input"); setResults([]); setError(""); }}
                disabled={creating}
                style={{ flex: 1, background: "white", border: "1px solid #E8E2D8", borderRadius: 12, padding: 12, fontSize: 13, fontWeight: 600, color: "#6B6358", cursor: creating ? "not-allowed" : "pointer" }}>
                Retour
              </button>
              <button onClick={onCreate} disabled={includedCount === 0 || creating}
                style={{ flex: 2, background: includedCount === 0 || creating ? "#cbd5e1" : "#22c55e", color: "white", border: "none", borderRadius: 12, padding: 12, fontSize: 13, fontWeight: 700, cursor: includedCount === 0 || creating ? "not-allowed" : "pointer" }}>
                {creating ? "Création…" : `Créer ${includedCount} contact${includedCount > 1 ? "s" : ""}`}
              </button>
            </>
          )}
        </div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>,
    document.body
  );
}
