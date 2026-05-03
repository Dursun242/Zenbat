import { useState, useEffect, useCallback } from 'react'

const fmtEur = n => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(n || 0)
const fmtD   = d => d ? new Date(d).toLocaleDateString('fr-FR') : '—'
const fmtDT  = d => d ? new Date(d).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'

const CAT_LABELS = {
  assurance_decennale: '🛡 Assurance décennale',
  attestation_tva_10:  '📋 Attestation TVA 10%',
  attestation_tva_55:  '📋 Attestation TVA 5.5%',
  plaquette:           '📄 Plaquette',
  fiche_technique:     '🔧 Fiche technique',
  autre:               '📎 Document annexe',
}

const AUDIT_LABELS = {
  sent:             { icon: '✉', label: 'Devis envoyé' },
  opened:           { icon: '👁', label: 'Consulté par le client' },
  accepted:         { icon: '✅', label: 'Accepté' },
  refused:          { icon: '✗', label: 'Refusé' },
  negotiation_sent: { icon: '↩', label: 'Proposition du client' },
  artisan_responded:{ icon: '↪', label: 'Réponse de l'artisan' },
}

// ── Composants utilitaires ─────────────────────────────────────────────────

function Btn({ children, onClick, color = '#22c55e', outline, disabled, style = {} }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      padding: '12px 20px', borderRadius: 12, fontSize: 14, fontWeight: 700,
      cursor: disabled ? 'default' : 'pointer', transition: 'opacity .15s',
      opacity: disabled ? 0.6 : 1, border: outline ? `2px solid ${color}` : 'none',
      background: outline ? 'transparent' : color,
      color: outline ? color : 'white',
      ...style,
    }}>{children}</button>
  )
}

function ErrBox({ msg }) {
  if (!msg) return null
  return <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '10px 14px', color: '#991b1b', fontSize: 13, marginTop: 12 }}>{msg}</div>
}

// ── Phase : vérification email ─────────────────────────────────────────────

function PhaseEmail({ data, onVerified, onSessionId }) {
  const [email, setEmail]   = useState('')
  const [sent,  setSent]    = useState(false)
  const [sessId, setSessId] = useState(null)
  const [code,  setCode]    = useState('')
  const [busy,  setBusy]    = useState(false)
  const [err,   setErr]     = useState(null)

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
    <div style={{ maxWidth: 400, margin: '40px auto', padding: '0 16px' }}>
      <div style={{ background: 'white', borderRadius: 20, padding: 28, boxShadow: '0 4px 24px rgba(0,0,0,.10)' }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 32 }}>🔒</div>
          <h2 style={{ margin: '8px 0 4px', fontSize: 18, fontWeight: 700, color: '#1A1612' }}>Accédez à votre devis</h2>
          <p style={{ color: '#6B6358', fontSize: 13, margin: 0 }}>
            {data.artisan?.company && <><strong>{data.artisan.company}</strong> —{' '}</>}
            Devis {data.numero}{data.objet ? ` · ${data.objet}` : ''}
          </p>
          {data.montant_ht > 0 && (
            <div style={{ fontSize: 22, fontWeight: 800, color: '#1A1612', marginTop: 8 }}>{fmtEur(data.montant_ht)} HT</div>
          )}
        </div>

        {!sent ? (
          <>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#6B6358', marginBottom: 6 }}>
              VOTRE EMAIL{data.emailHint ? ` (ex : ${data.emailHint})` : ''}
            </label>
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && email && requestOtp()}
              placeholder="votre@email.fr" autoFocus
              style={{ width: '100%', padding: '12px 14px', borderRadius: 12, border: '1.5px solid #E8E2D8', fontSize: 14, outline: 'none', boxSizing: 'border-box', marginBottom: 12 }}
            />
            <Btn onClick={requestOtp} disabled={!email || busy} style={{ width: '100%' }}>
              {busy ? 'Envoi…' : 'Recevoir mon code →'}
            </Btn>
          </>
        ) : (
          <>
            <p style={{ fontSize: 13, color: '#6B6358', textAlign: 'center', marginBottom: 16 }}>
              Code à 6 chiffres envoyé à <strong>{email}</strong>
            </p>
            <input
              type="text" inputMode="numeric" value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              onKeyDown={e => e.key === 'Enter' && code.length === 6 && verifyOtp()}
              placeholder="123456" autoFocus maxLength={6}
              style={{ width: '100%', padding: '14px', borderRadius: 12, border: '1.5px solid #E8E2D8', fontSize: 28, fontWeight: 800, letterSpacing: 8, textAlign: 'center', outline: 'none', boxSizing: 'border-box', marginBottom: 12 }}
            />
            <Btn onClick={verifyOtp} disabled={code.length !== 6 || busy} style={{ width: '100%' }}>
              {busy ? 'Vérification…' : 'Accéder au devis →'}
            </Btn>
            <button onClick={() => { setSent(false); setCode(''); setErr(null) }}
              style={{ display: 'block', width: '100%', marginTop: 10, background: 'none', border: 'none', color: '#9A8E82', fontSize: 12, cursor: 'pointer' }}>
              Changer d'email
            </button>
          </>
        )}
        <ErrBox msg={err} />
      </div>
    </div>
  )
}

