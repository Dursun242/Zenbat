import { useState, useEffect, useCallback } from "react"
import { ZB, NUM } from "../lib/theme.js"
import { btnPrimary, btnSecondary } from "../components/ui/Register.jsx"
import { pdp, PDP_RETURN_MESSAGES } from "../lib/pdp.js"

// Facturation électronique — étape 1 de l'intégration Super PDP : l'artisan
// relie son compte Super PDP (plateforme agréée) et reçoit ici ses factures
// fournisseurs (obligation de réception depuis le 01/09/2026).

const BACK = <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>

// Ce que l'artisan (acheteur) peut répondre au fournisseur.
const ACTIONS = [
  { code: "fr:204", label: "Prise en charge",  confirm: "Indiquer au fournisseur que tu traites sa facture ?" },
  { code: "fr:205", label: "Approuver",        confirm: "Approuver cette facture ? Le fournisseur en est informé." },
  { code: "fr:211", label: "Paiement envoyé",  confirm: "Indiquer au fournisseur que le paiement est parti ?" },
  { code: "fr:207", label: "En litige",        confirm: "Signaler un litige au fournisseur ?" },
  { code: "fr:210", label: "Refuser",          confirm: "Refuser cette facture ? Le refus est transmis au fournisseur.", danger: true },
]

const ENV_LABEL = { sandbox: "Bac à sable (test)", production: "Production" }
const VERIF_LABEL = { verified: "Vérifiée", needs_review: "En cours de vérification", failed: "Vérification refusée" }

function formatDate(d) {
  if (!d) return "—"
  return new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })
}
function formatEur(n, currency = "EUR") {
  if (n == null) return "—"
  return n.toLocaleString("fr-FR", { style: "currency", currency: currency || "EUR" })
}

export default function EInvoicingScreen({ onBack, returnStatus = null }) {
  const [status,  setStatus]  = useState(null)
  const [loading, setLoading] = useState(true)
  const [busy,    setBusy]    = useState(false)
  const [error,   setError]   = useState(null)
  const [inbox,   setInbox]   = useState(null)   // { invoices, has_after }
  const [inboxLoading, setInboxLoading] = useState(false)
  const flash = returnStatus ? PDP_RETURN_MESSAGES[returnStatus] : null

  const handleErr = (e) => {
    if (e?.code === "reconnect" || e?.code === "not_connected") {
      setStatus(s => s ? { ...s, connected: false, account: null } : s)
      setInbox(null)
    }
    setError(e?.message || "Erreur Super PDP")
  }

  const loadInbox = useCallback(async (after = null) => {
    setInboxLoading(true); setError(null)
    try {
      const data = await pdp.inbox(after)
      setInbox(prev => after && prev ? { invoices: [...prev.invoices, ...data.invoices], has_after: data.has_after } : data)
    } catch (e) { handleErr(e) }
    finally { setInboxLoading(false) }
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const s = await pdp.status()
        if (cancelled) return
        setStatus(s)
        if (s.connected) loadInbox()
      } catch (e) { if (!cancelled) setError(e?.message || "Impossible de lire l'état de la connexion") }
      finally { if (!cancelled) setLoading(false) }
    })()
    return () => { cancelled = true }
  }, [loadInbox])

  const connect = async () => {
    setBusy(true); setError(null)
    try { await pdp.connect() } catch (e) { setError(e?.message); setBusy(false) }
  }
  const disconnect = async () => {
    if (!window.confirm("Déconnecter ton compte Super PDP de Zenbat ? Tes factures restent sur Super PDP.")) return
    setBusy(true); setError(null)
    try { await pdp.disconnect(); setStatus(s => ({ ...s, connected: false, account: null })); setInbox(null) }
    catch (e) { setError(e?.message) }
    finally { setBusy(false) }
  }

  const acc = status?.account

  return (
    <div className="zb-einv" style={s.wrap}>
      <div style={s.shell}>
        <style>{`.zb-einv button:focus-visible, .zb-einv a:focus-visible { outline: 2px solid ${ZB.accent}; outline-offset: 2px; }`}</style>
        <button onClick={onBack} style={s.back}>{BACK}Retour</button>

        <h1 style={s.title}>Factures reçues</h1>
        <p style={s.subtitle}>
          Depuis le 1ᵉʳ septembre 2026, tes fournisseurs t'envoient leurs factures par une plateforme agréée.
          Relie ton compte Super PDP pour les recevoir et y répondre ici.
        </p>

        {flash && (
          <div role="status" style={flash.ok ? s.ok : s.error}>{flash.text}</div>
        )}

        {loading && <div style={s.loader}>Chargement…</div>}

        {!loading && status && !status.configured && (
          <div style={s.card}>
            <p style={s.note}>La connexion à Super PDP n'est pas encore ouverte sur Zenbat. Elle arrive très bientôt.</p>
          </div>
        )}

        {!loading && status?.configured && !status.connected && (
          <div style={s.card}>
            <div style={s.cardHeader}><span style={s.stampMuted}>NON CONNECTÉ</span></div>
            <p style={s.note}>
              Tu vas être redirigé vers Super PDP pour autoriser Zenbat. Zenbat ne voit jamais ton mot de passe
              et agit uniquement au nom de ton entreprise.
            </p>
            <p style={s.note}>Pas encore de compte ? Crée-le sur Super PDP avec ton SIREN, puis reviens ici.</p>
            <button onClick={connect} disabled={busy} style={{ ...s.cta, opacity: busy ? 0.7 : 1 }}>
              {busy ? "Redirection…" : "Connecter mon compte Super PDP"}
            </button>
          </div>
        )}

        {!loading && status?.connected && acc && (
          <div style={s.card}>
            <div style={s.cardHeader}>
              <span style={{ ...s.stamp, color: ZB.stamp }}>CONNECTÉ</span>
              {acc.env === "sandbox" && <span style={{ ...s.stamp, color: ZB.warn }}>TEST</span>}
            </div>
            <div style={s.row}><span style={s.label}>Entreprise</span><span style={s.value}>{acc.company_name || "—"}</span></div>
            <div style={s.row}><span style={s.label}>SIREN</span><span style={{ ...s.value, ...NUM }}>{acc.siren || "—"}</span></div>
            {acc.env && <div style={s.row}><span style={s.label}>Environnement</span><span style={s.value}>{ENV_LABEL[acc.env] || acc.env}</span></div>}
            {acc.verification_status && (
              <div style={s.row}><span style={s.label}>Vérification</span><span style={s.value}>{VERIF_LABEL[acc.verification_status] || acc.verification_status}</span></div>
            )}
            <button onClick={disconnect} disabled={busy} style={s.linkBtn}>Déconnecter</button>
          </div>
        )}

        {status?.connected && (
          <section style={{ marginTop: 8 }}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
              <h2 style={s.h2}>Factures de tes fournisseurs</h2>
              <button onClick={() => loadInbox()} disabled={inboxLoading} style={s.linkBtn}>Actualiser</button>
            </div>
            {inboxLoading && !inbox && <div style={s.loader}>Chargement des factures…</div>}
            {inbox && inbox.invoices.length === 0 && (
              <div style={s.card}><p style={s.note}>Aucune facture reçue pour l'instant.</p></div>
            )}
            {inbox && inbox.invoices.length > 0 && (
              <div style={{ ...s.card, padding: "0 16px" }}>
                {inbox.invoices.map(inv => (
                  <ReceivedRow key={inv.id} inv={inv} onError={handleErr}
                    onUpdated={(patch) => setInbox(p => ({ ...p, invoices: p.invoices.map(x => x.id === inv.id ? { ...x, ...patch } : x) }))}/>
                ))}
              </div>
            )}
            {inbox?.has_after && (
              <button onClick={() => loadInbox(inbox.invoices[inbox.invoices.length - 1]?.id)} disabled={inboxLoading}
                style={{ ...btnSecondary, width: "100%", marginTop: 8 }}>
                {inboxLoading ? "Chargement…" : "Voir plus"}
              </button>
            )}
          </section>
        )}

        {error && <div role="alert" style={s.error}>{error}</div>}
      </div>
    </div>
  )
}

