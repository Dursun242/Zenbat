// Historique des échanges avec l'Agent IA (ouvert à la demande depuis la note
// de la barre de dictée) : demandes de l'artisan et réponses de Zenbat, avec
// le retour « utile / à améliorer » sur les réponses qui ont rempli le devis.
//
// Présentationnel : tout l'état vit dans AgentIA.

const REASON_TAGS = ["Trop de questions", "Mauvais métier", "Prix incorrects", "Trop générique", "Hors sujet"];

const C = {
  ink: "#1A1612", ink2: "#5C544B", rule: "#D9D2C5", ruleSoft: "#ECE7DE",
  accent: "#A4461F", accentSoft: "#F6E7DF", stamp: "#1E7B3C", danger: "#B42318", sheet: "#FFFFFF",
};

// Rendu minimal du texte de l'IA : **gras** et *gras* (sans laisser
// d'astérisques), retours à la ligne conservés.
export function RichText({ text }) {
  const lines = String(text || "").split("\n");
  return lines.map((line, i) => (
    <span key={i}>
      {line.split(/(\*\*[^*]+\*\*|\*[^*\n]+\*)/g).map((part, j) => {
        const m = part.match(/^\*\*([^*]+)\*\*$/) || part.match(/^\*([^*]+)\*$/);
        return m ? <strong key={j} style={{ fontWeight: 700, color: C.ink }}>{m[1]}</strong> : part;
      })}
      {i < lines.length - 1 && <br/>}
    </span>
  ));
}

function ReasonPicker({ idx, fb, setFeedback, saveFeedback }) {
  return (
    <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
      <div style={{ fontSize: 14, fontWeight: 600, color: C.ink }}>Qu'est-ce qui n'allait pas ?</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {REASON_TAGS.map(tag => {
          const on = fb.reason === tag;
          return (
            <button key={tag} type="button" aria-pressed={on}
              onClick={() => setFeedback(prev => ({ ...prev, [idx]: { ...prev[idx], reason: on ? "" : tag } }))}
              style={{ minHeight: 40, padding: "0 12px", borderRadius: 20, border: `1px solid ${on ? C.accent : C.rule}`,
                background: on ? C.accentSoft : C.sheet, color: on ? C.accent : C.ink, fontFamily: "inherit", fontSize: 14,
                fontWeight: on ? 700 : 500, cursor: "pointer" }}>
              {tag}
            </button>
          );
        })}
      </div>
      <label htmlFor={`fb-${idx}`} className="zb-sr">Autre raison</label>
      <input id={`fb-${idx}`} placeholder="Autre raison (facultatif)" value={fb.customReason || ""}
        onChange={e => setFeedback(prev => ({ ...prev, [idx]: { ...prev[idx], customReason: e.target.value } }))}
        style={{ minHeight: 44, padding: "0 12px", borderRadius: 8, border: `1px solid ${C.rule}`, fontFamily: "inherit", fontSize: 16, color: C.ink }}/>
      <button type="button" onClick={() => saveFeedback(idx, -1, fb.customReason || fb.reason || null)}
        style={{ justifySelf: "start", minHeight: 44, padding: "0 18px", borderRadius: 8, border: "none", background: C.ink, color: "#FBFAF7",
          fontFamily: "inherit", fontSize: 15, fontWeight: 700, cursor: "pointer" }}>
        Envoyer
      </button>
    </div>
  );
}

export default function ChatThread({ msgs, feedback, setFeedback, saveFeedback, loading }) {
  return (
    <ol style={{ listStyle: "none", margin: 0, padding: 0 }}>
      {msgs.map((m, i) => {
        const fb = feedback[i] || {};
        const mine = m.role === "user";
        return (
          <li key={i} style={{ padding: "14px 0", borderBottom: `1px solid ${C.ruleSoft}` }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: mine ? C.ink2 : C.accent, marginBottom: 4 }}>{mine ? "Toi" : "Zenbat"}</div>
            <div style={{ fontSize: 15, lineHeight: 1.5, color: m.error ? C.danger : C.ink }}><RichText text={m.content}/></div>
            {m.hasDevis && !loading && (
              fb.saved ? (
                <div style={{ marginTop: 8, fontSize: 13, color: C.stamp }}>{fb.vote === 1 ? "Merci pour ton retour." : "Retour noté, merci."}</div>
              ) : fb.showReason ? (
                <ReasonPicker idx={i} fb={fb} setFeedback={setFeedback} saveFeedback={saveFeedback}/>
              ) : (
                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                  <button type="button" onClick={() => { setFeedback(prev => ({ ...prev, [i]: { vote: 1 } })); saveFeedback(i, 1); }}
                    style={{ minHeight: 40, padding: "0 12px", borderRadius: 8, border: `1px solid ${C.rule}`, background: C.sheet, color: C.ink, fontFamily: "inherit", fontSize: 14, cursor: "pointer" }}>
                    Utile
                  </button>
                  <button type="button" onClick={() => setFeedback(prev => ({ ...prev, [i]: { vote: -1, showReason: true } }))}
                    style={{ minHeight: 40, padding: "0 12px", borderRadius: 8, border: `1px solid ${C.rule}`, background: C.sheet, color: C.ink, fontFamily: "inherit", fontSize: 14, cursor: "pointer" }}>
                    À améliorer
                  </button>
                </div>
              )
            )}
          </li>
        );
      })}
      {loading && (
        <li style={{ padding: "14px 0", fontSize: 15, color: C.ink2 }}>Zenbat rédige ton devis…</li>
      )}
    </ol>
  );
}
