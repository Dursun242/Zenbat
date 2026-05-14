// Rendu du fil de discussion de l'Agent IA :
// - bandeau « mémoire active »
// - bulle des messages (user / assistant)
// - barre de feedback (👍 / 👎) sur chaque réponse contenant un devis
// - puces de démarrage rapide sur le chat vierge
// - indicateur « ... » pendant le streaming
//
// Tout le state vit chez le parent (AgentIA) ; ce composant est purement
// présentationnel : il appelle setFeedback / saveFeedback / send aux moments
// opportuns.

const REASON_TAGS = ["Trop de questions", "Mauvais métier", "Prix incorrects", "Trop générique", "Hors sujet"]

function MessageFeedback({ idx, fb, ac, setFeedback, saveFeedback }) {
  if (fb.saved) {
    return (
      <span style={{ fontSize: 11, color: fb.vote === 1 ? "#16a34a" : "#9A8E82" }}>
        {fb.vote === 1 ? "✓ Merci !" : "✓ Noté"}
      </span>
    )
  }
  if (fb.showReason) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 6, maxWidth: 300 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
          {REASON_TAGS.map(tag => (
            <button key={tag}
              onClick={() => setFeedback(prev => ({ ...prev, [idx]: { ...prev[idx], reason: prev[idx]?.reason === tag ? "" : tag } }))}
              style={{ fontSize: 10, padding: "3px 8px", borderRadius: 20, border: `1px solid ${fb.reason === tag ? ac : "#e5e7eb"}`, background: fb.reason === tag ? ac + "18" : "white", color: fb.reason === tag ? ac : "#6B6358", cursor: "pointer", fontWeight: fb.reason === tag ? 700 : 400 }}>
              {tag}
            </button>
          ))}
        </div>
        <input
          placeholder="Autre raison… (optionnel)"
          value={fb.customReason || ""}
          onChange={e => setFeedback(prev => ({ ...prev, [idx]: { ...prev[idx], customReason: e.target.value } }))}
          style={{ fontSize: 11, padding: "5px 8px", borderRadius: 8, border: "1px solid #e5e7eb", outline: "none" }}
        />
        <button
          onClick={() => saveFeedback(idx, -1, fb.customReason || fb.reason || null)}
          style={{ alignSelf: "flex-start", fontSize: 11, padding: "4px 12px", borderRadius: 8, border: "none", background: "#ef4444", color: "white", cursor: "pointer", fontWeight: 600 }}>
          Envoyer
        </button>
      </div>
    )
  }
  return (
    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
      <span style={{ fontSize: 10, color: "#9A8E82" }}>Cette réponse était utile ?</span>
      <button
        onClick={() => { setFeedback(prev => ({ ...prev, [idx]: { vote: 1 } })); saveFeedback(idx, 1) }}
        style={{ background: "none", border: "1px solid #e5e7eb", borderRadius: 8, padding: "2px 8px", fontSize: 13, cursor: "pointer" }}>
        👍
      </button>
      <button
        onClick={() => setFeedback(prev => ({ ...prev, [idx]: { vote: -1, showReason: true } }))}
        style={{ background: "none", border: "1px solid #e5e7eb", borderRadius: 8, padding: "2px 8px", fontSize: 13, cursor: "pointer" }}>
        👎
      </button>
    </div>
  )
}

function ChatBubble({ m, ac }) {
  return (
    <div style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start", alignItems: "flex-end", gap: 6 }}>
      {m.role === "assistant" && (
        <div style={{ width: 24, height: 24, borderRadius: "50%", background: ac + "22", border: `1px solid ${ac}44`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: ac, fontSize: 12 }}>✦</div>
      )}
      <div style={{
        maxWidth: "82%",
        borderRadius: m.role === "user" ? "16px 16px 3px 16px" : "16px 16px 16px 3px",
        padding: "9px 13px", fontSize: 12, lineHeight: 1.55,
        background: m.role === "user" ? "#1A1612" : "white",
        color: m.role === "user" ? "white" : "#2A231C",
        boxShadow: m.role === "assistant" ? "0 1px 4px rgba(0,0,0,.07)" : "none",
        border: m.role === "assistant" ? "1px solid #F0EBE3" : "none",
      }}>
        {m.content.split("\n").map((line, j, arr) => (
          <span key={j}>{line.replace(/\*([^*]+)\*/g, "$1")}{j < arr.length - 1 && <br/>}</span>
        ))}
      </div>
    </div>
  )
}