// ── Mode négociation ───────────────────────────────────────────────────────

function NegotiateMode({ lignes, token, sessionId, onDone, onCancel }) {
  const [actions,  setActions]  = useState({})   // {id: 'remove'|'keep'}
  const [qtys,     setQtys]     = useState({})   // {id: new_qty}
  const [comments, setComments] = useState({})   // {id: comment}
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

  const diff = newTotal - ouvrages.reduce((s, l) => s + (l.quantite || 0) * (l.prix_unitaire || 0), 0)

  return (
    <div style={{ background: 'white', borderRadius: 16, padding: 20, marginBottom: 16 }}>
      <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 700 }}>✏ Proposer des modifications</h3>
      <p style={{ fontSize: 13, color: '#6B6358', margin: '0 0 16px' }}>
        Retirez ou ajustez les prestations. L'artisan recevra votre proposition.
      </p>

      {ouvrages.map(l => {
        const removed = actions[l.id] === 'remove'
        const qty     = qtys[l.id] !== undefined ? qtys[l.id] : l.quantite
        return (
          <div key={l.id} style={{ padding: '10px 12px', borderRadius: 10, marginBottom: 8, background: removed ? '#fef2f2' : '#FAF7F2', border: `1px solid ${removed ? '#fecaca' : '#F0EBE3'}`, opacity: removed ? 0.7 : 1 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <div style={{ display: 'flex', gap: 4, flexShrink: 0, marginTop: 2 }}>
                <button onClick={() => setActions(a => ({ ...a, [l.id]: undefined }))}
                  style={{ width: 22, height: 22, borderRadius: 6, border: `2px solid ${!removed ? '#22c55e' : '#D1D5DB'}`, background: !removed ? '#22c55e' : 'white', color: !removed ? 'white' : '#9A8E82', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>✓</button>
                <button onClick={() => setActions(a => ({ ...a, [l.id]: 'remove' }))}
                  style={{ width: 22, height: 22, borderRadius: 6, border: `2px solid ${removed ? '#ef4444' : '#D1D5DB'}`, background: removed ? '#ef4444' : 'white', color: removed ? 'white' : '#9A8E82', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>✗</button>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, textDecoration: removed ? 'line-through' : 'none', color: '#1A1612' }}>{l.designation}</div>
                {l.lot && <div style={{ fontSize: 10, color: '#9A8E82', marginTop: 1 }}>{l.lot}</div>}
                {!removed && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
                    <span style={{ fontSize: 11, color: '#6B6358' }}>Qté :</span>
                    <input type="number" min={0.1} step={0.1} value={qty}
                      onChange={e => setQtys(q => ({ ...q, [l.id]: e.target.value }))}
                      style={{ width: 60, padding: '3px 6px', borderRadius: 6, border: '1px solid #E8E2D8', fontSize: 13, textAlign: 'right' }} />
                    <span style={{ fontSize: 11, color: '#9A8E82' }}>{l.unite}</span>
                    <span style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 700 }}>
                      {fmtEur(Number(qty) * (l.prix_unitaire || 0))}
                    </span>
                  </div>
                )}
                <input value={comments[l.id] || ''} onChange={e => setComments(c => ({ ...c, [l.id]: e.target.value }))}
                  placeholder={removed ? 'Raison (optionnel)' : 'Commentaire (optionnel)'}
                  style={{ width: '100%', marginTop: 6, padding: '4px 8px', borderRadius: 6, border: '1px solid #E8E2D8', fontSize: 12, boxSizing: 'border-box' }} />
              </div>
            </div>
          </div>
        )
      })}

      {/* Budget cible */}
      <div style={{ background: '#F0F4FF', borderRadius: 12, padding: '12px 14px', marginBottom: 12 }}>
        <label style={{ fontSize: 12, fontWeight: 600, color: '#3b82f6', display: 'block', marginBottom: 6 }}>Budget cible (optionnel)</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input type="number" value={budget} onChange={e => setBudget(e.target.value)} placeholder="Ex : 7 000"
            style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: '1.5px solid #bfdbfe', fontSize: 14, outline: 'none' }} />
          <span style={{ fontSize: 13, color: '#6B6358' }}>€ HT</span>
        </div>
        {budget && Number(budget) < newTotal && (
          <div style={{ fontSize: 11, color: '#6b21a8', marginTop: 6 }}>
            Écart : {fmtEur(newTotal - Number(budget))} au-dessus de votre budget
          </div>
        )}
      </div>

      {/* Message global */}
      <textarea value={message} onChange={e => setMessage(e.target.value)} rows={3}
        placeholder="Message pour l'artisan (ex : je n'ai pas besoin de l'échafaudage car…)"
        style={{ width: '100%', padding: '10px 12px', borderRadius: 12, border: '1.5px solid #E8E2D8', fontSize: 13, resize: 'vertical', boxSizing: 'border-box', marginBottom: 12 }} />

      {/* Récap */}
      <div style={{ background: '#FAF7F2', borderRadius: 12, padding: '12px 14px', marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 13, color: '#6B6358' }}>Nouveau total estimé</span>
          <span style={{ fontSize: 18, fontWeight: 800, color: '#1A1612' }}>{fmtEur(newTotal)} HT</span>
        </div>
        {diff < 0 && <div style={{ fontSize: 12, color: '#22c55e', marginTop: 4 }}>Économie : {fmtEur(Math.abs(diff))}</div>}
      </div>

      <ErrBox msg={err} />
      <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
        <Btn onClick={onCancel} outline color="#6B6358" style={{ flex: 1 }}>Annuler</Btn>
        <Btn onClick={submit} disabled={busy} style={{ flex: 2 }}>
          {busy ? 'Envoi…' : 'Envoyer ma proposition →'}
        </Btn>
      </div>
    </div>
  )
}

