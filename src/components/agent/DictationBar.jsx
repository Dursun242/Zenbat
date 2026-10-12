// Barre de dictée permanente de l'Agent IA (collée au-dessus de la barre du
// bas, ou du clavier quand il est ouvert).
//
// - Note de l'IA : sa dernière réponse en une note courte, l'historique
//   complet s'ouvre d'un appui.
// - Micro : un appui démarre la dictée, un second l'arrête ET envoie
//   (géré par AgentIA via onMicTap).
// - Langue de dictée : bouton compact, liste au-dessus.
import { forwardRef, useEffect, useState } from "react";
import { ZB, NUM } from "../../lib/theme.js";
import { RichText } from "./ChatThread.jsx";

const MicIcon = (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0 0 14 0M12 17v5M8 22h8"/>
  </svg>
);
const StopIcon = <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>;
const SendIcon = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 19V5M5 12l7-7 7 7"/>
  </svg>
);
const ThumbUp = <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 10v11H4a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1h3zm0 0 4-7a2.5 2.5 0 0 1 3 2.6L13.5 10H19a2 2 0 0 1 2 2.3l-1.2 7A2 2 0 0 1 17.8 21H7"/></svg>;
const ThumbDown = <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M17 14V3h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-3zm0 0-4 7a2.5 2.5 0 0 1-3-2.6l.5-4.4H5a2 2 0 0 1-2-2.3l1.2-7A2 2 0 0 1 6.2 3H17"/></svg>;

function Elapsed() {
  const [s, setS] = useState(0);
  useEffect(() => { const t = setInterval(() => setS(x => x + 1), 1000); return () => clearInterval(t); }, []);
  return <span style={{ color: ZB.ink3, ...NUM }}>{s} s</span>;
}

function Note({ note, loading, onOpenHistory, feedback, onVote }) {
  if (loading) {
    return (
      <div role="status" style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 2px 10px", fontSize: 14, color: ZB.ink2 }}>
        <span className="zb-pen" aria-hidden="true"/>
        <span style={{ flex: 1 }}>Zenbat rédige ton devis…</span>
        <Elapsed/>
      </div>
    );
  }
  if (!note) return null;
  const error = !!note.error;
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "0 2px 10px" }}>
      <div role={error ? "alert" : "status"} style={{ flex: 1, minWidth: 0, fontSize: 14, lineHeight: 1.45, color: error ? ZB.danger : ZB.ink2,
        display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
        <RichText text={note.content}/>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 2, flexShrink: 0 }}>
        {note.hasDevis && !feedback?.saved && !feedback?.showReason && (
          <>
            <button type="button" onClick={() => onVote(1)} aria-label="Réponse utile"
              style={{ width: 44, height: 44, display: "grid", placeItems: "center", background: "none", border: "none", color: ZB.ink2, cursor: "pointer" }}>{ThumbUp}</button>
            <button type="button" onClick={() => onVote(-1)} aria-label="Réponse à améliorer"
              style={{ width: 44, height: 44, display: "grid", placeItems: "center", background: "none", border: "none", color: ZB.ink2, cursor: "pointer" }}>{ThumbDown}</button>
          </>
        )}
        {feedback?.saved && <span style={{ fontSize: 13, color: ZB.stamp, padding: "0 6px" }}>Merci</span>}
        <button type="button" onClick={onOpenHistory}
          style={{ minHeight: 44, padding: "0 6px", background: "none", border: "none", color: ZB.accent, fontFamily: "inherit", fontSize: 14, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>
          Historique
        </button>
      </div>
    </div>
  );
}