function QuickStarts({ items, ac, onPick }) {
  return (
    <div style={{ alignSelf: "flex-start", marginLeft: 30, marginTop: 4, maxWidth: "88%", animation: "fadeUp .25s ease both" }}>
      <div style={{ fontSize: 11, color: ac, fontWeight: 700, letterSpacing: ".5px", textTransform: "uppercase", marginBottom: 8, display: "flex", alignItems: "center", gap: 5 }}>
        <span style={{ fontSize: 13 }}>✨</span>
        <span>Démarrage rapide — cliquez pour essayer</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {items.map((q) => (
          <button key={q} onClick={() => onPick(q)}
            style={{
              display: "flex", alignItems: "center", gap: 8,
              background: `linear-gradient(135deg, ${ac}18, ${ac}08)`,
              border: `1px solid ${ac}44`,
              color: "#1A1612",
              borderRadius: 12,
              padding: "11px 14px",
              fontSize: 13,
              fontWeight: 500,
              cursor: "pointer",
              textAlign: "left",
              lineHeight: 1.35,
              width: "100%",
              transition: "background .15s, transform .1s",
            }}
            onMouseOver={e => e.currentTarget.style.background = `linear-gradient(135deg, ${ac}28, ${ac}12)`}
            onMouseOut={e => e.currentTarget.style.background = `linear-gradient(135deg, ${ac}18, ${ac}08)`}>
            <div style={{ flex: 1, color: "#2A231C" }}>{q}</div>
            <span style={{ color: ac, fontSize: 16, flexShrink: 0, fontWeight: 700 }}>→</span>
          </button>
        ))}
      </div>
      <div style={{ fontSize: 11, color: "#9A8E82", marginTop: 8, marginLeft: 4 }}>
        Ou décrivez votre besoin ci-dessous (écrit ou vocal).
      </div>
    </div>
  )
}

function TypingIndicator({ ac }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 6 }}>
      <div style={{ width: 24, height: 24, borderRadius: "50%", background: ac + "22", border: `1px solid ${ac}44`, display: "flex", alignItems: "center", justifyContent: "center", color: ac, fontSize: 12 }}>✦</div>
      <div style={{ background: "white", border: "1px solid #F0EBE3", borderRadius: "16px 16px 16px 3px", padding: "10px 14px", display: "flex", gap: 4, boxShadow: "0 1px 4px rgba(0,0,0,.07)" }}>
        {[0, 140, 280].map(d => <div key={d} style={{ width: 6, height: 6, borderRadius: "50%", background: ac, animation: `bounce 1s ease ${d}ms infinite` }}/>)}
      </div>
    </div>
  )
}

export default function ChatThread({
  chatRef, msgs, feedback, setFeedback, saveFeedback,
  loading, ac, historySummary,
  quickStarts, lignes, send,
  bottomPad = 12,
}) {
  const showQuickStarts = msgs.length === 1 && lignes.length === 0 && !loading && quickStarts.length > 0
  const showTyping      = loading && msgs[msgs.length - 1]?.role !== "assistant"

  return (
    <div ref={chatRef} style={{ flex: 1, overflowY: "auto", paddingTop: 12, paddingLeft: 14, paddingRight: 14, paddingBottom: bottomPad, display: "flex", flexDirection: "column", gap: 8 }}>
      {historySummary && (
        <div title="L'IA utilise vos devis passés pour proposer des tarifs cohérents avec votre historique"
          style={{ alignSelf: "center", display: "flex", alignItems: "center", gap: 6, background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 20, padding: "4px 11px", fontSize: 10, fontWeight: 600, color: "#15803d", marginBottom: 4 }}>
          <svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
          Mémoire active · {historySummary.total} devis · {historySummary.topOuvrages.length} prestations référencées
        </div>
      )}

      {msgs.map((m, i) => {
        const fb = feedback[i] || {}
        return (
          <div key={i}>
            <ChatBubble m={m} ac={ac}/>
            {m.hasDevis && !loading && (
              <div style={{ paddingLeft: 30, marginTop: 4 }}>
                <MessageFeedback idx={i} fb={fb} ac={ac} setFeedback={setFeedback} saveFeedback={saveFeedback}/>
              </div>
            )}
          </div>
        )
      })}

      {showQuickStarts && <QuickStarts items={quickStarts} ac={ac} onPick={send}/>}
      {showTyping      && <TypingIndicator ac={ac}/>}
    </div>
  )
}
