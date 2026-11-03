import { useState, useEffect } from "react"
import { supabase } from "../lib/supabase.js"
import { ZB, NUM } from "../lib/theme.js"
import { btnPrimary, btnSecondary } from "../components/ui/Register.jsx"

async function getToken() {
  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token ?? null
}

function formatDate(iso) {
  if (!iso) return "—"
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })
}

function formatEur(eur) {
  if (eur == null) return "—"
  return `${eur.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`
}

const daysUntil = (iso) => iso ? Math.ceil((new Date(iso) - Date.now()) / 86400000) : null

const PLAN_LABEL = { biannual: "Pro · 6 mois", monthly: "Pro · Mensuel" }
const INVOICE_STATUS = { paid: "Payée", open: "À régler", void: "Annulée", uncollectible: "Impayée" }

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

export default function SubscriptionScreen({ isAdmin, plan, onBack, onUpgrade }) {
  const [info,    setInfo]    = useState(null)
  const [loading, setLoading] = useState(!isAdmin)
  const [error,   setError]   = useState(null)
  const [opening, setOpening] = useState(false)

  useEffect(() => {
    // Aussi en gratuit : un ancien Pro doit retrouver ses factures.
    if (isAdmin) { setLoading(false); return }
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
  const invoices   = info?.invoices || []
  const history    = info?.history  || []
  const statusInfo = sub ? (STATUS_LABELS[sub.status] || { text: sub.status, color: ZB.ink3 }) : null
  const planLabel  = PLAN_LABEL[sub?.plan] || "Pro"
  const ending     = sub?.ends_at ? daysUntil(sub.ends_at) : null
  const proUntil   = info?.proUntil || null
  const hasStripe  = !!sub || invoices.length > 0
  const isPro      = plan === "pro"

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

        {!isAdmin && loading && <div style={s.loader}>Chargement de ton abonnement…</div>}

        {/* ── Abonnement Stripe (en cours ou dernier en date) ── */}
        {!isAdmin && !loading && sub && (sub.ends_at || sub.renews_at || isPro) && (
          <div style={s.card}>
            <div style={s.cardHeader}>
              <Stamp color={statusInfo.color}>{statusInfo.text.toUpperCase()}</Stamp>
              {sub.ends_at && (
                <Stamp color={ZB.ink2}>{sub.plan === "biannual" ? "SANS RENOUVELLEMENT" : "ANNULATION PROGRAMMÉE"}</Stamp>
              )}
            </div>
            <div style={s.row}><span style={s.label}>Formule</span><span style={s.value}>{planLabel}</span></div>
            <div style={s.row}><span style={s.label}>Montant</span><span style={{ ...s.value, ...NUM }}>
              {formatEur(sub.amount_eur)}
              {sub.interval === "month" && (
                <span style={s.muted}> · {sub.interval_count > 1 ? `pour ${sub.interval_count} mois` : "par mois"}</span>
              )}
            </span></div>
            <div style={s.row}><span style={s.label}>Souscrit le</span><span style={{ ...s.value, ...NUM }}>{formatDate(sub.started_at)}</span></div>
            {sub.current_period_start && (
              <div style={s.row}><span style={s.label}>Période en cours</span><span style={{ ...s.value, ...NUM }}>
                {formatDate(sub.current_period_start)} → {formatDate(sub.current_period_end)}
              </span></div>
            )}
            {sub.ends_at && (
              <div style={s.row}><span style={s.label}>Fin de l'accès Pro</span><span style={{ ...s.value, ...NUM }}>
                {formatDate(sub.ends_at)}
                {ending >= 0 && <span style={s.muted}> · {ending === 0 ? "aujourd'hui" : `dans ${ending} j`}</span>}
              </span></div>
            )}
            {sub.renews_at && (
              <div style={s.row}><span style={s.label}>Prochain prélèvement</span><span style={{ ...s.value, ...NUM }}>{formatDate(sub.renews_at)}</span></div>
            )}
            {sub.ends_at && ending !== null && ending <= 30 && (
              <p style={s.warn}>
                Ton accès Pro se termine le {formatDate(sub.ends_at)}. Ensuite ton compte repasse en gratuit :
                tes devis, factures et clients restent là. Tu pourras reprendre un abonnement depuis cet écran.
              </p>
            )}
          </div>
        )}

        {/* ── Pro offert (essai daté) ── */}
        {!isAdmin && !loading && isPro && !sub?.renews_at && !sub?.ends_at && proUntil && (
          <div style={s.card}>
            <div style={s.cardHeader}><Stamp color={ZB.stamp}>PRO OFFERT</Stamp></div>
            <div style={s.row}><span style={s.label}>Accès Pro jusqu'au</span><span style={{ ...s.value, ...NUM }}>{formatDate(proUntil)}</span></div>
            <p style={s.note}>Aucun paiement : à cette date ton compte repasse en gratuit, sauf si tu t'abonnes d'ici là.</p>
          </div>
        )}

        {/* ── Pro sans abonnement ni essai ── */}
        {!isAdmin && !loading && isPro && !sub && !proUntil && !error && (
          <div style={s.card}>
            <div style={s.row}><span style={s.label}>Statut</span><span style={s.value}>Pro · abonnement non détecté</span></div>
            <p style={s.note}>
              Ton profil est marqué « Pro » mais aucun abonnement Stripe n'est associé.
              Si tu as payé récemment, le webhook Stripe peut prendre quelques secondes —
              recharge la page. Sinon, contacte le support.
            </p>
          </div>
        )}

        {/* ── Gratuit ── */}
        {!isAdmin && !loading && !isPro && (
          <div style={s.card}>
            <div style={s.row}><span style={s.label}>Statut</span><span style={s.value}>Freemium (gratuit à vie)</span></div>
            <div style={s.row}><span style={s.label}>Quota</span><span style={s.value}>5 devis par semaine</span></div>
            <p style={s.note}>Le compteur repart à zéro chaque lundi. Passe Pro pour des devis illimités et l'accès aux factures.</p>
          </div>
        )}

        {/* ── Action principale ── */}
        {!isAdmin && !loading && isPro && hasStripe && (
          <>
            <button onClick={openPortal} disabled={opening} className="zb-sub-cta" style={{ ...s.cta, opacity: opening ? 0.7 : 1, cursor: opening ? "default" : "pointer" }}>
              {opening ? "Ouverture du portail…" : "Gérer mon abonnement"}
            </button>
            <p style={s.help}>Sur Stripe : moyen de paiement, coordonnées de facturation, résiliation.</p>
          </>
        )}
        {!isAdmin && !loading && !isPro && onUpgrade && (
          <button onClick={onUpgrade} className="zb-sub-cta" style={s.cta}>Passer Pro</button>
        )}

        {/* ── Factures Stripe ── */}
        {!isAdmin && !loading && invoices.length > 0 && (
          <section style={{ marginTop: 24 }}>
            <h2 style={s.h2}>Mes factures Zenbat</h2>
            <div style={s.card}>
              {invoices.map(inv => (
                <div key={inv.id} style={s.invRow}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ ...s.value, textAlign: "left", ...NUM }}>{formatDate(inv.created_at)} · {formatEur(inv.total_eur)}</div>
                    <div style={{ color: ZB.ink2, fontSize: 13, ...NUM }}>
                      {inv.number || "Facture"} · <span style={{ color: inv.status === "paid" ? ZB.stamp : inv.status === "open" ? ZB.danger : ZB.ink2 }}>{INVOICE_STATUS[inv.status] || inv.status}</span>
                    </div>
                  </div>
                  {inv.invoice_pdf && (
                    <a href={inv.invoice_pdf} target="_blank" rel="noopener noreferrer" style={s.invBtn}
                      aria-label={`Télécharger la facture ${inv.number || ""} en PDF`}>PDF</a>
                  )}
                  {inv.status === "open" && inv.hosted_invoice_url && (
                    <a href={inv.hosted_invoice_url} target="_blank" rel="noopener noreferrer" style={s.invBtn}>Régler</a>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── Abonnements précédents ── */}
        {!isAdmin && !loading && history.length > 0 && (
          <section style={{ marginTop: 8 }}>
            <h2 style={s.h2}>Abonnements précédents</h2>
            <div style={s.card}>
              {history.map(h => (
                <div key={h.id} style={s.row}>
                  <span style={s.label}>{PLAN_LABEL[h.plan] || "Pro"}</span>
                  <span style={{ ...s.value, ...NUM }}>
                    {formatDate(h.started_at)} → {formatDate(h.ended_at || h.ends_at || h.current_period_end)}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Portail aussi pour un ancien Pro (factures, coordonnées). */}
        {!isAdmin && !loading && !isPro && hasStripe && (
          <button onClick={openPortal} disabled={opening} style={{ ...btnSecondary, width: "100%", marginTop: 8, opacity: opening ? 0.7 : 1 }}>
            {opening ? "Ouverture du portail…" : "Espace de facturation Stripe"}
          </button>
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
  warn:   { background: ZB.warnSoft, color: ZB.warn, fontSize: 14, lineHeight: 1.5, margin: "12px 0 0", padding: "10px 12px", borderRadius: 6 },
  h2:     { color: ZB.ink, fontSize: 16, fontWeight: 700, margin: "0 0 8px" },
  invRow: { display: "flex", alignItems: "center", gap: 8, minHeight: 56, padding: "8px 0", borderBottom: `1px solid ${ZB.ruleSoft}` },
  invBtn: { ...btnSecondary, minHeight: 44, padding: "0 14px", fontSize: 14, textDecoration: "none", flexShrink: 0 },
  error:  { background: ZB.dangerSoft, color: ZB.danger, border: `1px solid ${ZB.danger}`, padding: 12, borderRadius: 8, fontSize: 14, marginTop: 12 },
}