const DictationBar = forwardRef(function DictationBar({
  bottom, inputRef, input, setInput, onSend, loading,
  micActive, listening, connecting, micSupported, micError, onMicTap,
  currentLang, langs, langMenu, setLangMenu, pickLang,
  note, feedback, onVote, onOpenHistory,
}, ref) {
  const canSend = !!input.trim() && !loading;
  const status = loading ? "Le devis s'écrit, tu peux continuer à dicter juste après."
    : connecting ? "Connexion au micro…"
    : listening ? "Je t'écoute. Appuie sur le carré pour envoyer."
    : micSupported ? "Appuie sur le micro et décris tes travaux, dans ta langue."
    : "Dictée indisponible sur ce navigateur : écris tes travaux.";
  return (
    <div ref={ref} className="agent-input-bar" style={{
      position: "fixed", left: 0, right: 0, bottom, zIndex: 30,
      padding: "12px 14px 12px", background: ZB.paper, borderTop: `1px solid ${ZB.rule}`,
      transition: "bottom .22s ease", fontFamily: ZB.font,
    }}>
      <style>{`
        @keyframes zbRec { 0% { box-shadow: 0 0 0 0 rgba(180,35,24,.45); } 100% { box-shadow: 0 0 0 14px rgba(180,35,24,0); } }
        @keyframes zbPen { 0% { transform: scaleX(.15); } 50% { transform: scaleX(1); } 100% { transform: scaleX(.15); } }
        .zb-pen { width: 22px; height: 2px; background: ${ZB.accent}; transform-origin: left; animation: zbPen 1.2s ease-in-out infinite; flex-shrink: 0; }
        .agent-input-bar button:focus-visible, .agent-input-bar textarea:focus-visible { outline: 2px solid ${ZB.accent}; outline-offset: 2px; }
        .zb-dict-field:focus-within { border-color: ${ZB.accent} !important; }
        .zb-dict-field textarea::placeholder { color: ${ZB.ink3}; opacity: 1; }
        @media (prefers-reduced-motion: reduce) { .zb-pen, .zb-mic-rec { animation: none !important; } }
      `}</style>

      <div style={{ maxWidth: 760, margin: "0 auto" }}>
        <Note note={note} loading={loading} onOpenHistory={onOpenHistory} feedback={feedback} onVote={onVote}/>

        <div style={{ display: "flex", alignItems: "flex-end", gap: 10, position: "relative" }}>
          <button type="button" onClick={() => setLangMenu(v => !v)}
            aria-haspopup="listbox" aria-expanded={langMenu} aria-label={`Langue de dictée : ${currentLang.label}`}
            style={{ width: 48, height: 48, flexShrink: 0, borderRadius: 10, border: `1px solid ${ZB.rule}`, background: ZB.sheet,
              color: ZB.ink, fontFamily: "inherit", fontSize: 14, fontWeight: 700, cursor: "pointer", letterSpacing: ".02em" }}>
            {currentLang.code.slice(0, 2).toUpperCase()}
          </button>

          <div className="zb-dict-field" style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "flex-end", gap: 6, minHeight: 48, padding: "1px 1px 1px 12px",
            borderRadius: 10, border: `1px solid ${micActive ? ZB.danger : ZB.field}`, background: ZB.sheet, boxSizing: "border-box" }}>
            <label htmlFor="zb-dictation" className="zb-sr">Décris tes travaux</label>
            <textarea id="zb-dictation" ref={inputRef} value={input} rows={1}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSend(); } }}
              placeholder={listening ? "Je t'écoute…" : "Décris tes travaux…"}
              style={{ flex: 1, minWidth: 0, width: "100%", alignSelf: "center", padding: "8px 0", border: "none", outline: "none", resize: "none", background: "none",
                fontFamily: "inherit", fontSize: 16, lineHeight: 1.4, color: ZB.ink, maxHeight: 120, overflowY: "auto" }}/>
            {canSend && (
              // Cible de 44 px (le champ fait 48 px) ; le carré encre visible reste à 40 px.
              <button type="button" onClick={onSend} aria-label="Envoyer"
                style={{ width: 44, height: 44, flexShrink: 0, display: "grid", placeItems: "center", padding: 0, border: "none", background: "none", cursor: "pointer" }}>
                <span style={{ width: 40, height: 40, display: "grid", placeItems: "center", borderRadius: 8, background: ZB.ink, color: ZB.paper }}>{SendIcon}</span>
              </button>
            )}
          </div>

          <button type="button" onClick={onMicTap} disabled={!micSupported || loading}
            className={micActive ? "zb-mic-rec" : undefined}
            aria-label={micActive ? "Arrêter la dictée et envoyer" : "Dicter"}
            aria-pressed={micActive}
            style={{ width: 56, height: 56, flexShrink: 0, borderRadius: "50%", border: "none", display: "grid", placeItems: "center",
              background: !micSupported || loading ? ZB.rule : micActive ? ZB.danger : ZB.accent, color: "#fff",
              cursor: !micSupported || loading ? "not-allowed" : "pointer",
              animation: listening ? "zbRec 1.3s ease-out infinite" : "none", opacity: connecting ? 0.85 : 1 }}>
            {micActive ? StopIcon : MicIcon}
          </button>

          {langMenu && (
            <>
              <div onClick={() => setLangMenu(false)} style={{ position: "fixed", inset: 0, zIndex: 40 }}/>
              <div role="listbox" aria-label="Langue de dictée" style={{ position: "absolute", bottom: "calc(100% + 8px)", left: 0, zIndex: 41,
                minWidth: 200, maxHeight: 300, overflowY: "auto", padding: 4, background: ZB.sheet, border: `1px solid ${ZB.rule}`,
                borderRadius: 10, boxShadow: "0 10px 30px rgba(26,22,18,.16)" }}>
                {langs.map(l => {
                  const on = l.code === currentLang.code;
                  return (
                    <button key={l.code} type="button" role="option" aria-selected={on} onClick={() => pickLang(l.code)}
                      style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", minHeight: 44, padding: "0 10px", border: "none",
                        borderRadius: 8, background: on ? ZB.accentSoft : "none", color: ZB.ink, fontFamily: "inherit", fontSize: 15,
                        fontWeight: on ? 700 : 500, cursor: "pointer", textAlign: "left" }}>
                      <span style={{ width: 28, fontSize: 13, fontWeight: 700, color: ZB.ink2 }}>{l.code.slice(0, 2).toUpperCase()}</span>
                      <span>{l.label}</span>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>

        <div aria-live="polite" style={{ marginTop: 8, fontSize: 13, color: micError ? ZB.danger : micActive ? ZB.danger : ZB.ink2, textAlign: "center" }}>
          {micError || status}
        </div>
      </div>
    </div>
  );
});

export default DictationBar;