function ReceivedRow({ inv, onUpdated, onError }) {
  const [open,    setOpen]    = useState(false)
  const [pending, setPending] = useState(null)   // action en attente de confirmation
  const [sending, setSending] = useState(false)
  const [opening, setOpening] = useState(false)

  const openFile = async () => {
    // Fenêtre ouverte tout de suite (sinon bloquée après l'attente réseau).
    const w = window.open("", "_blank")
    setOpening(true)
    try {
      const blob = await pdp.download(inv.id)
      const url = URL.createObjectURL(blob)
      if (w) w.location.href = url; else window.location.href = url
    } catch (e) { w?.close(); onError(e) }
    finally { setOpening(false) }
  }

  const confirm = async () => {
    setSending(true)
    try {
      const r = await pdp.setStatus(inv.id, pending.code)
      onUpdated({ status: r.status, status_label: r.status_label, status_at: r.status_at })
      setPending(null)
    } catch (e) { onError(e) }
    finally { setSending(false) }
  }

  const refused = inv.status === "fr:210"
  return (
    <div style={{ borderBottom: `1px solid ${ZB.ruleSoft}` }}>
      <button onClick={() => { setOpen(o => !o); setPending(null) }} aria-expanded={open} style={s.rowBtn}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: ZB.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {inv.seller_name || "Fournisseur"}
          </div>
          <div style={{ fontSize: 13, color: ZB.ink2, ...NUM }}>
            {inv.number || "Sans numéro"} · {formatDate(inv.issue_date || inv.created_at)}
          </div>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: ZB.ink, ...NUM }}>{formatEur(inv.total_ttc, inv.currency)}</div>
          {inv.status_label && (
            <div style={{ fontSize: 12, fontWeight: 600, color: refused ? ZB.danger : ZB.ink2 }}>{inv.status_label}</div>
          )}
        </div>
      </button>

      {open && (
        <div style={{ padding: "0 0 14px" }}>
          {(inv.due_date || inv.total_ht != null || inv.seller_siren) && (
            <div style={{ fontSize: 13, color: ZB.ink2, marginBottom: 10, lineHeight: 1.6, ...NUM }}>
              {inv.total_ht != null && <div>Montant HT : {formatEur(inv.total_ht, inv.currency)}</div>}
              {inv.due_date && <div>Échéance : {formatDate(inv.due_date)}</div>}
              {inv.seller_siren && <div>SIREN fournisseur : {inv.seller_siren}</div>}
            </div>
          )}
          <button onClick={openFile} disabled={opening} style={{ ...btnSecondary, width: "100%", marginBottom: 8 }}>
            {opening ? "Ouverture…" : "Voir la facture"}
          </button>

          {!pending && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {ACTIONS.filter(a => a.code !== inv.status).map(a => (
                <button key={a.code} onClick={() => setPending(a)}
                  style={{ ...btnSecondary, minHeight: 44, fontSize: 14, padding: "0 12px", color: a.danger ? ZB.danger : ZB.ink }}>
                  {a.label}
                </button>
              ))}
            </div>
          )}

          {pending && (
            <div role="group" aria-label="Confirmation" style={s.confirmBar}>
              <div style={{ fontSize: 14, color: ZB.ink, marginBottom: 10 }}>{pending.confirm}</div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => setPending(null)} disabled={sending} style={{ ...btnSecondary, flex: 1 }}>Annuler</button>
                <button onClick={confirm} disabled={sending}
                  style={{ ...btnPrimary, flex: 1, background: pending.danger ? ZB.danger : ZB.accent, opacity: sending ? 0.7 : 1 }}>
                  {sending ? "Envoi…" : pending.label}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

const s = {
  wrap:     { minHeight: "100vh", background: ZB.paper, color: ZB.ink, padding: "16px 16px 32px", fontFamily: ZB.font, display: "flex", justifyContent: "center" },
  shell:    { width: "100%", maxWidth: 560 },
  back:     { display: "inline-flex", alignItems: "center", gap: 4, minHeight: 44, background: "none", border: "none", color: ZB.ink2, fontFamily: "inherit", fontSize: 15, fontWeight: 600, cursor: "pointer", margin: "0 0 12px -8px", padding: "0 8px" },
  title:    { color: ZB.ink, fontSize: 21, fontWeight: 700, lineHeight: 1.25, margin: "0 0 6px" },
  subtitle: { color: ZB.ink2, fontSize: 15, margin: "0 0 18px", lineHeight: 1.45 },
  h2:       { color: ZB.ink, fontSize: 16, fontWeight: 700, margin: "8px 0" },
  card:     { background: ZB.sheet, border: `1px solid ${ZB.rule}`, borderRadius: 8, padding: "6px 16px 14px", marginBottom: 16 },
  cardHeader: { padding: "10px 0", display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8, borderBottom: `2px solid ${ZB.ink}` },
  stamp:    { display: "inline-block", fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", padding: "2px 7px", borderRadius: 3, border: "1px solid currentColor" },
  stampMuted: { display: "inline-block", fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", padding: "2px 7px", borderRadius: 3, border: "1px solid currentColor", color: ZB.ink3 },
  row:      { display: "flex", justifyContent: "space-between", alignItems: "baseline", minHeight: 44, padding: "12px 0", borderBottom: `1px solid ${ZB.ruleSoft}`, gap: 12 },
  rowBtn:   { display: "flex", alignItems: "center", gap: 12, width: "100%", minHeight: 64, padding: "10px 0", background: "none", border: "none", textAlign: "left", fontFamily: "inherit", cursor: "pointer" },
  label:    { color: ZB.ink2, fontSize: 14, fontWeight: 600 },
  value:    { color: ZB.ink, fontSize: 15, fontWeight: 600, textAlign: "right" },
  note:     { color: ZB.ink2, fontSize: 14, lineHeight: 1.5, margin: "12px 0 0" },
  cta:      { ...btnPrimary, width: "100%", minHeight: 52, fontSize: 16, marginTop: 16 },
  linkBtn:  { minHeight: 44, background: "none", border: "none", color: ZB.ink2, fontFamily: "inherit", fontSize: 14, fontWeight: 600, textDecoration: "underline", cursor: "pointer", padding: "0 4px", marginTop: 4 },
  confirmBar: { background: ZB.paper, border: `1px solid ${ZB.rule}`, borderRadius: 8, padding: 12 },
  loader:   { color: ZB.ink2, fontSize: 15, padding: 20, textAlign: "center" },
  ok:       { background: ZB.stampSoft, color: ZB.stamp, border: `1px solid ${ZB.stamp}`, padding: 12, borderRadius: 8, fontSize: 14, marginBottom: 16 },
  error:    { background: ZB.dangerSoft, color: ZB.danger, border: `1px solid ${ZB.danger}`, padding: 12, borderRadius: 8, fontSize: 14, marginTop: 12 },
}
