import { useState } from "react"
import { CGU_VERSION } from "./CGU.jsx"
import { supabase } from "../lib/supabase.js"

/**
 * Modale de mise à jour des CGU.
 * À activer dans App.jsx quand cgu_version en base != CGU_VERSION.
 *
 * Utilisation :
 *   {showCguModal && <CguUpdateModal onAccept={...} onRefuse={...}/>}
 */
export default function CguUpdateModal({ onAccept, onRefuse }) {
  const [loading, setLoading] = useState(false)

  const handleAccept = async () => {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      await supabase.from("profiles").update({
        cgu_accepted_at: new Date().toISOString(),
        cgu_version: CGU_VERSION,
      }).eq("id", user.id)
      onAccept?.()
    } catch (err) {
      console.error("[cgu update]", err)
    } finally {
      setLoading(false)
    }
  }

  const handleRefuse = async () => {
    await supabase.auth.signOut()
    onRefuse?.()
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.6)", zIndex: 999, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ background: "#fff", borderRadius: 20, padding: 32, maxWidth: 480, width: "100%", boxShadow: "0 20px 60px rgba(0,0,0,.2)" }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>📋</div>
        <h2 style={{ fontSize: 20, fontWeight: 800, color: "#0f172a", marginBottom: 8 }}>
          Mise à jour des CGU
        </h2>
        <p style={{ fontSize: 14, color: "#64748b", lineHeight: 1.7, marginBottom: 24 }}>
          Nos Conditions Générales d'Utilisation ont été mises à jour (version {CGU_VERSION}).
          Merci de les accepter pour continuer à utiliser Zenbat.
        </p>
        <a href="/cgu" target="_blank" rel="noopener noreferrer"
          style={{ display: "inline-block", color: "#2563eb", fontSize: 13, fontWeight: 600, marginBottom: 24, textDecoration: "underline" }}>
          Lire les nouvelles CGU →
        </a>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={handleRefuse}
            style={{ flex: 1, padding: "12px 0", border: "1px solid #e2e8f0", borderRadius: 12, background: "#fff", color: "#64748b", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
            Refuser & se déconnecter
          </button>
          <button onClick={handleAccept} disabled={loading}
            style={{ flex: 1, padding: "12px 0", border: 0, borderRadius: 12, background: "#0f172a", color: "#fff", fontSize: 14, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.6 : 1 }}>
            {loading ? "Enregistrement…" : "J'accepte"}
          </button>
        </div>
      </div>
    </div>
  )
}
