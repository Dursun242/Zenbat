import { useState, useEffect, useCallback } from 'react'

const fmtEur = n => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(n || 0)
const fmtD   = d => d ? new Date(d).toLocaleDateString('fr-FR') : '—'
const fmtDT  = d => d ? new Date(d).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'

const CAT_LABELS = {
  assurance_decennale: 'Assurance décennale',
  attestation_tva_10:  'Attestation TVA 10%',
  attestation_tva_55:  'Attestation TVA 5.5%',
  plaquette:           'Plaquette commerciale',
  fiche_technique:     'Fiche technique',
  autre:               'Document annexe',
}

const AUDIT_LABELS = {
  sent:             { label: 'Devis envoyé' },
  opened:           { label: 'Consulté' },
  accepted:         { label: 'Accepté' },
  refused:          { label: 'Refusé' },
  negotiation_sent: { label: 'Proposition envoyée' },
  artisan_responded:{ label: "Réponse de l'artisan" },
}

function ErrBox({ msg }) {
  if (!msg) return null
  return <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', color: '#991b1b', fontSize: 13, marginTop: 12 }}>{msg}</div>
}

// ── Header ─────────────────────────────────────────────────────────────────

function Header({ artisan }) {
  const accent  = artisan?.color || '#111111'
  const logo    = artisan?.logo
  const company = artisan?.company

  return (
    <div style={{ background: accent, padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: 56 }}>
      {logo
        ? <img src={logo} alt={company || ''} style={{ maxHeight: 36, maxWidth: 180, objectFit: 'contain', display: 'block' }} />
        : <span style={{ fontSize: 17, fontWeight: 700, color: 'white', letterSpacing: '-0.3px' }}>{company || ''}</span>
      }
    </div>
  )
}

// ── Phase OTP ──────────────────────────────────────────────────────────────