// ── Page principale ────────────────────────────────────────────────────────

export default function DevisPublicPage({ token }) {
  const [data,      setData]      = useState(null)
  const [sessionId, setSessionId] = useState(null)
  const [phase,     setPhase]     = useState('loading') // loading|verify|view|accepted|refused|done
  const [mode,      setMode]      = useState(null)      // null|accept|refuse|negotiate
  const [clientName, setClientName] = useState('')
  const [refuseReason, setRefuseReason] = useState('')
  const [busy,  setBusy]  = useState(false)
  const [err,   setErr]   = useState(null)

  const load = useCallback(async (sid) => {
    const id = sid || sessionId
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

  // ── Rendu ──────────────────────────────────────────────────────────────
  if (phase === 'loading') {
    return <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#FAF7F2', color: '#9A8E82', fontSize: 14 }}>Chargement…</div>
  }

  if (phase === 'error') {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#FAF7F2', padding: 20 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 48 }}>🔗</div>
          <h2 style={{ color: '#1A1612' }}>Devis introuvable</h2>
          <p style={{ color: '#6B6358' }}>Ce lien est invalide ou a expiré.</p>
        </div>
      </div>
    )
  }

  if (phase === 'verify') {
    return (
      <div style={{ minHeight: '100vh', background: '#FAF7F2', fontFamily: 'Inter, system-ui, sans-serif' }}>
        <Header artisan={data?.artisan} />
        <PhaseEmail data={data} onVerified={() => load(sessionId)} onSessionId={id => { setSessionId(id); load(id) }} />
      </div>
    )
  }

  if (phase === 'accepted') {
    return (
      <div style={{ minHeight: '100vh', background: '#FAF7F2', fontFamily: 'Inter, system-ui, sans-serif' }}>
        <Header artisan={data?.artisan} />
        <div style={{ maxWidth: 480, margin: '40px auto', padding: '0 16px', textAlign: 'center' }}>
          <div style={{ background: 'white', borderRadius: 20, padding: 32, boxShadow: '0 4px 24px rgba(0,0,0,.08)' }}>
            <div style={{ fontSize: 48 }}>✅</div>
            <h2 style={{ margin: '12px 0 8px', color: '#065f46' }}>Devis accepté</h2>
            <p style={{ color: '#6B6358', fontSize: 14 }}>
              Le devis <strong>{data.numero}</strong> a été accepté{data.client_accepted_at ? ` le ${fmtD(data.client_accepted_at)}` : ''}.
              {data.artisan?.company && <><br/>L'équipe de <strong>{data.artisan.company}</strong> prendra contact avec vous prochainement.</>}
            </p>
            {data.artisan?.phone && <p style={{ color: '#6B6358', fontSize: 13 }}>📞 {data.artisan.phone}</p>}
          </div>
        </div>
      </div>
    )
  }

  if (phase === 'refused') {
    return (
      <div style={{ minHeight: '100vh', background: '#FAF7F2', fontFamily: 'Inter, system-ui, sans-serif' }}>
        <Header artisan={data?.artisan} />
        <div style={{ maxWidth: 480, margin: '40px auto', padding: '0 16px', textAlign: 'center' }}>
          <div style={{ background: 'white', borderRadius: 20, padding: 32, boxShadow: '0 4px 24px rgba(0,0,0,.08)' }}>
            <div style={{ fontSize: 48 }}>✗</div>
            <h2 style={{ margin: '12px 0 8px', color: '#991b1b' }}>Devis refusé</h2>
            <p style={{ color: '#6B6358', fontSize: 14 }}>Ce devis a été refusé. Contactez l'artisan si vous souhaitez discuter d'une nouvelle proposition.</p>
            {data.artisan?.email && <p style={{ color: '#6B6358', fontSize: 13 }}>✉ {data.artisan.email}</p>}
          </div>
        </div>
      </div>
    )
  }

  // ── Vue principale du devis ────────────────────────────────────────────
  const lignes       = data?.lignes || []
  const ouvrages     = lignes.filter(l => l.type_ligne === 'ouvrage')
  const lots         = [...new Set(ouvrages.map(l => l.lot || 'Divers'))]
  const totalHT      = ouvrages.reduce((s, l) => s + (l.quantite || 0) * (l.prix_unitaire || 0), 0)
  const tvaRate      = ouvrages[0]?.tva_rate ?? 20
  const totalTTC     = totalHT * (1 + tvaRate / 100)
  const cloture      = ['accepte', 'refuse', 'remplace'].includes(data?.statut)
  const enNeg        = data?.statut === 'en_negociation'

  return (
    <div style={{ minHeight: '100vh', background: '#FAF7F2', fontFamily: 'Inter, system-ui, sans-serif', paddingBottom: 60 }}>
      <style>{`* { box-sizing: border-box } input,textarea { font-family: inherit }`}</style>
      <Header artisan={data?.artisan} />

      <div style={{ maxWidth: 680, margin: '0 auto', padding: '16px 16px 0' }}>

        {/* En-tête devis */}
        <div style={{ background: 'white', borderRadius: 16, padding: 20, marginBottom: 12, boxShadow: '0 1px 4px rgba(0,0,0,.06)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
            <div>
              <div style={{ fontSize: 11, color: '#9A8E82', fontFamily: 'monospace' }}>{data.numero}</div>
              {data.objet && <h2 style={{ margin: '4px 0', fontSize: 18, fontWeight: 700, color: '#1A1612' }}>{data.objet}</h2>}
              <div style={{ fontSize: 12, color: '#9A8E82', marginTop: 4 }}>
                Émis le {fmtD(data.date_emission)}{data.date_validite ? ` · Valable jusqu'au ${fmtD(data.date_validite)}` : ''}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 26, fontWeight: 800, color: '#1A1612' }}>{fmtEur(totalHT)}</div>
              <div style={{ fontSize: 11, color: '#9A8E82' }}>HT · TVA {tvaRate}%</div>
            </div>
          </div>

          {enNeg && (
            <div style={{ marginTop: 12, background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: '#c2410c', fontWeight: 600 }}>
              🔄 Votre proposition est en cours d'examen par l'artisan
            </div>
          )}
        </div>

        {/* Lignes du devis */}
        {lots.map(lot => (
          <div key={lot} style={{ background: 'white', borderRadius: 16, padding: 16, marginBottom: 10, boxShadow: '0 1px 4px rgba(0,0,0,.06)' }}>
            {lots.length > 1 && <div style={{ fontSize: 10, fontWeight: 700, color: '#9A8E82', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: 10 }}>{lot}</div>}
            {ouvrages.filter(l => (l.lot || 'Divers') === lot).map(l => (
              <div key={l.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, padding: '8px 0', borderBottom: '1px solid #F5F0E8' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#1A1612' }}>{l.designation}</div>
                  {l.description && <div style={{ fontSize: 12, color: '#6B6358', marginTop: 2 }}>{l.description}</div>}
                  <div style={{ fontSize: 11, color: '#9A8E82', marginTop: 2 }}>{l.quantite} {l.unite} × {fmtEur(l.prix_unitaire)}</div>
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#1A1612', flexShrink: 0 }}>
                  {fmtEur((l.quantite || 0) * (l.prix_unitaire || 0))}
                </div>
              </div>
            ))}
            {/* Lignes texte du lot */}
            {lignes.filter(l => l.type_ligne === 'texte' && (l.lot || 'Divers') === lot).map(l => (
              <div key={l.id} style={{ fontSize: 12, color: '#6B6358', fontStyle: 'italic', padding: '6px 0' }}>{l.designation}</div>
            ))}
          </div>
        ))}

        {/* Totaux */}
        <div style={{ background: 'white', borderRadius: 16, padding: 16, marginBottom: 12, boxShadow: '0 1px 4px rgba(0,0,0,.06)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 13, color: '#6B6358' }}>Total HT</span>
            <span style={{ fontWeight: 700 }}>{fmtEur(totalHT)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ fontSize: 13, color: '#6B6358' }}>TVA {tvaRate}%</span>
            <span style={{ fontWeight: 700 }}>{fmtEur(totalTTC - totalHT)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '2px solid #1A1612', paddingTop: 10 }}>
            <span style={{ fontWeight: 800, fontSize: 15 }}>Total TTC</span>
            <span style={{ fontWeight: 800, fontSize: 18 }}>{fmtEur(totalTTC)}</span>
          </div>
        </div>

        {/* Documents annexes */}
        {data.docs?.length > 0 && (
          <div style={{ background: 'white', borderRadius: 16, padding: 16, marginBottom: 12, boxShadow: '0 1px 4px rgba(0,0,0,.06)' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#9A8E82', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>Documents joints</div>
            {data.docs.map(doc => (
              <a key={doc.id} href={`/api/devis-public?token=${token}&session_id=${sessionId}&doc_id=${doc.id}`}
                target="_blank" rel="noopener noreferrer"
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 10, background: '#FAF7F2', marginBottom: 6, textDecoration: 'none', color: '#1A1612' }}>
                <span style={{ fontSize: 16 }}>{CAT_LABELS[doc.category]?.split(' ')[0] || '📎'}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{doc.name}</div>
                  <div style={{ fontSize: 10, color: '#9A8E82' }}>{CAT_LABELS[doc.category]?.slice(2) || 'Document'}</div>
                </div>
                <span style={{ fontSize: 11, color: '#3b82f6' }}>Télécharger ↓</span>
              </a>
            ))}
          </div>
        )}

        {/* Négociation en cours — détail */}
        {enNeg && data.negotiation && (
          <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 16, padding: 16, marginBottom: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#c2410c', marginBottom: 10 }}>Votre proposition envoyée</div>
            {data.negotiation.message && <p style={{ fontSize: 13, color: '#1A1612', margin: '0 0 8px' }}>{data.negotiation.message}</p>}
            {data.negotiation.budget_target && <div style={{ fontSize: 12, color: '#6B6358' }}>Budget cible : <strong>{fmtEur(data.negotiation.budget_target)}</strong></div>}
          </div>
        )}

        {/* Journal d'activité */}
        {data.auditLog?.length > 0 && (
          <div style={{ background: 'white', borderRadius: 16, padding: 16, marginBottom: 16, boxShadow: '0 1px 4px rgba(0,0,0,.06)' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#9A8E82', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>Historique</div>
            {data.auditLog.map((e, i) => {
              const info = AUDIT_LABELS[e.event] || { icon: '·', label: e.event }
              return (
                <div key={i} style={{ display: 'flex', gap: 10, padding: '5px 0', fontSize: 12 }}>
                  <span style={{ color: '#9A8E82', minWidth: 80 }}>{fmtDT(e.created_at)}</span>
                  <span>{info.icon}</span>
                  <span style={{ color: '#6B6358' }}>{info.label}{e.meta?.client_name ? ` par ${e.meta.client_name}` : ''}</span>
                </div>
              )
            })}
          </div>
        )}

        {/* Modes modaux */}
        {mode === 'negotiate' && !cloture && !enNeg && (
          <NegotiateMode lignes={lignes} token={token} sessionId={sessionId}
            onDone={() => { setMode(null); load(sessionId) }}
            onCancel={() => setMode(null)} />
        )}

        {mode === 'accept' && (
          <div style={{ background: 'white', borderRadius: 16, padding: 20, marginBottom: 16, boxShadow: '0 1px 4px rgba(0,0,0,.06)' }}>
            <h3 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700, color: '#065f46' }}>✅ Accepter ce devis</h3>
            <p style={{ fontSize: 13, color: '#6B6358', marginTop: 0 }}>En acceptant, vous confirmez votre accord pour le montant de <strong>{fmtEur(totalHT)} HT ({fmtEur(totalTTC)} TTC)</strong>.</p>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#6B6358', marginBottom: 6 }}>VOTRE NOM COMPLET</label>
            <input value={clientName} onChange={e => setClientName(e.target.value)} placeholder="Jean Dupont"
              style={{ width: '100%', padding: '12px 14px', borderRadius: 12, border: '1.5px solid #E8E2D8', fontSize: 14, marginBottom: 12 }} />
            <ErrBox msg={err} />
            <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
              <Btn onClick={() => { setMode(null); setErr(null) }} outline color="#6B6358" style={{ flex: 1 }}>Annuler</Btn>
              <Btn onClick={handleAccept} disabled={!clientName.trim() || busy} color="#22c55e" style={{ flex: 2 }}>
                {busy ? 'Confirmation…' : 'Confirmer l\'acceptation'}
              </Btn>
            </div>
          </div>
        )}

        {mode === 'refuse' && (
          <div style={{ background: 'white', borderRadius: 16, padding: 20, marginBottom: 16, boxShadow: '0 1px 4px rgba(0,0,0,.06)' }}>
            <h3 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700, color: '#991b1b' }}>✗ Refuser ce devis</h3>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#6B6358', marginBottom: 6 }}>RAISON DU REFUS</label>
            <textarea value={refuseReason} onChange={e => setRefuseReason(e.target.value)} rows={3}
              placeholder="Ex : Tarif trop élevé pour mon budget, j'ai eu une autre proposition…"
              style={{ width: '100%', padding: '10px 12px', borderRadius: 12, border: '1.5px solid #E8E2D8', fontSize: 13, resize: 'vertical', marginBottom: 12 }} />
            <ErrBox msg={err} />
            <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
              <Btn onClick={() => { setMode(null); setErr(null) }} outline color="#6B6358" style={{ flex: 1 }}>Annuler</Btn>
              <Btn onClick={handleRefuse} disabled={!refuseReason.trim() || busy} color="#ef4444" style={{ flex: 2 }}>
                {busy ? 'Envoi…' : 'Confirmer le refus'}
              </Btn>
            </div>
          </div>
        )}

        {/* Boutons d'action principaux */}
        {!cloture && mode === null && (
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {!enNeg && (
              <Btn onClick={() => setMode('negotiate')} outline color="#f97316" style={{ flex: 1, minWidth: 120 }}>
                ✏ Négocier
              </Btn>
            )}
            <Btn onClick={() => setMode('refuse')} outline color="#ef4444" style={{ flex: 1, minWidth: 100 }}>
              ✗ Refuser
            </Btn>
            {!enNeg && (
              <Btn onClick={() => setMode('accept')} color="#22c55e" style={{ flex: 2, minWidth: 160 }}>
                ✅ Accepter
              </Btn>
            )}
          </div>
        )}

        {/* Pied de page */}
        <div style={{ textAlign: 'center', fontSize: 11, color: '#cbd5e1', marginTop: 32 }}>
          Propulsé par <strong style={{ color: '#9A8E82' }}>Zenbat</strong> · Lien personnel confidentiel
        </div>
      </div>
    </div>
  )
}

function Header({ artisan }) {
  return (
    <div style={{ background: '#1A1612', padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.5px' }}>
        <span style={{ color: '#22c55e' }}>Zen</span><span style={{ color: 'white' }}>bat</span>
      </div>
      {artisan?.company && <div style={{ color: '#9A8E82', fontSize: 13, fontWeight: 600 }}>{artisan.company}</div>}
    </div>
  )
}
