// Page publique du devis, côté client (lien personnel envoyé par l'artisan).
// Système « Bordereau », mais à l'identité de l'artisan : son logo, son nom,
// sa couleur (rendue lisible par readableAccent) ; vouvoiement.
// Le devis se lit ligne par ligne comme sur le PDF ; une seule action
// principale, « Signer le devis », dans une barre collée en bas. La
// vérification par code n'intervient qu'au moment d'une action engageante.
import { useState, useEffect, useCallback, useRef } from 'react'
import { ZB, NUM } from '../lib/theme.js'
import { computeTotals, isNoTva } from '../lib/invoiceCalc.js'
import { readableAccent } from '../lib/color.js'
import { sectionsOf, Line, LotHeading, Totals } from '../components/bordereau/parts.jsx'

const fmtEur = n => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(n || 0)
const fmtD   = d => d ? new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'
const fmtDT  = d => d ? new Date(d).toLocaleString('fr-FR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) : '—'

const CAT_LABELS = {
  assurance_decennale: 'Assurance décennale',
  attestation_tva_10:  'Attestation TVA 10 %',
  attestation_tva_55:  'Attestation TVA 5,5 %',
  plaquette:           'Plaquette commerciale',
  fiche_technique:     'Fiche technique',
  autre:               'Document annexe',
}

const AUDIT_LABELS = {
  sent:              'Devis envoyé',
  opened:            'Devis consulté',
  accepted:          'Devis signé',
  refused:           'Devis refusé',
  negotiation_sent:  'Demande de modification envoyée',
  artisan_responded: "Réponse de l'artisan",
}

const PAGE_CSS = `
  .dp * { box-sizing: border-box }
  .dp input, .dp textarea, .dp button { font-family: inherit }
  .dp button:focus-visible, .dp a:focus-visible, .dp input:focus-visible, .dp textarea:focus-visible { outline: 2px solid var(--dp-accent); outline-offset: 2px }
  .dp input:focus, .dp textarea:focus { border-color: var(--dp-accent) !important }
  .dp input::placeholder, .dp textarea::placeholder { color: ${ZB.ink3}; opacity: 1 }
  @keyframes dp-spin { to { transform: rotate(360deg) } }
  @keyframes dp-stamp { from { opacity: 0; transform: rotate(-3deg) scale(1.6) } to { opacity: 1; transform: rotate(-3deg) scale(1) } }
  .dp-stamp-in { animation: dp-stamp .35s cubic-bezier(.2,.7,.2,1) both }
  @media (prefers-reduced-motion: reduce) { .dp-stamp-in, .dp-spin { animation: none !important } }
`

const field = { width: '100%', minHeight: 48, padding: '10px 12px', border: `1px solid ${ZB.rule}`, borderRadius: 8, background: ZB.sheet, fontSize: 16, color: ZB.ink, outline: 'none' }
const label = { display: 'block', fontSize: 14, fontWeight: 600, color: ZB.ink2, marginBottom: 6 }
const btnMain = accent => ({ minHeight: 52, padding: '0 20px', borderRadius: 10, border: 'none', background: accent, color: '#fff', fontSize: 16, fontWeight: 700, cursor: 'pointer' })
const btnSecond = { minHeight: 48, padding: '0 16px', borderRadius: 10, border: `1px solid ${ZB.rule}`, background: ZB.sheet, color: ZB.ink, fontSize: 15, fontWeight: 600, cursor: 'pointer' }
const btnText = accent => ({ minHeight: 44, padding: '0 4px', background: 'none', border: 'none', color: accent, fontSize: 15, fontWeight: 600, cursor: 'pointer' })

function ErrBox({ msg }) {
  if (!msg) return null
  return <p role="alert" style={{ margin: '12px 0 0', padding: '10px 12px', borderRadius: 8, background: ZB.dangerSoft, color: ZB.danger, fontSize: 15, lineHeight: 1.45 }}>{msg}</p>
}

// Cadre de la page : bande à la couleur de l'artisan, en-tête à son nom.
function Shell({ artisan, accent, children, wide = false }) {
  const company = artisan?.company
  const contact = [artisan?.phone, artisan?.email].filter(Boolean)
  return (
    <div className="dp" style={{ '--dp-accent': accent, minHeight: '100dvh', background: ZB.paper, color: ZB.ink, fontFamily: ZB.font, borderTop: `4px solid ${accent}` }}>
      <style>{PAGE_CSS}</style>
      <header style={{ borderBottom: `1px solid ${ZB.rule}`, background: ZB.paper }}>
        <div style={{ maxWidth: wide ? 1100 : 760, margin: '0 auto', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14 }}>
          {artisan?.logo && <img src={artisan.logo} alt={company || 'Logo'} style={{ height: 40, maxWidth: 140, objectFit: 'contain', flexShrink: 0 }}/>}
          <div style={{ minWidth: 0 }}>
            {company && <div style={{ fontSize: 17, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{company}</div>}
            {contact.length > 0 && (
              <div style={{ fontSize: 13, color: ZB.ink2, marginTop: 2, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {artisan.phone && <a href={`tel:${String(artisan.phone).replace(/[^\d+]/g, '')}`} style={{ color: ZB.ink2 }}>{artisan.phone}</a>}
                {artisan.email && <a href={`mailto:${artisan.email}`} style={{ color: ZB.ink2 }}>{artisan.email}</a>}
              </div>
            )}
          </div>
        </div>
      </header>
      {children}
    </div>
  )
}

function Card({ children, style }) {
  return <div style={{ background: ZB.sheet, border: `1px solid ${ZB.rule}`, borderRadius: 8, padding: '22px 20px', ...style }}>{children}</div>
}

function Centered({ children }) {
  return <main style={{ maxWidth: 480, margin: '0 auto', padding: '32px 16px 48px' }}>{children}</main>
}

function Stamp({ color, children }) {
  return (
    <span className="dp-stamp-in" style={{ display: 'inline-block', padding: '8px 16px', border: `5px double ${color}`, borderRadius: 4, color,
      fontSize: 20, fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase', transform: 'rotate(-3deg)' }}>
      {children}
    </span>
  )
}

// ── Phase code de vérification ────────────────────────────────────────────

function PhaseEmail({ data, accent, onVerified, onCancel }) {
  // L'email du client est déjà connu côté serveur (data.emailHint) — c'est
  // celui à qui l'artisan a envoyé le devis. On déclenche donc l'envoi de
  // l'OTP automatiquement au chargement et on amène directement le client
  // sur l'écran de saisie du code, sans lui faire ressaisir son email.
  // Si l'onglet a été évincé pendant qu'il lisait son mail, la session
  // pré-vérification persistée le ramène directement ici.
  const [sessId, setSessId] = useState(() => readPendingOtp(data?._token)?.sid || null)
  const [sent,   setSent]   = useState(() => !!readPendingOtp(data?._token))
  const [code,   setCode]   = useState('')
  const [busy,   setBusy]   = useState(false)
  const [err,    setErr]    = useState(null)
  const autoSentRef = useRef(false)

  const clientEmail = data?.emailHint || ''

  const requestOtp = useCallback(async () => {
    if (!clientEmail) { setErr("Aucune adresse email n'est enregistrée pour ce devis. Contactez l'artisan."); return }
    setBusy(true); setErr(null)
    try {
      // On n'envoie plus l'email au serveur : data.emailHint est masqué
      // (« dur***@gmail.com »), ce n'est pas l'email réel. Le serveur lit
      // l'email du client en DB et envoie l'OTP à cette adresse.
      const res  = await fetch('/api/devis-public', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'request_otp', token: data._token }) })
      const json = await res.json()
      if (!res.ok) { setErr(json.error); return }
      setSessId(json.session_id); setSent(true)
      writePendingOtp(data._token, json.session_id, clientEmail)
    } catch { setErr('Pas de connexion. Réessayez.') } finally { setBusy(false) }
  }, [clientEmail, data?._token])

  // Auto-déclenchement au mount : un seul tir, sauf session déjà ouverte.
  useEffect(() => {
    if (autoSentRef.current || sent || !clientEmail) return
    autoSentRef.current = true
    requestOtp()
  }, [clientEmail, sent, requestOtp])

  const verifyOtp = async () => {
    setBusy(true); setErr(null)
    try {
      const res  = await fetch('/api/devis-public', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verify_otp', token: data._token, session_id: sessId, code }) })
      const json = await res.json()
      if (!res.ok) { setErr(json.error); return }
      clearPendingOtp(data._token)
      onVerified(sessId)
    } catch { setErr('Pas de connexion. Réessayez.') } finally { setBusy(false) }
  }

  return (
    <Centered>
      <Card>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, lineHeight: 1.3 }}>Confirmez qu'il s'agit bien de vous</h1>
        <p style={{ margin: '8px 0 0', fontSize: 15, color: ZB.ink2, lineHeight: 1.5 }}>
          Devis {data.numero}{data.objet ? ` · ${data.objet}` : ''}
        </p>
        <div style={{ borderTop: `1px solid ${ZB.rule}`, marginTop: 18, paddingTop: 18 }}>
          {!clientEmail ? (
            <p style={{ margin: 0, fontSize: 15, color: ZB.ink, background: ZB.warnSoft, borderRadius: 8, padding: '10px 12px', lineHeight: 1.45 }}>
              Aucune adresse email n'est enregistrée pour ce devis. Contactez l'artisan pour obtenir l'accès.
            </p>
          ) : !sent ? (
            <p role="status" style={{ margin: 0, fontSize: 15, color: ZB.ink2 }}>{busy ? 'Envoi du code…' : "Préparation de l'accès…"}</p>
          ) : (
            <>
              <p style={{ margin: '0 0 14px', fontSize: 15, lineHeight: 1.5 }}>
                Pour signer en ligne, saisissez le code à 8 chiffres envoyé à <strong>{clientEmail}</strong>.
              </p>
              <label htmlFor="dp-code" className="zb-sr">Code à 8 chiffres</label>
              <input id="dp-code" type="text" inputMode="numeric" autoComplete="one-time-code" value={code}
                onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 8))}
                onKeyDown={e => e.key === 'Enter' && code.length === 8 && verifyOtp()}
                placeholder="········" autoFocus maxLength={8}
                style={{ ...field, minHeight: 60, fontSize: 28, fontWeight: 700, letterSpacing: 8, textAlign: 'center', marginBottom: 12, ...NUM }}/>
              <button type="button" onClick={verifyOtp} disabled={code.length !== 8 || busy}
                style={{ ...btnMain(accent), width: '100%', opacity: code.length !== 8 || busy ? 0.5 : 1, cursor: code.length !== 8 || busy ? 'default' : 'pointer' }}>
                {busy ? 'Vérification…' : 'Continuer'}
              </button>
              <button type="button" onClick={() => { setCode(''); setErr(null); requestOtp() }} disabled={busy}
                style={{ ...btnText(accent), display: 'block', margin: '8px auto 0' }}>
                Recevoir un nouveau code
              </button>
            </>
          )}
          <ErrBox msg={err}/>
          {onCancel && (
            <button type="button" onClick={onCancel} disabled={busy}
              style={{ ...btnText(ZB.ink2), display: 'block', margin: '12px auto 0' }}>
              Revenir au devis
            </button>
          )}
        </div>
      </Card>
    </Centered>
  )
}