function PhaseEmail({ data, onVerified, onSessionId }) {
  const [email,  setEmail]  = useState('')
  const [sent,   setSent]   = useState(false)
  const [sessId, setSessId] = useState(null)
  const [code,   setCode]   = useState('')
  const [busy,   setBusy]   = useState(false)
  const [err,    setErr]    = useState(null)

  const accent = data?.artisan?.color || '#111111'

  const requestOtp = async () => {
    setBusy(true); setErr(null)
    try {
      const res  = await fetch('/api/devis-public', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'request_otp', token: data._token, email }) })
      const json = await res.json()
      if (!res.ok) { setErr(json.error); return }
      setSessId(json.session_id); setSent(true)
    } catch { setErr('Erreur réseau') } finally { setBusy(false) }
  }

  const verifyOtp = async () => {
    setBusy(true); setErr(null)
    try {
      const res  = await fetch('/api/devis-public', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verify_otp', token: data._token, session_id: sessId, code }) })
      const json = await res.json()
      if (!res.ok) { setErr(json.error); return }
      onSessionId(sessId); onVerified()
    } catch { setErr('Erreur réseau') } finally { setBusy(false) }
  }

  return (
    <div style={{ maxWidth: 420, margin: '48px auto', padding: '0 20px' }}>
      <div style={{ background: 'white', borderRadius: 12, padding: '32px 28px', border: '1px solid #e5e5e5' }}>

        <div style={{ marginBottom: 28 }}>
          <p style={{ margin: '0 0 4px', fontSize: 12, fontWeight: 600, color: '#999', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            {data.artisan?.company || 'Devis'}
          </p>
          <h2 style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 700, color: '#111', lineHeight: 1.3 }}>
            Accédez à votre devis
          </h2>
          {data.objet && (
            <p style={{ margin: '0 0 8px', fontSize: 14, color: '#555', lineHeight: 1.5 }}>{data.objet}</p>
          )}
          {data.montant_ht > 0 && (
            <p style={{ margin: 0, fontSize: 24, fontWeight: 800, color: '#111', letterSpacing: '-0.5px' }}>
              {fmtEur(data.montant_ht)} <span style={{ fontSize: 13, fontWeight: 500, color: '#999' }}>HT</span>
            </p>
          )}
        </div>

        <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: 24 }}>
          {!sent ? (
            <>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#555', marginBottom: 8 }}>
                Votre adresse email{data.emailHint ? <span style={{ fontWeight: 400, color: '#999' }}> — ex : {data.emailHint}</span> : ''}
              </label>
              <input
                type="email" value={email} onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && email && requestOtp()}
                placeholder="votre@email.fr" autoFocus
                style={{ width: '100%', padding: '11px 14px', borderRadius: 8, border: '1.5px solid #ddd', fontSize: 14, outline: 'none', boxSizing: 'border-box', marginBottom: 12 }}
              />
              <button onClick={requestOtp} disabled={!email || busy}
                style={{ width: '100%', padding: '12px', borderRadius: 8, border: 'none', background: accent, color: 'white', fontWeight: 700, fontSize: 14, cursor: !email || busy ? 'default' : 'pointer', opacity: !email || busy ? 0.6 : 1 }}>
                {busy ? 'Envoi en cours…' : 'Recevoir mon code d\'accès'}
              </button>
            </>
          ) : (
            <>
              <p style={{ fontSize: 13, color: '#555', marginBottom: 16 }}>
                Code envoyé à <strong>{email}</strong>
              </p>
              <input
                type="text" inputMode="numeric" value={code}
                onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                onKeyDown={e => e.key === 'Enter' && code.length === 6 && verifyOtp()}
                placeholder="_ _ _ _ _ _" autoFocus maxLength={6}
                style={{ width: '100%', padding: '14px', borderRadius: 8, border: '1.5px solid #ddd', fontSize: 32, fontWeight: 800, letterSpacing: 10, textAlign: 'center', outline: 'none', boxSizing: 'border-box', marginBottom: 12 }}
              />
              <button onClick={verifyOtp} disabled={code.length !== 6 || busy}
                style={{ width: '100%', padding: '12px', borderRadius: 8, border: 'none', background: accent, color: 'white', fontWeight: 700, fontSize: 14, cursor: code.length !== 6 || busy ? 'default' : 'pointer', opacity: code.length !== 6 || busy ? 0.6 : 1 }}>
                {busy ? 'Vérification…' : 'Accéder au devis'}
              </button>
              <button onClick={() => { setSent(false); setCode(''); setErr(null) }}
                style={{ display: 'block', width: '100%', marginTop: 10, background: 'none', border: 'none', color: '#999', fontSize: 13, cursor: 'pointer' }}>
                ← Modifier l'email
              </button>
            </>
          )}
          <ErrBox msg={err} />
        </div>
      </div>
    </div>
  )
}

// ── Mode négociation ───────────────────────────────────────────────────────

