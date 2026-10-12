import { useState, useEffect } from "react"
import { supabase } from "../lib/supabase.js"
import { ZB, NUM } from "../lib/theme.js"
import { btnPrimary } from "../components/ui/Register.jsx"

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

// Tons des statuts (même code que les tampons) : vert tampon pour ce qui est
// acquis, rouge pour un problème de paiement, encre sinon.
const STATUS_LABELS = {
  active:             { text: "Actif",                color: ZB.stamp },
  trialing:           { text: "Période d'essai",      color: ZB.ink2 },
  past_due:           { text: "Paiement en retard",   color: ZB.danger },
  canceled:           { text: "Annulé",               color: ZB.ink3 },
  unpaid:             { text: "Impayé",               color: ZB.danger },
  incomplete:         { text: "Paiement incomplet",   color: ZB.danger },
  incomplete_expired: { text: "Expiré",               color: ZB.ink3 },
  paused:             { text: "En pause",             color: ZB.ink3 },
}

const BACK = <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>

function Stamp({ color, children }) {
  return <span style={{ ...s.badge, color, borderColor: color }}>{children}</span>
}

export default function SubscriptionScreen({ isAdmin, plan, billingCycle, onBack }) {
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
        if (!token) throw new Error("Tu dois être connecté.")
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
      if (!token) throw new Error("Tu dois être connecté.")
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
  const statusInfo = sub ? (STATUS_LABELS[sub.status] || { text: sub.status, color: ZB.ink3 }) : null
  const planLabel  = sub?.planLabel === "biannual" ? "Pro · 6 mois" : (sub?.planLabel === "monthly" ? "Pro · Mensuel" : "Pro")

  return (
    <div className="zb-sub" style={s.wrap}>
      <div style={s.shell}>
        <style>{`.zb-sub button:focus-visible { outline: 2px solid ${ZB.accent}; outline-offset: 2px; } @media (hover: hover) { .zb-sub .zb-sub-cta:not(:disabled):hover { background: var(--zb-accent-hover) !important; } }`}</style>
        <button onClick={onBack} style={s.back}>{BACK}Retour</button>

        <div style={s.brandRow}>
          <div style={s.logo}><span style={{ color: ZB.accent }}>Zen</span><span style={{ color: ZB.ink }}>bat</span></div>
        </div>

        <h1 style={s.title}>Mon abonnement</h1>
        <p style={s.subtitle}>Gère ta formule, ton moyen de paiement et tes factures.</p>

        {/* ── Cas Admin ─────────────────────────────────── */}
        {isAdmin && (
          <div style={s.card}>
            <div style={s.cardHeader}>
              <Stamp color={ZB.ink}>ADMIN</Stamp>
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
            {loading && <div style={s.loader}>Chargement de ton abonnement…</div>}

            {!loading && !sub && (
              <div style={s.card}>
                <div style={s.row}><span style={s.label}>Statut</span><span style={s.value}>Pro · abonnement non détecté</span></div>
                <p style={s.note}>
                  Ton profil est marqué « Pro » mais aucun abonnement Stripe n'est associé.
                  Si tu as payé récemment, le webhook Stripe peut prendre quelques secondes —
                  recharge la page. Sinon, contacte le support.
                </p>
              </div>
            )}

            {!loading && sub && (
              <div style={s.card}>
                <div style={s.cardHeader}>
                  <Stamp color={statusInfo.color}>
                    {statusInfo.text.toUpperCase()}
                  </Stamp>
                  {sub.cancelAtPeriodEnd && (
                    <Stamp color={ZB.ink2}>
                      ANNULATION PROGRAMMÉE
                    </Stamp>
                  )}
                </div>
                <div style={s.row}><span style={s.label}>Formule</span><span style={s.value}>{planLabel}</span></div>
                <div style={s.row}><span style={s.label}>Montant</span><span style={{ ...s.value, ...NUM }}>
                  {formatPrice(sub.unitAmount, sub.currency)}
                  {sub.intervalCount && sub.interval && (
                    <span style={s.muted}> · tous les {sub.intervalCount > 1 ? `${sub.intervalCount} ` : ""}{sub.interval === "month" ? "mois" : sub.interval === "year" ? "ans" : sub.interval}</span>
                  )}
                </span></div>
                <div style={s.row}>
                  <span style={s.label}>{sub.cancelAtPeriodEnd ? "Fin d'accès" : "Prochain prélèvement"}</span>
                  <span style={{ ...s.value, ...NUM }}>{formatDate(sub.currentPeriodEnd)}</span>
                </div>
              </div>
            )}

            <button onClick={openPortal} disabled={opening} className="zb-sub-cta" style={{ ...s.cta, opacity: opening ? 0.7 : 1, cursor: opening ? "default" : "pointer" }}>
              {opening ? "Ouverture du portail…" : "Gérer mon abonnement"}
            </button>
            <p style={s.help}>
              Tu seras redirigé vers Stripe pour modifier ton moyen de paiement, télécharger tes factures ou annuler ton abonnement.
            </p>
          </>
        )}

        {/* ── Cas freemium permanent ───────────────────── */}
        {!isAdmin && plan !== "pro" && (
          <div style={s.card}>
            <div style={s.row}><span style={s.label}>Statut</span><span style={s.value}>Freemium (gratuit à vie)</span></div>
            <div style={s.row}><span style={s.label}>Quota</span><span style={s.value}>5 devis par semaine</span></div>
            <p style={s.note}>Le compteur repart à zéro chaque lundi. Passe Pro pour des devis illimités et l'accès aux factures.</p>
          </div>
        )}

        {error && <div role="alert" style={s.error}>{error}</div>}
      </div>
    </div>
  )
}