// ── Demande de modifications ──────────────────────────────────────────────

function NegotiateMode({ lignes, token, sessionId, accent, company, onDone, onCancel }) {
  const [actions,  setActions]  = useState({})
  const [qtys,     setQtys]     = useState({})
  const [comments, setComments] = useState({})
  const [message,  setMessage]  = useState('')
  const [budget,   setBudget]   = useState('')
  const [busy,     setBusy]     = useState(false)
  const [err,      setErr]      = useState(null)

  const ouvrages = lignes.filter(l => l.type_ligne === 'ouvrage')

  // Totaux HT par le calcul commun (lignes arrondies au centime).
  const newTotal = computeTotals(ouvrages
    .filter(l => actions[l.id] !== 'remove')
    .map(l => ({ ...l, quantite: qtys[l.id] !== undefined ? Number(qtys[l.id]) : (l.quantite || 0) }))).ht

  const buildChanges = () => {
    const changes = []
    for (const l of ouvrages) {
      if (actions[l.id] === 'remove') {
        changes.push({ ligne_id: l.id, action: 'remove', comment: comments[l.id] || null })
      } else if (qtys[l.id] !== undefined && Number(qtys[l.id]) !== l.quantite) {
        changes.push({ ligne_id: l.id, action: 'change_qty', new_qty: Number(qtys[l.id]), comment: comments[l.id] || null })
      }
    }
    return changes
  }

  const submit = async () => {
    setBusy(true); setErr(null)
    const changes = buildChanges()
    try {
      const res = await fetch('/api/devis-public', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'negotiate', token, session_id: sessionId, message, line_changes: changes, budget_target: budget || null }) })
      const json = await res.json()
      if (!res.ok) { setErr(json.error); return }
      onDone(json.newTotal)
    } catch { setErr('Pas de connexion. Réessayez.') } finally { setBusy(false) }
  }

  const origTotal = computeTotals(ouvrages).ht
  const diff = newTotal - origTotal

  return (
    <section aria-labelledby="dp-neg" style={{ background: ZB.sheet, border: `1px solid ${ZB.rule}`, borderRadius: 8, padding: '20px 18px' }}>
      <h2 id="dp-neg" style={{ margin: 0, fontSize: 19, fontWeight: 700 }}>Demander des modifications</h2>
      <p style={{ margin: '6px 0 16px', fontSize: 15, color: ZB.ink2, lineHeight: 1.5 }}>
        Retirez ou ajustez des prestations. {company || "L'artisan"} reçoit votre demande et vous répond.
      </p>

      <div style={{ borderTop: `2px solid ${ZB.ink}` }}>
        {ouvrages.map(l => {
          const removed = actions[l.id] === 'remove'
          const qty     = qtys[l.id] !== undefined ? qtys[l.id] : l.quantite
          return (
            <div key={l.id} style={{ padding: '12px 0', borderBottom: `1px solid ${ZB.ruleSoft}` }}>
              <div style={{ fontSize: 15, fontWeight: 600, textDecoration: removed ? 'line-through' : 'none', color: removed ? ZB.ink3 : ZB.ink }}>{l.designation}</div>
              {l.lot && <div style={{ fontSize: 13, color: ZB.ink2, marginTop: 2 }}>{l.lot}</div>}
              <div role="radiogroup" aria-label={`Que faire de « ${l.designation} » ?`} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 10 }}>
                {[['keep', 'Garder'], ['remove', 'Retirer']].map(([k, lbl]) => {
                  const on = k === 'remove' ? removed : !removed
                  const col = k === 'remove' ? ZB.danger : accent
                  return (
                    <button key={k} type="button" role="radio" aria-checked={on}
                      onClick={() => setActions(a => ({ ...a, [l.id]: k === 'remove' ? 'remove' : undefined }))}
                      style={{ minHeight: 44, borderRadius: 8, border: `1px solid ${on ? col : ZB.rule}`, background: on ? (k === 'remove' ? ZB.dangerSoft : ZB.paper2) : ZB.sheet,
                        color: on ? col : ZB.ink, fontSize: 15, fontWeight: on ? 700 : 500, cursor: 'pointer' }}>
                      {lbl}
                    </button>
                  )
                })}
              </div>
              {!removed && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
                  <label htmlFor={`q-${l.id}`} style={{ fontSize: 14, color: ZB.ink2 }}>Quantité</label>
                  <input id={`q-${l.id}`} type="number" inputMode="decimal" min={0} step="any" value={qty}
                    onChange={e => setQtys(q => ({ ...q, [l.id]: e.target.value }))}
                    style={{ ...field, width: 96, minHeight: 44, textAlign: 'right', ...NUM }}/>
                  <span style={{ fontSize: 14, color: ZB.ink2 }}>{l.unite}</span>
                  <span style={{ marginLeft: 'auto', fontSize: 15, fontWeight: 700, ...NUM }}>{fmtEur(Number(qty) * (l.prix_unitaire || 0))}</span>
                </div>
              )}
              <label style={{ display: 'block', marginTop: 10 }}>
                <span className="zb-sr">Commentaire sur cette ligne</span>
                <input value={comments[l.id] || ''} onChange={e => setComments(c => ({ ...c, [l.id]: e.target.value }))}
                  placeholder={removed ? 'Pourquoi la retirer ? (facultatif)' : 'Commentaire (facultatif)'}
                  style={{ ...field, minHeight: 44 }}/>
              </label>
            </div>
          )
        })}
      </div>

      <label style={{ display: 'block', marginTop: 16 }}>
        <span style={label}>Budget visé (facultatif)</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input type="number" inputMode="decimal" value={budget} onChange={e => setBudget(e.target.value)} placeholder="Ex : 7 000"
            style={{ ...field, flex: 1, ...NUM }}/>
          <span style={{ fontSize: 15, color: ZB.ink2 }}>€ HT</span>
        </span>
      </label>

      <label style={{ display: 'block', marginTop: 14 }}>
        <span style={label}>Message pour l'artisan</span>
        <textarea value={message} onChange={e => setMessage(e.target.value)} rows={3} style={{ ...field, resize: 'vertical' }}/>
      </label>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 16, padding: '10px 0', borderTop: `2px solid ${ZB.ink}`, borderBottom: `3px double ${ZB.ink}`, ...NUM }}>
        <span style={{ fontSize: 15, fontWeight: 600 }}>Nouveau total estimé</span>
        <span style={{ textAlign: 'right' }}>
          <span style={{ fontSize: 20, fontWeight: 700 }}>{fmtEur(newTotal)} <span style={{ fontSize: 13, color: ZB.ink2 }}>HT</span></span>
          {diff < 0 && <span style={{ display: 'block', fontSize: 14, color: ZB.ink2 }}>soit {fmtEur(Math.abs(diff))} de moins</span>}
        </span>
      </div>

      <ErrBox msg={err}/>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 8, marginTop: 16 }}>
        <button type="button" onClick={onCancel} style={btnSecond}>Annuler</button>
        <button type="button" onClick={submit} disabled={busy} style={{ ...btnMain(accent), opacity: busy ? 0.6 : 1 }}>
          {busy ? 'Envoi…' : 'Envoyer ma demande'}
        </button>
      </div>
    </section>
  )
}