function NegotiateMode({ lignes, token, sessionId, accent, onDone, onCancel }) {
  const [actions,  setActions]  = useState({})
  const [qtys,     setQtys]     = useState({})
  const [comments, setComments] = useState({})
  const [message,  setMessage]  = useState('')
  const [budget,   setBudget]   = useState('')
  const [busy,     setBusy]     = useState(false)
  const [err,      setErr]      = useState(null)

  const ouvrages = lignes.filter(l => l.type_ligne === 'ouvrage')

  const newTotal = ouvrages
    .filter(l => actions[l.id] !== 'remove')
    .reduce((s, l) => {
      const qty = qtys[l.id] !== undefined ? Number(qtys[l.id]) : (l.quantite || 0)
      return s + qty * (l.prix_unitaire || 0)
    }, 0)

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
    } catch { setErr('Erreur réseau') } finally { setBusy(false) }
  }

  const origTotal = ouvrages.reduce((s, l) => s + (l.quantite || 0) * (l.prix_unitaire || 0), 0)
  const diff = newTotal - origTotal

  return (
    <div style={{ background: 'white', borderRadius: 12, padding: 24, marginBottom: 12, border: '1px solid #e5e5e5' }}>
      <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 700, color: '#111' }}>Proposer des modifications</h3>
      <p style={{ fontSize: 13, color: '#777', margin: '0 0 20px', lineHeight: 1.5 }}>
        Retirez ou ajustez des prestations. L'artisan recevra votre proposition et pourra l'accepter ou vous recontacter.
      </p>

      {ouvrages.map(l => {
        const removed = actions[l.id] === 'remove'
        const qty     = qtys[l.id] !== undefined ? qtys[l.id] : l.quantite
        return (
          <div key={l.id} style={{ padding: '12px 14px', borderRadius: 8, marginBottom: 8, background: removed ? '#fef2f2' : '#fafafa', border: `1px solid ${removed ? '#fecaca' : '#ebebeb'}` }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <div style={{ display: 'flex', gap: 4, flexShrink: 0, marginTop: 2 }}>
                <button onClick={() => setActions(a => ({ ...a, [l.id]: undefined }))}
                  style={{ width: 24, height: 24, borderRadius: 6, border: `1.5px solid ${!removed ? accent : '#ddd'}`, background: !removed ? accent : 'white', color: !removed ? 'white' : '#aaa', fontSize: 11, cursor: 'pointer', fontWeight: 700 }}>✓</button>
                <button onClick={() => setActions(a => ({ ...a, [l.id]: 'remove' }))}
                  style={{ width: 24, height: 24, borderRadius: 6, border: `1.5px solid ${removed ? '#ef4444' : '#ddd'}`, background: removed ? '#ef4444' : 'white', color: removed ? 'white' : '#aaa', fontSize: 11, cursor: 'pointer', fontWeight: 700 }}>✕</button>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, textDecoration: removed ? 'line-through' : 'none', color: removed ? '#aaa' : '#111' }}>{l.designation}</div>
                {l.lot && <div style={{ fontSize: 11, color: '#aaa', marginTop: 2 }}>{l.lot}</div>}
                {!removed && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                    <span style={{ fontSize: 12, color: '#777' }}>Qté</span>
                    <input type="number" min={0.1} step={0.1} value={qty}
                      onChange={e => setQtys(q => ({ ...q, [l.id]: e.target.value }))}
                      style={{ width: 64, padding: '4px 8px', borderRadius: 6, border: '1px solid #ddd', fontSize: 13, textAlign: 'right' }} />
                    <span style={{ fontSize: 12, color: '#aaa' }}>{l.unite}</span>
                    <span style={{ marginLeft: 'auto', fontSize: 13, fontWeight: 700, color: '#111' }}>
                      {fmtEur(Number(qty) * (l.prix_unitaire || 0))}
                    </span>
                  </div>
                )}
                <input value={comments[l.id] || ''} onChange={e => setComments(c => ({ ...c, [l.id]: e.target.value }))}
                  placeholder={removed ? 'Précisez pourquoi (optionnel)' : 'Commentaire (optionnel)'}
                  style={{ width: '100%', marginTop: 8, padding: '5px 8px', borderRadius: 6, border: '1px solid #ddd', fontSize: 12, boxSizing: 'border-box' }} />
              </div>
            </div>
          </div>
        )
      })}

      <div style={{ borderRadius: 8, border: '1px solid #ddd', padding: '12px 14px', marginTop: 16, marginBottom: 12 }}>
        <label style={{ fontSize: 12, fontWeight: 600, color: '#555', display: 'block', marginBottom: 8 }}>Budget cible <span style={{ fontWeight: 400, color: '#aaa' }}>(optionnel)</span></label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input type="number" value={budget} onChange={e => setBudget(e.target.value)} placeholder="Ex : 7 000"
            style={{ flex: 1, padding: '9px 12px', borderRadius: 6, border: '1px solid #ddd', fontSize: 14, outline: 'none' }} />
          <span style={{ fontSize: 13, color: '#777' }}>€ HT</span>
        </div>
      </div>

      <textarea value={message} onChange={e => setMessage(e.target.value)} rows={3}
        placeholder="Message pour l'artisan…"
        style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #ddd', fontSize: 13, resize: 'vertical', boxSizing: 'border-box', marginBottom: 14, fontFamily: 'inherit' }} />

      <div style={{ background: '#fafafa', borderRadius: 8, padding: '12px 14px', marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 13, color: '#555' }}>Nouveau total estimé</span>
        <div style={{ textAlign: 'right' }}>
          <span style={{ fontSize: 20, fontWeight: 800, color: '#111' }}>{fmtEur(newTotal)}</span>
          {diff < 0 && <div style={{ fontSize: 12, color: '#16a34a', marginTop: 2 }}>Économie de {fmtEur(Math.abs(diff))}</div>}
        </div>
      </div>

      <ErrBox msg={err} />
      <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
        <button onClick={onCancel}
          style={{ flex: 1, padding: '11px', borderRadius: 8, border: '1px solid #ddd', background: 'white', color: '#555', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>
          Annuler
        </button>
        <button onClick={submit} disabled={busy}
          style={{ flex: 2, padding: '11px', borderRadius: 8, border: 'none', background: accent, color: 'white', fontWeight: 700, fontSize: 14, cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1 }}>
          {busy ? 'Envoi…' : 'Envoyer ma proposition'}
        </button>
      </div>
    </div>
  )
}

