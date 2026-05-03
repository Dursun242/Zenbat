// Section "Suivi client" dans DevisDetail.
// Gère : envoi par email, copie du lien, audit log, panel de réponse aux négociations.

import { useState, useEffect, useCallback } from 'react'
import { supabase }  from '../lib/supabase.js'
import { getToken }  from '../lib/getToken.js'

const fmtEur = n => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n || 0)
const fmtDT  = d => d ? new Date(d).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'

const AUDIT_LABELS = {
  sent:             { icon: '✉',  label: 'Devis envoyé au client',      color: '#3b82f6' },
  opened:           { icon: '👁', label: 'Consulté par le client',       color: '#6B6358' },
  accepted:         { icon: '✅', label: 'Accepté',                       color: '#22c55e' },
  refused:          { icon: '✗',  label: 'Refusé',                       color: '#ef4444' },
  negotiation_sent: { icon: '↩',  label: 'Proposition client reçue',     color: '#f97316' },
  artisan_responded:{ icon: '↪',  label: 'Réponse envoyée',              color: '#6b21a8' },
}

export default function DevisClientActions({ devis, client, onChange }) {
  const [sending,    setSending]    = useState(false)
  const [sendErr,    setSendErr]    = useState(null)
  const [publicUrl,  setPublicUrl]  = useState(null)
  const [copied,     setCopied]     = useState(false)
  const [auditLog,   setAuditLog]   = useState(null)
  const [neg,        setNeg]        = useState(null)
  const [negLoading, setNegLoading] = useState(false)
  const [artMsg,     setArtMsg]     = useState('')
  const [responding, setResponding] = useState(false)
  const [respErr,    setRespErr]    = useState(null)
  const [showLog,    setShowLog]    = useState(false)

  const baseUrl = `${window.location.origin}/d/${devis.public_token}`

  // Charge l'audit log et la négociation en cours depuis Supabase (RLS artisan)
  const loadAudit = useCallback(async () => {
    if (!devis.id) return
    const [{ data: logs }, { data: negs }] = await Promise.all([
      supabase.from('devis_audit_log').select('event, from_party, meta, created_at').eq('devis_id', devis.id).order('created_at'),
      supabase.from('devis_negotiations').select('*').eq('devis_id', devis.id).eq('status', 'pending').order('created_at', { ascending: false }).limit(1),
    ])
    setAuditLog(logs || [])
    setNeg(negs?.[0] || null)
  }, [devis.id])

  useEffect(() => { loadAudit() }, [loadAudit])

  // ── Envoyer le devis au client ────────────────────────────────────────
  const send = async () => {
    if (!client?.email) { setSendErr("Le client n'a pas d'email renseigné."); return }
    setSending(true); setSendErr(null)
    try {
      const token = await getToken()
      const res   = await fetch('/api/devis-public', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'send', token: devis.public_token, devis_id: devis.id }),
      })
      const data = await res.json()
      if (!res.ok) { setSendErr(data.error); return }
      setPublicUrl(data.publicUrl)
      onChange({ ...devis, statut: 'envoye' })
      loadAudit()
    } catch { setSendErr('Erreur réseau') } finally { setSending(false) }
  }

  const copyLink = () => {
    navigator.clipboard.writeText(publicUrl || baseUrl).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) })
  }

  // ── Répondre à une négociation ─────────────────────────────────────────
  const respond = async (response) => {
    if (responding) return
    setResponding(true); setRespErr(null)
    try {
      const token = await getToken()
      const res   = await fetch('/api/devis-public', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          action: 'artisan_respond',
          token:  devis.public_token,
          response,
          negotiation_id: neg.id,
          artisan_message: artMsg || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setRespErr(data.error); return }
      setNeg(null); setArtMsg('')
      if (response === 'accept_client_changes') {
        onChange({ ...devis, statut: 'accepte', montant_ht: data.newHt ?? devis.montant_ht })
      } else {
        onChange({ ...devis, statut: 'envoye' })
      }
      loadAudit()
    } catch { setRespErr('Erreur réseau') } finally { setResponding(false) }
  }

  const isSent   = ['envoye', 'en_negociation', 'en_signature', 'accepte', 'refuse'].includes(devis.statut)
  const canSend  = ['brouillon', 'envoye'].includes(devis.statut) && client?.email
  const cloture  = ['accepte', 'refuse', 'remplace'].includes(devis.statut)

  return (
    <div style={{ margin: '12px 0' }}>

      {/* ── Négociation en attente ── */}
      {neg && !cloture && (
        <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 14, padding: 16, marginBottom: 12 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: '#c2410c', marginBottom: 8 }}>
            🔄 Proposition client — Round {neg.round}
          </div>

          {neg.message && (
            <div style={{ fontSize: 13, color: '#1A1612', background: 'white', borderRadius: 10, padding: '8px 12px', marginBottom: 10 }}>
              "{neg.message}"
            </div>
          )}

          {neg.budget_target && (
            <div style={{ fontSize: 12, color: '#6B6358', marginBottom: 8 }}>
              Budget cible : <strong>{fmtEur(neg.budget_target)}</strong>
            </div>
          )}

          {neg.line_changes?.length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#9A8E82', textTransform: 'uppercase', marginBottom: 6 }}>Modifications demandées</div>
              {neg.line_changes.map((c, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, fontSize: 12, padding: '4px 0', color: c.action === 'remove' ? '#ef4444' : '#f97316' }}>
                  <span>{c.action === 'remove' ? '✗ Retirer' : `~ Qté → ${c.new_qty}`}</span>
                  <span style={{ color: '#6B6358' }}>{c.comment || ''}</span>
                </div>
              ))}
            </div>
          )}

          <textarea
            value={artMsg} onChange={e => setArtMsg(e.target.value)} rows={2}
            placeholder="Message au client (optionnel — envoyé par email si vous refusez)"
            style={{ width: '100%', padding: '8px 12px', borderRadius: 10, border: '1px solid #fed7aa', fontSize: 12, resize: 'vertical', marginBottom: 10, boxSizing: 'border-box' }}
          />

          {respErr && <div style={{ color: '#ef4444', fontSize: 12, marginBottom: 8 }}>{respErr}</div>}

          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => respond('refuse_client_changes')} disabled={responding}
              style={{ flex: 1, padding: '9px', borderRadius: 10, border: '1.5px solid #ef4444', background: 'white', color: '#ef4444', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
              ✗ Refuser
            </button>
            <button onClick={() => respond('accept_client_changes')} disabled={responding}
              style={{ flex: 2, padding: '9px', borderRadius: 10, border: 'none', background: '#22c55e', color: 'white', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
              ✅ Accepter leurs modifications
            </button>
          </div>
        </div>
      )}

      {/* ── Bouton d'envoi ── */}
      {!cloture && (
        <div style={{ background: 'white', borderRadius: 14, padding: 14, border: '1px solid #E8E2D8', marginBottom: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#9A8E82', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>
            Suivi client
          </div>

          {client?.email ? (
            <div style={{ fontSize: 12, color: '#6B6358', marginBottom: 10 }}>
              ✉ {client.email}
            </div>
          ) : (
            <div style={{ fontSize: 12, color: '#f97316', marginBottom: 10 }}>
              ⚠ Aucun email renseigné pour ce client
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {canSend && (
              <button onClick={send} disabled={sending}
                style={{ padding: '8px 14px', borderRadius: 10, border: 'none', background: '#1d4ed8', color: 'white', fontWeight: 700, fontSize: 12, cursor: 'pointer', opacity: sending ? 0.7 : 1 }}>
                {sending ? 'Envoi…' : isSent ? '✉ Renvoyer au client' : '✉ Envoyer au client'}
              </button>
            )}
            {(isSent || devis.public_token) && (
              <button onClick={copyLink}
                style={{ padding: '8px 14px', borderRadius: 10, border: '1px solid #E8E2D8', background: 'white', color: copied ? '#22c55e' : '#6B6358', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>
                {copied ? '✓ Lien copié !' : '🔗 Copier le lien'}
              </button>
            )}
          </div>

          {sendErr && <div style={{ fontSize: 12, color: '#ef4444', marginTop: 8 }}>{sendErr}</div>}
        </div>
      )}

      {/* ── Audit log ── */}
      {auditLog && auditLog.length > 0 && (
        <div style={{ background: 'white', borderRadius: 14, border: '1px solid #E8E2D8', overflow: 'hidden' }}>
          <button onClick={() => setShowLog(s => !s)}
            style={{ width: '100%', padding: '10px 14px', background: 'none', border: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', fontSize: 11, fontWeight: 700, color: '#9A8E82', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            <span>Historique de suivi</span>
            <span style={{ fontSize: 10 }}>{showLog ? '▲' : '▼'}</span>
          </button>
          {showLog && (
            <div style={{ padding: '0 14px 12px', borderTop: '1px solid #F0EBE3' }}>
              {auditLog.map((e, i) => {
                const info = AUDIT_LABELS[e.event] || { icon: '·', label: e.event, color: '#9A8E82' }
                return (
                  <div key={i} style={{ display: 'flex', gap: 8, padding: '6px 0', borderBottom: i < auditLog.length - 1 ? '1px solid #F5F0E8' : 'none', fontSize: 12 }}>
                    <span style={{ color: info.color, fontSize: 14, width: 20, textAlign: 'center' }}>{info.icon}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, color: '#1A1612' }}>{info.label}
                        {e.meta?.client_name ? ` — ${e.meta.client_name}` : ''}
                        {e.meta?.reason ? <span style={{ color: '#6B6358', fontWeight: 400 }}> · "{e.meta.reason}"</span> : ''}
                      </div>
                      <div style={{ color: '#9A8E82', fontSize: 10 }}>{fmtDT(e.created_at)}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
