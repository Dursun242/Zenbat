import { useState, useEffect } from "react"
import { supabase } from "../lib/supabase.js"

async function getToken() {
  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token ?? null
}

function formatDate(unix) {
  if (!unix) return "—"
  return new Date(unix * 1000).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })
}

function formatPrice(amount, currency) {
  if (amount == null) return "—"
  const v = (amount / 100).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const c = (currency || "eur").toUpperCase() === "EUR" ? "€" : currency.toUpperCase()
  return `${v} ${c}`
}

const STATUS_LABELS = {
  active:             { text: "Actif",                color: "#16a34a", bg: "#f0fdf4", border: "#bbf7d0" },
  trialing:           { text: "Période d'essai",      color: "#2563eb", bg: "#eff6ff", border: "#bfdbfe" },
  past_due:           { text: "Paiement en retard",   color: "#d97706", bg: "#fffbeb", border: "#fde68a" },
  canceled:           { text: "Annulé",               color: "#dc2626", bg: "#fef2f2", border: "#fecaca" },
  unpaid:             { text: "Impayé",               color: "#dc2626", bg: "#fef2f2", border: "#fecaca" },
  incomplete:         { text: "Paiement incomplet",   color: "#d97706", bg: "#fffbeb", border: "#fde68a" },
  incomplete_expired: { text: "Expiré",               color: "#6b7280", bg: "#f9fafb", border: "#e5e7eb" },
  paused:             { text: "En pause",             color: "#6b7280", bg: "#f9fafb", border: "#e5e7eb" },
}