// ── Page principale ────────────────────────────────────────────────────────

export default function DevisPublicPage({ token }) {
  const [data,         setData]         = useState(null)
  const [sessionId,    setSessionId]    = useState(null)
  const [phase,        setPhase]        = useState('loading')
  const [mode,         setMode]         = useState(null)
  const [clientName,   setClientName]   = useState('')
  const [refuseReason, setRefuseReason] = useState('')
  const [busy,         setBusy]         = useState(false)
  const [err,          setErr]          = useState(null)
  const [pdfLoading,   setPdfLoading]   = useState(false)

  const accent = data?.artisan?.color || '#111111'

  const openPdf = async () => {
    if (pdfLoading || !data) return
    setPdfLoading(true)
    try {
      const { renderDataToPdf } = await import('../lib/pdf.js')
      const d  = { ...data, lignes: data.lignes || [] }
      const cl = { raison_sociale: data.client?.name, email: data.client?.email }
      const brand = {
        companyName: data.artisan?.company,
        email:       data.artisan?.email,
        phone:       data.artisan?.phone,
        address:     data.artisan?.address,
      }
      const { blob } = await renderDataToPdf(d, cl, brand, 'devis', { filename: `${data.numero}.pdf` })
      window.open(URL.createObjectURL(blob), '_blank')
    } catch (e) { console.error(e) } finally { setPdfLoading(false) }
  }

  const load = useCallback(async (sid) => {
    const id  = sid || sessionId
    const url = `/api/devis-public?token=${token}${id ? `&session_id=${id}` : ''}`
    const res  = await fetch(url)
    const json = await res.json()
    if (!res.ok) { setPhase('error'); return }
    json._token = token
    setData(json)
    if (json.statut === 'accepte') setPhase('accepted')
    else if (json.statut === 'refuse') setPhase('refused')
    else if (!json.verified) setPhase('verify')
    else setPhase('view')
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
    } catch { setErr('Erreur réseau'); return false } finally { setBusy(false) }
  }

  const handleAccept = async () => {
    if (!clientName.trim()) { setErr('Votre nom est requis'); return }
    const ok = await post({ action: 'accept', client_name: clientName })
    if (ok) setPhase('accepted')
  }

  const handleRefuse = async () => {
    if (!refuseReason.trim()) { setErr('La raison du refus est requise'); return }
    const ok = await post({ action: 'refuse', reason: refuseReason })
    if (ok) setPhase('refused')
  }

  if (phase === 'loading') {
    return <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#f5f5f5', color: '#aaa', fontSize: 14 }}>Chargement…</div>
  }

  if (phase === 'error') {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#f5f5f5', padding: 20 }}>
        <div style={{ textAlign: 'center', color: '#555' }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>—</div>
          <h2 style={{ margin: '0 0 8px', color: '#111' }}>Lien introuvable</h2>
          <p style={{ margin: 0, fontSize: 14 }}>Ce lien est invalide ou a expiré.</p>
        </div>
      </div>
    )
  }

  if (phase === 'verify') {
    return (
      <div style={{ minHeight: '100vh', background: '#f5f5f5', fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif' }}>
        <Header artisan={data?.artisan} />
        <PhaseEmail data={data} onVerified={() => load(sessionId)} onSessionId={id => { setSessionId(id); load(id) }} />
      </div>
    )
  }

  if (phase === 'accepted') {
    return (
      <div style={{ minHeight: '100vh', background: '#f5f5f5', fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif' }}>
        <Header artisan={data?.artisan} />
        <div style={{ maxWidth: 480, margin: '48px auto', padding: '0 20px', textAlign: 'center' }}>
          <div style={{ background: 'white', borderRadius: 12, padding: '40px 32px', border: '1px solid #e5e5e5' }}>
            <div style={{ width: 48, height: 48, background: '#f0fdf4', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', fontSize: 22 }}>✓</div>
            <h2 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 700, color: '#111' }}>Devis accepté</h2>
            <p style={{ color: '#777', fontSize: 14, lineHeight: 1.6, margin: '0 0 16px' }}>
              Votre accord pour le devis <strong style={{ color: '#111' }}>{data.numero}</strong> a bien été enregistré
              {data.client_accepted_at ? ` le ${fmtD(data.client_accepted_at)}` : ''}.
            </p>
            {data.artisan?.company && (
              <p style={{ color: '#555', fontSize: 14, margin: 0 }}>
                L'équipe de <strong>{data.artisan.company}</strong> vous contactera prochainement.
              </p>
            )}
            {data.artisan?.phone && (
              <p style={{ color: '#999', fontSize: 13, marginTop: 12 }}>{data.artisan.phone}</p>
            )}
          </div>
        </div>
      </div>
    )
  }

  if (phase === 'refused') {
    return (
      <div style={{ minHeight: '100vh', background: '#f5f5f5', fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif' }}>
        <Header artisan={data?.artisan} />
        <div style={{ maxWidth: 480, margin: '48px auto', padding: '0 20px', textAlign: 'center' }}>
          <div style={{ background: 'white', borderRadius: 12, padding: '40px 32px', border: '1px solid #e5e5e5' }}>
            <h2 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 700, color: '#111' }}>Devis refusé</h2>
            <p style={{ color: '#777', fontSize: 14, lineHeight: 1.6, margin: 0 }}>
              Contactez l'artisan si vous souhaitez discuter d'une nouvelle proposition.
            </p>
            {data.artisan?.email && (
              <p style={{ color: '#999', fontSize: 13, marginTop: 12 }}>{data.artisan.email}</p>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ── Vue principale ─────────────────────────────────────────────────────
  const lignes   = data?.lignes || []
  const ouvrages = lignes.filter(l => l.type_ligne === 'ouvrage')
  const totalHT  = ouvrages.reduce((s, l) => s + (l.quantite || 0) * (l.prix_unitaire || 0), 0)
  const tvaRate  = ouvrages[0]?.tva_rate ?? 20
  const totalTTC = totalHT * (1 + tvaRate / 100)
  const cloture  = ['accepte', 'refuse', 'remplace'].includes(data?.statut)
  const enNeg    = data?.statut === 'en_negociation'

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5', fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif', paddingBottom: 60 }}>
      <style>{`* { box-sizing: border-box } input, textarea, button { font-family: inherit }`}</style>
      <Header artisan={data?.artisan} />

      <div style={{ maxWidth: 600, margin: '0 auto', padding: '20px 16px 0' }}>

        {/* Carte devis */}
        <div style={{ background: 'white', borderRadius: 12, padding: '24px', marginBottom: 12, border: '1px solid #e5e5e5' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#aaa', letterSpacing: '0.5px', marginBottom: 8 }}>{data.numero}</div>
          {data.objet && (
            <h2 style={{ margin: '0 0 12px', fontSize: 17, fontWeight: 700, color: '#111', lineHeight: 1.4 }}>{data.objet}</h2>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 8 }}>
            <div style={{ fontSize: 12, color: '#aaa' }}>
              Émis le {fmtD(data.date_emission)}
              {data.date_validite && <> · Valable jusqu'au {fmtD(data.date_validite)}</>}
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: '#111', letterSpacing: '-0.5px', lineHeight: 1 }}>{fmtEur(totalHT)}</div>
              <div style={{ fontSize: 11, color: '#aaa', marginTop: 4 }}>HT · TVA {tvaRate}%</div>
            </div>
          </div>

          {enNeg && (
            <div style={{ marginTop: 16, borderTop: '1px solid #f0f0f0', paddingTop: 14, fontSize: 13, color: '#777' }}>
              Votre proposition est en cours d'examen.
            </div>
          )}
        </div>

        {/* Bouton PDF */}
        <button onClick={openPdf} disabled={pdfLoading}
          style={{ width: '100%', background: accent, color: 'white', border: 'none', borderRadius: 10, padding: '14px 20px', fontSize: 14, fontWeight: 700, cursor: pdfLoading ? 'default' : 'pointer', marginBottom: 12, opacity: pdfLoading ? 0.7 : 1 }}>
          {pdfLoading ? 'Génération…' : 'Voir le PDF du devis'}
        </button>

        {/* Documents joints */}
        {data.docs?.length > 0 && (
          <div style={{ background: 'white', borderRadius: 12, padding: '16px 20px', marginBottom: 12, border: '1px solid #e5e5e5' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 12 }}>Documents joints</div>
            {data.docs.map(doc => (
              <a key={doc.id} href={`/api/devis-public?token=${token}&session_id=${sessionId}&doc_id=${doc.id}`}
                target="_blank" rel="noopener noreferrer"
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid #f5f5f5', textDecoration: 'none', color: '#111' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{doc.name}</div>
                  <div style={{ fontSize: 11, color: '#aaa', marginTop: 2 }}>{CAT_LABELS[doc.category] || 'Document'}</div>
                </div>
                <span style={{ fontSize: 12, color: accent, fontWeight: 600 }}>Télécharger</span>
              </a>
            ))}
          </div>
        )}

        {/* Historique */}
        {data.auditLog?.length > 0 && (
          <div style={{ background: 'white', borderRadius: 12, padding: '16px 20px', marginBottom: 16, border: '1px solid #e5e5e5' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 12 }}>Historique</div>
            {data.auditLog.map((e, i) => {
              const info = AUDIT_LABELS[e.event] || { label: e.event }
              return (
                <div key={i} style={{ display: 'flex', gap: 12, padding: '5px 0', fontSize: 13, borderBottom: i < data.auditLog.length - 1 ? '1px solid #f5f5f5' : 'none' }}>
                  <span style={{ color: '#ccc', fontSize: 12, minWidth: 72, paddingTop: 1 }}>{fmtDT(e.created_at)}</span>
                  <span style={{ color: '#555' }}>{info.label}{e.meta?.client_name ? ` — ${e.meta.client_name}` : ''}</span>
                </div>
              )
            })}
          </div>
        )}

        {/* Mode négociation */}
        {mode === 'negotiate' && !cloture && !enNeg && (
          <NegotiateMode lignes={lignes} token={token} sessionId={sessionId} accent={accent}
            onDone={() => { setMode(null); load(sessionId) }}
            onCancel={() => setMode(null)} />
        )}

        {/* Mode accepter */}
        {mode === 'accept' && (
          <div style={{ background: 'white', borderRadius: 12, padding: 24, marginBottom: 12, border: '1px solid #e5e5e5' }}>
            <h3 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 700, color: '#111' }}>Confirmer votre accord</h3>
            <p style={{ fontSize: 13, color: '#777', marginTop: 0, marginBottom: 20, lineHeight: 1.5 }}>
              En acceptant, vous confirmez votre accord pour un montant de <strong style={{ color: '#111' }}>{fmtEur(totalHT)} HT</strong> ({fmtEur(totalTTC)} TTC).
            </p>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#555', marginBottom: 8 }}>Votre nom complet</label>
            <input value={clientName} onChange={e => setClientName(e.target.value)} placeholder="Jean Dupont"
              style={{ width: '100%', padding: '11px 14px', borderRadius: 8, border: '1.5px solid #ddd', fontSize: 14, marginBottom: 16, outline: 'none' }} />
            <ErrBox msg={err} />
            <div style={{ display: 'flex', gap: 10, marginTop: err ? 12 : 0 }}>
              <button onClick={() => { setMode(null); setErr(null) }}
                style={{ flex: 1, padding: '11px', borderRadius: 8, border: '1px solid #ddd', background: 'white', color: '#555', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>
                Annuler
              </button>
              <button onClick={handleAccept} disabled={!clientName.trim() || busy}
                style={{ flex: 2, padding: '11px', borderRadius: 8, border: 'none', background: accent, color: 'white', fontWeight: 700, fontSize: 14, cursor: !clientName.trim() || busy ? 'default' : 'pointer', opacity: !clientName.trim() || busy ? 0.6 : 1 }}>
                {busy ? 'Confirmation…' : 'Accepter ce devis'}
              </button>
            </div>
          </div>
        )}

        {/* Mode refuser */}
        {mode === 'refuse' && (
          <div style={{ background: 'white', borderRadius: 12, padding: 24, marginBottom: 12, border: '1px solid #e5e5e5' }}>
            <h3 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 700, color: '#111' }}>Refuser ce devis</h3>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#555', marginBottom: 8 }}>Raison du refus</label>
            <textarea value={refuseReason} onChange={e => setRefuseReason(e.target.value)} rows={3}
              placeholder="Ex : Tarif trop élevé, j'ai eu une autre proposition…"
              style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #ddd', fontSize: 13, resize: 'vertical', marginBottom: 16, outline: 'none' }} />
            <ErrBox msg={err} />
            <div style={{ display: 'flex', gap: 10, marginTop: err ? 12 : 0 }}>
              <button onClick={() => { setMode(null); setErr(null) }}
                style={{ flex: 1, padding: '11px', borderRadius: 8, border: '1px solid #ddd', background: 'white', color: '#555', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>
                Annuler
              </button>
              <button onClick={handleRefuse} disabled={!refuseReason.trim() || busy}
                style={{ flex: 2, padding: '11px', borderRadius: 8, border: '1px solid #ddd', background: 'white', color: '#ef4444', fontWeight: 600, fontSize: 14, cursor: !refuseReason.trim() || busy ? 'default' : 'pointer', opacity: !refuseReason.trim() || busy ? 0.5 : 1 }}>
                {busy ? 'Envoi…' : 'Confirmer le refus'}
              </button>
            </div>
          </div>
        )}

        {/* Boutons d'action */}
        {!cloture && mode === null && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {!enNeg && (
              <button onClick={() => setMode('accept')}
                style={{ width: '100%', padding: '14px', borderRadius: 10, border: 'none', background: accent, color: 'white', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>
                Accepter ce devis
              </button>
            )}
            {!enNeg && (
              <button onClick={() => setMode('negotiate')}
                style={{ width: '100%', padding: '12px', borderRadius: 10, border: '1px solid #ddd', background: 'white', color: '#555', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>
                Demander des modifications
              </button>
            )}
            <button onClick={() => setMode('refuse')}
              style={{ width: '100%', padding: '11px', borderRadius: 10, border: 'none', background: 'transparent', color: '#bbb', fontWeight: 500, fontSize: 13, cursor: 'pointer' }}>
              Refuser
            </button>
          </div>
        )}

        {/* Footer */}
        <div style={{ textAlign: 'center', fontSize: 11, color: '#ccc', marginTop: 40 }}>
          Propulsé par Zenbat · Lien personnel confidentiel
        </div>
      </div>
    </div>
  )
}
