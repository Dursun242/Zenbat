// Modale festive affichée à la génération du TOUT PREMIER devis du compte.
// One-shot : le flag est stocké dans localStorage pour ne jamais la remontrer.
export default function CelebrateModal({ seconds, fontFamily, ac, onClose, onSave }) {
  return (
    <div onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,.65)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 18, zIndex: 200, animation: "fadeUp .2s ease both" }}>
      <div onClick={e => e.stopPropagation()}
        style={{ background: "white", borderRadius: 20, maxWidth: 380, width: "100%", padding: 24, textAlign: "center", boxShadow: "0 30px 60px rgba(0,0,0,.35)", animation: "popIn .3s cubic-bezier(.34,1.56,.64,1) both" }}>
        <div style={{ fontSize: 56, lineHeight: 1, marginBottom: 8 }}>🎉</div>
        <div style={{ fontSize: 18, fontWeight: 800, color: "#0f172a", fontFamily, marginBottom: 6 }}>
          Votre premier devis est prêt&nbsp;!
        </div>
        {seconds > 0 && (
          <div style={{ fontSize: 12, color: "#64748b", marginBottom: 14 }}>
            Généré en {seconds} seconde{seconds > 1 ? "s" : ""}. Pas mal pour un début 💪
          </div>
        )}
        <div style={{ fontSize: 12, color: "#475569", lineHeight: 1.6, marginBottom: 16 }}>
          Ajustez librement les lignes ci-dessus, puis enregistrez-le. Vous pourrez l'envoyer à votre client en signature ou le télécharger en PDF.
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onClose}
            style={{ flex: 1, background: "#f1f5f9", color: "#374151", border: "none", borderRadius: 12, padding: 11, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
            Continuer
          </button>
          <button onClick={onSave}
            style={{ flex: 2, background: ac, color: "white", border: "none", borderRadius: 12, padding: 11, fontSize: 13, fontWeight: 700, cursor: "pointer", boxShadow: `0 6px 16px ${ac}55` }}>
            ✓ Enregistrer ce devis
          </button>
        </div>
        <div style={{ fontSize: 10, color: "#cbd5e1", marginTop: 12 }}>
          Conseil : complétez SIRET + adresse dans « Mon profil » pour un PDF 100% pro.
        </div>
      </div>
    </div>
  );
}