export default function SubscriptionScreen({ isAdmin, daysLeft, plan, onBack }) {
  const [info,    setInfo]    = useState(null)
  const [loading, setLoading] = useState(!isAdmin && plan === "pro")
  const [error,   setError]   = useState(null)
  const [opening, setOpening] = useState(false)

  useEffect(() => {
    if (isAdmin || plan !== "pro") { setLoading(false); return }
    let cancelled = false
    ;(async () => {
      try {
        const token = await getToken()
        if (!token) throw new Error("Vous devez être connecté.")
        const res  = await fetch("/api/stripe-checkout", {
          method:  "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body:    JSON.stringify({ action: "info" }),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data?.error || `Erreur ${res.status}`)
        if (!cancelled) setInfo(data)
      } catch (e) {
        if (!cancelled) setError(e?.message || "Impossible de charger les informations d'abonnement")
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [isAdmin, plan])

  const openPortal = async () => {
    setOpening(true); setError(null)
    try {
      const token = await getToken()
      if (!token) throw new Error("Vous devez être connecté.")
      const res  = await fetch("/api/stripe-checkout", {
        method:  "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ action: "portal" }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data?.url) throw new Error(data?.error || `Erreur ${res.status}`)
      window.location.href = data.url
    } catch (e) {
      setError(e?.message || "Impossible d'ouvrir le portail Stripe")
      setOpening(false)
    }
  }

  const sub        = info?.subscription
  const statusInfo = sub ? (STATUS_LABELS[sub.status] || { text: sub.status, color: "#6b7280", bg: "#f9fafb", border: "#e5e7eb" }) : null
  const planLabel  = sub?.planLabel === "biannual" ? "Pro · 6 mois" : (sub?.planLabel === "monthly" ? "Pro · Mensuel" : "Pro")

  return (
    <div style={s.wrap}>
      <div style={s.shell}>
        <button onClick={onBack} style={s.back}>← Retour</button>

        <div style={s.brandRow}>
          <div style={s.logo}><span style={{ color: "#22c55e" }}>Zen</span><span style={{ color: "#fff" }}>bat</span></div>
        </div>

        <h1 style={s.title}>Mon abonnement</h1>
        <p style={s.subtitle}>Gérez votre formule, votre moyen de paiement et vos factures.</p>

        {/* ── Cas Admin ─────────────────────────────────── */}
        {isAdmin && (
          <div style={s.card}>
            <div style={s.cardHeader}>
              <span style={{ ...s.badge, background: "rgba(34,197,94,.18)", color: "#86efac", border: "1px solid rgba(34,197,94,.3)" }}>ADMIN</span>
            </div>
            <div style={s.row}><span style={s.label}>Statut</span><span style={s.value}>Pro permanent</span></div>
            <div style={s.row}><span style={s.label}>Facturation</span><span style={s.value}>Aucune — compte administrateur</span></div>
            <div style={s.row}><span style={s.label}>Limite IA</span><span style={s.value}>Illimité</span></div>
            <p style={s.note}>Le compte administrateur a un accès Pro complet sans abonnement Stripe.</p>
          </div>
        )}

        {/* ── Cas plan Pro ──────────────────────────────── */}
        {!isAdmin && plan === "pro" && (
          <>
            {loading && <div style={s.loader}>Chargement de votre abonnement…</div>}

            {!loading && !sub && (
              <div style={s.card}>
                <div style={s.row}><span style={s.label}>Statut</span><span style={s.value}>Pro · abonnement non détecté</span></div>
                <p style={s.note}>
                  Votre profil est marqué « Pro » mais aucun abonnement Stripe n'est associé.
                  Si vous avez payé récemment, le webhook Stripe peut prendre quelques secondes —
                  rechargez la page. Sinon, contactez le support.
                </p>
              </div>
            )}

            {!loading && sub && (
              <div style={s.card}>
                <div style={s.cardHeader}>
                  <span style={{ ...s.badge, background: statusInfo.bg, color: statusInfo.color, border: `1px solid ${statusInfo.border}` }}>
                    {statusInfo.text.toUpperCase()}
                  </span>
                  {sub.cancelAtPeriodEnd && (
                    <span style={{ ...s.badge, background: "#fff7ed", color: "#9a3412", border: "1px solid #fed7aa", marginLeft: 6 }}>
                      ANNULATION PROGRAMMÉE
                    </span>
                  )}
                </div>
                <div style={s.row}><span style={s.label}>Formule</span><span style={s.value}>{planLabel}</span></div>
                <div style={s.row}><span style={s.label}>Montant</span><span style={s.value}>
                  {formatPrice(sub.unitAmount, sub.currency)}
                  {sub.intervalCount && sub.interval && (
                    <span style={s.muted}> · tous les {sub.intervalCount > 1 ? `${sub.intervalCount} ` : ""}{sub.interval === "month" ? "mois" : sub.interval === "year" ? "ans" : sub.interval}</span>
                  )}
                </span></div>
                <div style={s.row}>
                  <span style={s.label}>{sub.cancelAtPeriodEnd ? "Fin d'accès" : "Prochain prélèvement"}</span>
                  <span style={s.value}>{formatDate(sub.currentPeriodEnd)}</span>
                </div>
              </div>
            )}

            <button onClick={openPortal} disabled={opening} style={{ ...s.cta, opacity: opening ? 0.7 : 1, cursor: opening ? "default" : "pointer" }}>
              {opening ? "Ouverture du portail…" : "Gérer mon abonnement"}
            </button>
            <p style={s.help}>
              Vous serez redirigé vers Stripe pour modifier votre moyen de paiement, télécharger vos factures ou annuler votre abonnement.
            </p>
          </>
        )}

        {/* ── Cas free / essai gratuit ─────────────────── */}
        {!isAdmin && plan !== "pro" && (
          <div style={s.card}>
            <div style={s.row}><span style={s.label}>Statut</span><span style={s.value}>Essai gratuit</span></div>
            <div style={s.row}><span style={s.label}>Jours restants</span><span style={s.value}>{daysLeft} jour{daysLeft > 1 ? "s" : ""}</span></div>
            <p style={s.note}>Vous pouvez passer à Pro à tout moment depuis le bouton « Essai · {daysLeft}j » en haut de l'écran.</p>
          </div>
        )}

        {error && <div style={s.error}>{error}</div>}
      </div>
    </div>
  )
}

const s = {
  wrap:   { minHeight: "100vh", background: "#1A1612", padding: "32px 20px", fontFamily: "Inter, system-ui, sans-serif", display: "flex", justifyContent: "center" },
  shell:  { width: "100%", maxWidth: 520 },
  back:   { background: "none", border: "none", color: "#9A8E82", fontSize: 13, cursor: "pointer", marginBottom: 20, padding: 0 },
  brandRow: { marginBottom: 20 },
  logo:   { fontFamily: "'Syne', sans-serif", fontSize: 24, fontWeight: 800, letterSpacing: "-0.5px" },
  title:  { color: "#fff", fontSize: 26, fontWeight: 700, fontFamily: "'Syne', sans-serif", letterSpacing: "-0.3px", marginBottom: 8 },
  subtitle: { color: "#9A8E82", fontSize: 13, marginBottom: 24, lineHeight: 1.6 },
  card:   { background: "#fff", borderRadius: 16, padding: 22, marginBottom: 16, boxShadow: "0 8px 24px rgba(0,0,0,.2)" },
  cardHeader: { marginBottom: 14, display: "flex", alignItems: "center", flexWrap: "wrap", gap: 6 },
  badge:  { display: "inline-block", fontSize: 10, fontWeight: 800, letterSpacing: "0.6px", padding: "4px 10px", borderRadius: 20 },
  row:    { display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "10px 0", borderBottom: "1px solid #F0EBE3", gap: 12 },
  label:  { color: "#9A8E82", fontSize: 12, fontWeight: 500 },
  value:  { color: "#1A1612", fontSize: 13, fontWeight: 600, textAlign: "right" },
  muted:  { color: "#9A8E82", fontWeight: 400 },
  note:   { color: "#6B6358", fontSize: 12, lineHeight: 1.6, marginTop: 12 },
  cta:    { width: "100%", padding: 14, borderRadius: 12, border: "none", background: "#22c55e", color: "#fff", fontSize: 14, fontWeight: 700, marginTop: 4, transition: "background .15s" },
  help:   { color: "#9A8E82", fontSize: 11, textAlign: "center", marginTop: 8, lineHeight: 1.6 },
  loader: { color: "#9A8E82", fontSize: 13, padding: 20, textAlign: "center" },
  error:  { background: "#fef2f2", color: "#991b1b", padding: 12, borderRadius: 10, fontSize: 13, marginTop: 12 },
}