const s = {
  wrap:   { minHeight: "100vh", background: ZB.paper, color: ZB.ink, padding: "16px 16px 32px", fontFamily: ZB.font, display: "flex", justifyContent: "center" },
  shell:  { width: "100%", maxWidth: 520 },
  back:   { display: "inline-flex", alignItems: "center", gap: 4, minHeight: 44, background: "none", border: "none", color: ZB.ink2, fontFamily: "inherit", fontSize: 15, fontWeight: 600, cursor: "pointer", margin: "0 0 12px -8px", padding: "0 8px" },
  brandRow: { marginBottom: 16 },
  logo:   { fontSize: 24, fontWeight: 800, letterSpacing: "-0.5px" },
  title:  { color: ZB.ink, fontSize: 21, fontWeight: 700, lineHeight: 1.25, margin: "0 0 6px" },
  subtitle: { color: ZB.ink2, fontSize: 15, margin: "0 0 18px", lineHeight: 1.45 },
  card:   { background: ZB.sheet, border: `1px solid ${ZB.rule}`, borderRadius: 8, padding: "6px 16px 14px", marginBottom: 16 },
  cardHeader: { padding: "10px 0", display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8, borderBottom: `2px solid ${ZB.ink}` },
  badge:  { display: "inline-block", fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", padding: "2px 7px", borderRadius: 3, border: "1px solid currentColor" },
  row:    { display: "flex", justifyContent: "space-between", alignItems: "baseline", minHeight: 44, padding: "12px 0", borderBottom: `1px solid ${ZB.ruleSoft}`, gap: 12 },
  label:  { color: ZB.ink2, fontSize: 14, fontWeight: 600 },
  value:  { color: ZB.ink, fontSize: 15, fontWeight: 600, textAlign: "right" },
  muted:  { color: ZB.ink2, fontWeight: 500 },
  note:   { color: ZB.ink2, fontSize: 14, lineHeight: 1.5, margin: "12px 0 0" },
  cta:    { ...btnPrimary, width: "100%", minHeight: 52, fontSize: 16, marginTop: 4 },
  help:   { color: ZB.ink2, fontSize: 13, textAlign: "center", margin: "8px 0 0", lineHeight: 1.5 },
  loader: { color: ZB.ink2, fontSize: 15, padding: 20, textAlign: "center" },
  error:  { background: ZB.dangerSoft, color: ZB.danger, border: `1px solid ${ZB.danger}`, padding: 12, borderRadius: 8, fontSize: 14, marginTop: 12 },
}