// ── Page principale ────────────────────────────────────────────────────────

// Persiste sessionId par token : si le client recharge la page entre
// l'envoi du code OTP et sa saisie (cas mobile fréquent — onglet basculé,
// PWA mise en veille, etc.), on retrouve la session au lieu de
// redemander un email.
const SESSION_KEY = (token) => `zenbat_devis_pub_sid_${token}`
const SESSION_TTL_MS = 30 * 60 * 1000 // 30 min — au-delà l'OTP expire côté serveur

function readPersistedSessionId(token) {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY(token))
    if (!raw) return null
    const { sid, t } = JSON.parse(raw)
    if (!sid || !t || Date.now() - t > SESSION_TTL_MS) {
      sessionStorage.removeItem(SESSION_KEY(token))
      return null
    }
    return sid
  } catch { return null }
}
function writePersistedSessionId(token, sid) {
  try { sessionStorage.setItem(SESSION_KEY(token), JSON.stringify({ sid, t: Date.now() })) } catch {}
}
function clearPersistedSessionId(token) {
  try { sessionStorage.removeItem(SESSION_KEY(token)) } catch {}
}

// Persiste la session OTP *pré-vérification* (id + email saisi) : sur
// mobile, le client bascule sur son app mail pour lire le code, l'OS
// peut évincer l'onglet en arrière-plan, et au retour le navigateur
// recharge la page. Sans persistance, l'écran retombe sur la saisie de
// l'email. Avec, on remonte directement sur la saisie du code.
const PENDING_OTP_KEY = (token) => `zenbat_devis_pub_pending_${token}`
const PENDING_OTP_TTL_MS = 15 * 60 * 1000 // 15 min — durée de validité de l'OTP côté serveur

