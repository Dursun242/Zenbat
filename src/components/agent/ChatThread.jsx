// Rendu du fil de discussion de l'Agent IA :
// - bandeau « mémoire active »
// - bulle des messages (user / assistant)
// - barre de feedback (👍 / 👎) sur chaque réponse contenant un devis
// - mini tuto 3 étapes sur le chat vierge
// - indicateur « ... » pendant le streaming
//
// Tout le state vit chez le parent (AgentIA) ; ce composant est purement
// présentationnel : il appelle setFeedback / saveFeedback / send aux moments
// opportuns.

import { useState, useEffect } from "react";

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

function MiniTuto({ ac }) {
  const steps = [
    { n: 1, t: "Décrivez votre besoin",        s: "À l'écrit ou à la voix, dans votre langue." },
    { n: 2, t: "L'IA rédige le devis",         s: "Lignes, quantités, tarifs cohérents avec votre historique." },
    { n: 3, t: "Vous validez et l'envoyez",    s: "PDF prêt, signature client en ligne." },
  ]
  return (
    <div style={{ alignSelf: "flex-start", marginLeft: 30, marginTop: 4, maxWidth: "88%", animation: "fadeUp .25s ease both" }}>
      <div style={{ fontSize: 11, color: ac, fontWeight: 700, letterSpacing: ".5px", textTransform: "uppercase", marginBottom: 10, display: "flex", alignItems: "center", gap: 5 }}>
        <span style={{ fontSize: 13 }}>✨</span>
        <span>Comment ça marche</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {steps.map(({ n, t, s }) => (
          <div key={n} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
            <div style={{
              flexShrink: 0, width: 24, height: 24, borderRadius: "50%",
              background: ac, color: "white",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 12, fontWeight: 800, fontVariantNumeric: "tabular-nums",
            }}>{n}</div>
            <div style={{ flex: 1, paddingTop: 2 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#1A1612", lineHeight: 1.3 }}>{t}</div>
              <div style={{ fontSize: 12, color: "#6B6358", marginTop: 2, lineHeight: 1.4 }}>{s}</div>
            </div>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 12, color: ac, fontWeight: 600, marginTop: 14, marginLeft: 4, display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ fontSize: 14 }}>↓</span>
        <span>Décrivez votre besoin ci-dessous</span>
      </div>
    </div>
  )
}

// Messages rotatifs affichés pendant que l'IA réfléchit — donnent à
// l'utilisateur quelque chose à lire et l'impression que le travail
// progresse, plutôt qu'un curseur abstrait. Honnêtes sur ce que Claude
// fait sous le capot (lecture du contexte historique, génération du
// devis, mise en forme). L'ordre suit grosso modo le pipeline réel.
const TYPING_MESSAGES = [
  "Analyse de votre demande…",
  "Recherche dans vos prestations habituelles…",
  "Calcul des quantités et tarifs cohérents…",
  "Mise en forme du devis…",
  "Vérification de la cohérence des lignes…",
  "Plus que quelques secondes…",
]

function TypingIndicator({ ac }) {
  const [seconds, setSeconds] = useState(0)
  const [msgIdx,  setMsgIdx]  = useState(0)

  useEffect(() => {
    const tick   = setInterval(() => setSeconds(s => s + 1), 1000)
    const rotate = setInterval(() => setMsgIdx(i => i + 1), 2800)
    return () => { clearInterval(tick); clearInterval(rotate) }
  }, [])

  const currentMsg    = TYPING_MESSAGES[Math.min(msgIdx, TYPING_MESSAGES.length - 1)]
  const showStayHint  = seconds >= 8          // Après 8s : message rassurant explicite.
  const showStillHere = seconds >= 18         // Après 18s : on commence à se rapprocher du timeout 28s.

  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 8, animation: "slideIn .3s ease both" }}>
      <div style={{
        width: 28, height: 28, borderRadius: "50%",
        background: ac + "22", border: `1px solid ${ac}44`,
        display: "flex", alignItems: "center", justifyContent: "center",
        color: ac, fontSize: 14, flexShrink: 0,
        animation: "iaPulse 1.8s ease infinite",
      }}>✦</div>

      <div style={{
        background: "white", border: "1px solid #F0EBE3",
        borderRadius: "16px 16px 16px 3px",
        padding: "12px 16px",
        boxShadow: "0 1px 4px rgba(0,0,0,.07)",
        flex: 1, maxWidth: "85%",
      }}>
        {/* Ligne 1 : titre + 3 points bounce historiques (préservés) */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: "#1A1612" }}>Zenbot réfléchit</span>
          <div style={{ display: "flex", gap: 3 }}>
            {[0, 140, 280].map(d => (
              <div key={d} style={{ width: 5, height: 5, borderRadius: "50%", background: ac, animation: `bounce 1s ease ${d}ms infinite` }}/>
            ))}
          </div>
          <span style={{ marginLeft: "auto", fontSize: 10, color: "#9A8E82", fontVariantNumeric: "tabular-nums" }}>
            {seconds}s
          </span>
        </div>

        {/* Ligne 2 : message rotatif — key={currentMsg} force le remount → animation fadeMsg rejouée */}
        <div key={currentMsg} style={{
          fontSize: 12, color: "#6B6358", lineHeight: 1.4,
          animation: "fadeMsg .4s ease both",
        }}>
          {currentMsg}
        </div>

        {/* Barre shimmer = progression "vivante" sans fausse promesse de % */}
        <div style={{ marginTop: 10, height: 3, background: "#F0EBE3", borderRadius: 2, overflow: "hidden" }}>
          <div style={{
            height: "100%", width: "35%",
            background: `linear-gradient(90deg, transparent, ${ac}, transparent)`,
            animation: "shimmer 1.6s linear infinite",
          }}/>
        </div>

        {/* Rassurance progressive — n'apparaît qu'après 8s pour ne pas
            polluer les réponses rapides (~2-3s en mode Haiku). */}
        {showStayHint && (
          <div style={{
            marginTop: 10, fontSize: 11, color: "#9A8E82",
            borderTop: "1px dashed #F0EBE3", paddingTop: 8,
            animation: "fadeMsg .4s ease both",
          }}>
            💡 <b>Ne quittez pas l'application</b> — la génération peut prendre {showStillHere ? "encore quelques secondes" : "jusqu'à 30 secondes"} pour un devis complexe. Votre demande est en cours de traitement.
          </div>
        )}
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
  const showMiniTuto = msgs.length === 1 && lignes.length === 0 && !loading
  const showTyping   = loading && msgs[msgs.length - 1]?.role !== "assistant"

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

      {showMiniTuto && <MiniTuto ac={ac}/>}
      {showTyping   && <TypingIndicator ac={ac}/>}
    </div>
  )
}