function readPendingOtp(token) {
  if (!token) return null
  try {
    const raw = sessionStorage.getItem(PENDING_OTP_KEY(token))
    if (!raw) return null
    const { sid, email, t } = JSON.parse(raw)
    if (!sid || !email || !t || Date.now() - t > PENDING_OTP_TTL_MS) {
      sessionStorage.removeItem(PENDING_OTP_KEY(token))
      return null
    }
    return { sid, email }
  } catch { return null }
}
function writePendingOtp(token, sid, email) {
  try { sessionStorage.setItem(PENDING_OTP_KEY(token), JSON.stringify({ sid, email, t: Date.now() })) } catch {}
}
function clearPendingOtp(token) {
  try { sessionStorage.removeItem(PENDING_OTP_KEY(token)) } catch {}
}

export default function DevisPublicPage({ token }) {
  const [data,         setData]         = useState(null)
  const [sessionId,    setSessionId]    = useState(() => readPersistedSessionId(token))
  const [phase,        setPhase]        = useState('loading')
  const [mode,         setMode]         = useState(null)
  const [clientName,   setClientName]   = useState('')
  const [refuseReason, setRefuseReason] = useState('')
  const [busy,         setBusy]         = useState(false)
  const [err,          setErr]          = useState(null)
  const [pdfLoading,   setPdfLoading]   = useState(false)
  // Statut d'envoi de l'email post-signature : null tant qu'on n'a pas
  // tenté, { client: bool, artisan: bool } après la requête. Permet de
  // nuancer le message sur l'écran 'accepted' si un destinataire a raté.
  const [emailSent,    setEmailSent]    = useState(null)
  // L'OTP n'est plus requis pour CONSULTER le devis (lecture libre via le lien
  // personnel). Il n'est demandé qu'au moment d'une action engageante :
  // signer / refuser / négocier (le serveur l'exige aussi côté API).
  // `verified` = session OTP valide (24 h) ; `pendingAction` = l'action à
  // rouvrir juste après la vérification.
  const [verified,     setVerified]     = useState(false)
  const [pendingAction, setPendingAction] = useState(null)

  // Couleur de l'artisan, assombrie si besoin pour rester lisible sous un texte blanc.
  const accent = readableAccent(data?.artisan?.color)
  // URL blob du PDF affiché en aperçu inline (généré au chargement de la vue).
  const [pdfUrl, setPdfUrl] = useState(null)

  // Construit le PDF du devis (jsPDF) à partir des données publiques.
  const genPdfBlob = async () => {
    const { renderDataToPdf } = await import('../lib/pdf.js')
    const d  = { ...data, lignes: data.lignes || [] }
    const cl = { raison_sociale: data.client?.name, email: data.client?.email }
    const brand = data.artisan?.brand
      ? { ...data.artisan.brand, companyName: data.artisan.brand.companyName || data.artisan.company }
      : { companyName: data.artisan?.company, email: data.artisan?.email, phone: data.artisan?.phone, address: data.artisan?.address, color: data.artisan?.color, logo: data.artisan?.logo }
    const { blob } = await renderDataToPdf(d, cl, brand, 'devis', { filename: `${data.numero}.pdf` })
    return blob
  }

  const openPdf = async () => {
    if (pdfLoading || !data) return
    setPdfLoading(true)
    try {
      // Ouvre le PDF dans le visualiseur natif du navigateur / OS.
      window.open(pdfUrl || URL.createObjectURL(await genPdfBlob()), '_blank')
    } catch (e) { console.error(e) } finally { setPdfLoading(false) }
  }

  // Aperçu PDF inline : dès que le devis est consultable (phase 'view' avec des
  // lignes), on génère le PDF et on l'affiche directement dans la page, à la
  // manière d'un « espace client ». Best-effort : en cas d'échec, le bouton
  // « Ouvrir le PDF » reste le filet.
  useEffect(() => {
    if (phase !== 'view' || !data?.lignes?.length) return
    let url = null, cancelled = false
    genPdfBlob()
      .then(blob => { if (!cancelled) { url = URL.createObjectURL(blob); setPdfUrl(url) } })
      .catch(e => console.error('[pdf inline]', e))
    return () => { cancelled = true; if (url) URL.revokeObjectURL(url) }
  }, [phase, data]) // eslint-disable-line react-hooks/exhaustive-deps

  const load = useCallback(async (sid) => {
    const id  = sid || sessionId
    const url = `/api/devis-public?token=${token}${id ? `&session_id=${id}` : ''}`
    try {
      const res  = await fetch(url)
      const json = await res.json()
      if (!res.ok) {
        // Session expirée / invalide : purge la session persistée pour ne pas
        // boucler en erreur au reload suivant.
        if (id) clearPersistedSessionId(token)
        setPhase('error'); return
      }
      json._token = token
      setData(json)
      if (json.statut === 'accepte') { clearPersistedSessionId(token); setPhase('accepted') }
      else if (json.statut === 'refuse') { clearPersistedSessionId(token); setPhase('refused') }
      else {
        // Consultation libre : on affiche toujours le devis. La vérification
        // par code n'intervient qu'au clic sur une action engageante.
        setVerified(!!json.verified)
        setPhase('view')
      }
    } catch (err) {
      // res.json() throw si l'API renvoie HTML (502 Vercel, route mal
      // configurée…) — sans ce catch, l'utilisateur reste coincé sur
      // « Chargement… » indéfiniment. La page de signature client est
      // l'écran le plus business-critique : on bascule en mode error
      // pour qu'il puisse contacter l'artisan.
      if (id) clearPersistedSessionId(token)
      setPhase('error')
    }
  }, [token, sessionId])

  useEffect(() => { load() }, [])

  const post = async (body) => {
    setBusy(true); setErr(null)
    try {
      const res  = await fetch('/api/devis-public', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...body, token, session_id: sessionId }) })
      const json = await res.json()
      if (!res.ok) { setErr(json.error); return false }
      return json
    } catch { setErr('Pas de connexion. Réessayez.'); return false } finally { setBusy(false) }
  }

  // Génère le PDF signé côté navigateur et le POST à l'API qui l'envoie
  // en pièce jointe à l'artisan + au client. Retourne le résultat de
  // l'envoi ({ ok, sent: {client, artisan}, errors }) ou null en cas
  // d'échec local (génération PDF, réseau, etc.).
  const sendSignedPdf = async (signerName, acceptedAt) => {
    try {
      const d = {
        numero:               data.numero,
        objet:                data.objet,
        date_emission:        data.date_emission,
        date_validite:        data.date_validite,
        statut:               'accepte',
        signed_at:            acceptedAt || new Date().toISOString(),
        client_accepted_at:   acceptedAt || new Date().toISOString(),
        signed_by:            signerName,
        tva_rate:             data.tva_rate,
        auto_liquidation_btp: data.auto_liquidation_btp,
        lignes:               data.lignes || [],
      }
      const cl = data.clientFull || {
        raison_sociale: data.client?.name || '',
        email:          data.client?.email || '',
      }
      const brand = data.artisan?.brand || {}
      const { buildPdf } = await import('../lib/pdfBuilder.js')
      const { base64 } = await buildPdf(d, cl, brand, 'devis', { filename: `devis-${d.numero}-signe.pdf` })
      return await post({ action: 'send_signed_pdf', pdf_base64: base64 })
    } catch (e) {
      if (import.meta.env.DEV) console.warn('[sendSignedPdf]', e)
      return null
    }
  }

  // Acceptation en deux temps : on enregistre la signature en DB, puis on
  // affiche un loader 'Signature en cours…' pendant la génération du PDF
  // et l'envoi des emails. La phase 'accepted' n'est atteinte qu'une fois
  // les emails partis (ou définitivement en échec) — c'est ce qui rassure
  // l'utilisateur sur le fait que tout est bien parti.
  // Ouvre une action engageante (signer / négocier / refuser). Si la session
  // n'est pas encore vérifiée par OTP, on passe d'abord par l'écran code, en
  // mémorisant l'action à rouvrir juste après.
  const startAction = (m) => {
    setErr(null)
    if (verified) { setMode(m); return }
    setPendingAction(m)
    setPhase('verify')
  }

  const handleAccept = async () => {
    // Garde anti-double-submit : si on est déjà en train de signer ou
    // si la phase finale est atteinte, on ne relance pas (sinon double
    // signature, double email, audit log dupliqué).
    if (busy || phase === 'signing' || phase === 'accepted') return
    if (!clientName.trim()) { setErr('Indiquez votre nom pour signer.'); return }
    const ok = await post({ action: 'accept', client_name: clientName })
    if (!ok) return
    setPhase('signing')
    const result = await sendSignedPdf(clientName, ok.signed_at)
    // result === null → échec local (PDF non généré, réseau coupé) : on bascule
    // quand même en 'accepted' (la signature est enregistrée côté serveur),
    // mais on force emailSent.client=false pour afficher la bannière jaune
    // qui prévient l'utilisateur que le PDF ne lui a pas été envoyé.
    setEmailSent(result?.sent || { client: false, artisan: false })
    setPhase('accepted')
  }

  const handleRefuse = async () => {
    if (busy || phase === 'refused') return
    if (!refuseReason.trim()) { setErr('Indiquez la raison du refus.'); return }
    const ok = await post({ action: 'refuse', reason: refuseReason })
    if (ok) setPhase('refused')
  }

  // Un seul calcul des montants (src/lib/invoiceCalc.js) : le TTC affiché est
  // celui du PDF et celui que le client signe.
  const lignes   = data?.lignes || []
  const ouvrages = lignes.filter(l => l.type_ligne === 'ouvrage')
  const brandVat = data?.artisan?.brand?.vatRegime
  const franchise = brandVat === 'franchise'
  const autoLiq  = !!data?.auto_liquidation_btp
  const totals   = computeTotals(lignes, { noTva: isNoTva(brandVat, autoLiq), docRate: data?.tva_rate })

  if (phase === 'loading') {
    return (
      <div className="dp" style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', background: ZB.paper, color: ZB.ink2, fontFamily: ZB.font, fontSize: 15 }}>
        <p role="status">Chargement du devis…</p>
      </div>
    )
  }

  if (phase === 'error') {
    return (
      <Shell artisan={null} accent={ZB.ink}>
        <Centered>
          <Card>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Ce lien ne fonctionne plus</h1>
            <p style={{ margin: '8px 0 0', fontSize: 15, color: ZB.ink2, lineHeight: 1.5 }}>
              Il est incomplet ou le devis a été remplacé. Demandez à l'artisan de vous renvoyer le lien, ou ouvrez le dernier email reçu.
            </p>
          </Card>
        </Centered>
      </Shell>
    )
  }

  if (phase === 'verify') {
    return (
      <Shell artisan={data?.artisan} accent={accent}>
        <PhaseEmail
          data={data}
          accent={accent}
          onCancel={() => { setPendingAction(null); setErr(null); setPhase('view') }}
          onVerified={async id => {
            setSessionId(id); writePersistedSessionId(token, id)
            setVerified(true)
            await load(id)
            if (pendingAction) { setMode(pendingAction); setPendingAction(null) }
          }}/>
      </Shell>
    )
  }

  if (phase === 'signing') {
    return (
      <Shell artisan={data?.artisan} accent={accent}>
        <Centered>
          <Card style={{ textAlign: 'center' }}>
            <div className="dp-spin" aria-hidden="true" style={{ width: 44, height: 44, margin: '8px auto 20px', border: `3px solid ${ZB.rule}`, borderTopColor: accent, borderRadius: '50%', animation: 'dp-spin .9s linear infinite' }}/>
            <h1 role="status" style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Signature en cours…</h1>
            <p style={{ margin: '8px 0 0', fontSize: 15, color: ZB.ink2, lineHeight: 1.5 }}>
              Nous préparons votre devis signé et vous l'envoyons par email. Merci de garder cette page ouverte quelques secondes.
            </p>
          </Card>
        </Centered>
      </Shell>
    )
  }

  if (phase === 'accepted') {
    return (
      <Shell artisan={data?.artisan} accent={accent}>
        <Centered>
          <Card style={{ textAlign: 'center' }}>
            <div style={{ margin: '6px 0 18px' }}><Stamp color={ZB.stamp}>Signé</Stamp></div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Merci, votre accord est enregistré</h1>
            <p style={{ margin: '8px 0 0', fontSize: 15, color: ZB.ink2, lineHeight: 1.5 }}>
              Devis <strong style={{ color: ZB.ink }}>{data.numero}</strong>{data.client_accepted_at ? `, signé le ${fmtD(data.client_accepted_at)}` : ''}
              {ouvrages.length > 0 && <>, pour <strong style={{ color: ZB.ink, whiteSpace: 'nowrap', ...NUM }}>{fmtEur(totals.ttc)} TTC</strong></>}.
            </p>
            {ouvrages.length > 0 && (
              <button type="button" onClick={openPdf} disabled={pdfLoading} style={{ ...btnSecond, marginTop: 16 }}>
                {pdfLoading ? 'Préparation…' : 'Voir le devis signé'}
              </button>
            )}
            {emailSent?.client && (
              <p style={{ margin: '16px 0 0', fontSize: 15, background: ZB.stampSoft, borderRadius: 8, padding: '10px 12px', lineHeight: 1.45 }}>
                Le devis signé vous a été envoyé par email.
              </p>
            )}
            {emailSent && !emailSent.client && (
              <p style={{ margin: '16px 0 0', fontSize: 15, background: ZB.warnSoft, borderRadius: 8, padding: '10px 12px', lineHeight: 1.45 }}>
                Votre signature est bien enregistrée, mais l'email avec le PDF n'est pas parti. L'artisan vous le transmettra.
              </p>
            )}
            {data.artisan?.company && (
              <p style={{ margin: '16px 0 0', fontSize: 15, lineHeight: 1.5 }}>
                {data.artisan.company} vous recontacte pour organiser les travaux.
              </p>
            )}
          </Card>
        </Centered>
      </Shell>
    )
  }

  if (phase === 'refused') {
    return (
      <Shell artisan={data?.artisan} accent={accent}>
        <Centered>
          <Card style={{ textAlign: 'center' }}>
            <div style={{ margin: '6px 0 18px' }}><Stamp color={ZB.ink2}>Refusé</Stamp></div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Votre réponse est enregistrée</h1>
            <p style={{ margin: '8px 0 0', fontSize: 15, color: ZB.ink2, lineHeight: 1.5 }}>
              Si vous souhaitez une nouvelle proposition, contactez directement l'artisan.
            </p>
          </Card>
        </Centered>
      </Shell>
    )
  }

  // ── Vue principale ─────────────────────────────────────────────────────
  const sections = sectionsOf(lignes)
  const cloture  = ['accepte', 'refuse', 'remplace'].includes(data?.statut)
  const enNeg    = data?.statut === 'en_negociation'
  const clientFirst = data?.client?.name

  let bar = null
  if (!cloture && mode === 'accept') {
    bar = (
      <div role="group" aria-label="Signer le devis" style={{ display: 'grid', gap: 10 }}>
        <p style={{ margin: 0, fontSize: 15, lineHeight: 1.45 }}>
          En signant, vous donnez votre accord pour le devis <strong>{data.numero}</strong>, soit <strong style={NUM}>{fmtEur(totals.ttc)} TTC</strong>.
        </p>
        <label>
          <span style={label}>Votre nom et prénom</span>
          <input value={clientName} onChange={e => setClientName(e.target.value)} autoComplete="name" placeholder="Ex : Claire Durand" style={field}/>
        </label>
        <ErrBox msg={err}/>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 8 }}>
          <button type="button" onClick={() => { setMode(null); setErr(null) }} style={btnSecond}>Annuler</button>
          <button type="button" onClick={handleAccept} disabled={!clientName.trim() || busy}
            style={{ ...btnMain(accent), opacity: !clientName.trim() || busy ? 0.5 : 1, cursor: !clientName.trim() || busy ? 'default' : 'pointer' }}>
            {busy ? 'Signature…' : 'Bon pour accord, je signe'}
          </button>
        </div>
      </div>
    )
  } else if (!cloture && mode === 'refuse') {
    bar = (
      <div role="group" aria-label="Refuser le devis" style={{ display: 'grid', gap: 10 }}>
        <label>
          <span style={label}>Pourquoi refusez-vous ce devis ?</span>
          <textarea value={refuseReason} onChange={e => setRefuseReason(e.target.value)} rows={2}
            placeholder="Ex : budget trop élevé, autre proposition…" style={{ ...field, resize: 'vertical' }}/>
        </label>
        <ErrBox msg={err}/>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 8 }}>
          <button type="button" onClick={() => { setMode(null); setErr(null) }} style={btnSecond}>Annuler</button>
          <button type="button" onClick={handleRefuse} disabled={!refuseReason.trim() || busy}
            style={{ ...btnSecond, color: ZB.danger, borderColor: ZB.danger, opacity: !refuseReason.trim() || busy ? 0.5 : 1 }}>
            {busy ? 'Envoi…' : 'Refuser le devis'}
          </button>
        </div>
      </div>
    )
  } else if (!cloture && mode === null) {
    bar = enNeg ? (
      <p style={{ margin: 0, fontSize: 15, color: ZB.ink2, lineHeight: 1.45 }}>
        Votre demande de modification est entre les mains de l'artisan : il vous répond par email.
      </p>
    ) : (
      <div style={{ display: 'grid', gap: 6 }}>
        {ouvrages.length > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '0 2px 4px', ...NUM }}>
            <span style={{ fontSize: 15 }}>Total du devis</span>
            <span style={{ fontSize: 19, fontWeight: 700 }}>{fmtEur(totals.ttc)} <span style={{ fontSize: 13, fontWeight: 600, color: ZB.ink2 }}>TTC</span></span>
          </div>
        )}
        <button type="button" onClick={() => startAction('accept')} style={{ ...btnMain(accent), width: '100%' }}>Signer le devis</button>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 20, flexWrap: 'wrap' }}>
          <button type="button" onClick={() => startAction('negotiate')} style={btnText(accent)}>Demander des modifications</button>
          <button type="button" onClick={() => startAction('refuse')} style={btnText(ZB.ink2)}>Refuser</button>
        </div>
      </div>
    )
  }

  return (
    <Shell artisan={data?.artisan} accent={accent}>
      <main style={{ maxWidth: 760, margin: '0 auto', padding: '18px 12px 24px' }}>
        <p style={{ margin: '0 4px 14px', fontSize: 15, color: ZB.ink2, lineHeight: 1.5 }}>
          {clientFirst ? `Bonjour ${clientFirst}, voici` : 'Voici'} votre devis{data.artisan?.company ? ` de ${data.artisan.company}` : ''}.
          {!cloture && !enNeg && ' Vous pouvez le signer en ligne.'}
        </p>

        <article aria-label={`Devis ${data.numero}`} style={{ background: ZB.sheet, border: `1px solid ${ZB.rule}`, borderRadius: 8, padding: '18px 18px 20px' }}>
          <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 16, fontWeight: 700, ...NUM }}>Devis {data.numero}</div>
              <div style={{ fontSize: 13, color: ZB.ink2, marginTop: 4 }}>
                Émis le {fmtD(data.date_emission)}{data.date_validite && <> · <span style={{ whiteSpace: 'nowrap' }}>valable jusqu'au {fmtD(data.date_validite)}</span></>}
              </div>
            </div>
            <button type="button" onClick={openPdf} disabled={pdfLoading}
              style={{ ...btnText(accent), display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0, marginTop: -10 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h5"/></svg>
              {pdfLoading ? 'Préparation…' : 'Voir le PDF'}
            </button>
          </header>
          {data.objet && <h1 style={{ margin: '14px 0 0', fontSize: 21, fontWeight: 700, lineHeight: 1.25 }}>{data.objet}</h1>}

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 18, paddingBottom: 8, borderBottom: `2px solid ${ZB.ink}`, fontSize: 13, fontWeight: 600, color: ZB.ink2 }}>
            <span>Désignation</span><span>Montant HT</span>
          </div>
          {sections.map((sec, si) => (
            <section key={sec.lot?.id || `s${si}`} aria-label={sec.lot?.designation || 'Prestations'}>
              {sec.lot && <LotHeading lot={sec.lot} subtotal={sec.subtotal}/>}
              {sec.rows.map(({ l, idx }) => <Line key={l.id || idx} l={l} idx={idx} franchise={isNoTva(brandVat, autoLiq)}/>)}
            </section>
          ))}
          {ouvrages.length > 0 && <Totals ht={totals.ht} tvaRows={totals.tvaRows} ttc={totals.ttc} franchise={franchise} autoLiquidation={autoLiq && !franchise}/>}
        </article>

        {mode === 'negotiate' && !cloture && !enNeg && (
          <div style={{ marginTop: 16 }}>
            <NegotiateMode lignes={lignes} token={token} sessionId={sessionId} accent={accent} company={data.artisan?.company}
              onDone={() => { setMode(null); load(sessionId) }}
              onCancel={() => setMode(null)}/>
          </div>
        )}

        {data.docs?.length > 0 && (
          <section style={{ marginTop: 20 }}>
            <h2 style={{ margin: '0 4px 8px', fontSize: 17, fontWeight: 700 }}>Documents joints</h2>
            <div style={{ background: ZB.sheet, border: `1px solid ${ZB.rule}`, borderRadius: 8 }}>
              {data.docs.map((doc, i) => (
                <a key={doc.id} href={`/api/devis-public?token=${token}&session_id=${sessionId}&doc_id=${doc.id}`} target="_blank" rel="noopener noreferrer"
                  style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 60, padding: '10px 16px', borderBottom: i < data.docs.length - 1 ? `1px solid ${ZB.ruleSoft}` : 'none', textDecoration: 'none', color: ZB.ink }}>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 15, fontWeight: 600 }}>{doc.name}</span>
                    <span style={{ display: 'block', fontSize: 13, color: ZB.ink2 }}>{CAT_LABELS[doc.category] || 'Document'}</span>
                  </span>
                  <span style={{ fontSize: 15, fontWeight: 600, color: accent }}>Télécharger</span>
                </a>
              ))}
            </div>
          </section>
        )}

        {data.auditLog?.length > 0 && (
          <section style={{ marginTop: 20 }}>
            <h2 style={{ margin: '0 4px 8px', fontSize: 17, fontWeight: 700 }}>Suivi</h2>
            <ol style={{ listStyle: 'none', margin: 0, padding: 0, borderTop: `1px solid ${ZB.rule}` }}>
              {data.auditLog.map((e, i) => (
                <li key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '10px 4px', borderBottom: `1px solid ${ZB.ruleSoft}`, fontSize: 14 }}>
                  <span>{AUDIT_LABELS[e.event] || e.event}{e.meta?.client_name ? ` : ${e.meta.client_name}` : ''}</span>
                  <span style={{ color: ZB.ink2, whiteSpace: 'nowrap' }}>{fmtDT(e.created_at)}</span>
                </li>
              ))}
            </ol>
          </section>
        )}

        <p style={{ margin: '28px 0 0', textAlign: 'center', fontSize: 13, color: ZB.ink3 }}>
          Lien personnel et confidentiel · signature en ligne par Zenbat
        </p>
      </main>

      {bar && mode !== 'negotiate' && (
        <div style={{ position: 'sticky', bottom: 0, zIndex: 2, background: ZB.paper, borderTop: `1px solid ${ZB.rule}`, padding: '12px 12px calc(14px + env(safe-area-inset-bottom))' }}>
          <div style={{ maxWidth: 760, margin: '0 auto' }}>{bar}</div>
        </div>
      )}
    </Shell>
  )
}
