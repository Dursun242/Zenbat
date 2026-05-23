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

export default function DevisClientActions({ devis, client, onChange, onCreateIndice }) {
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

  // Charge l'audit log et la négociation en cours depuis Supabase (RLS artisan).
  // try/catch englobant : si une des deux requêtes throw (réseau coupé, RLS
  // refusée, etc.), on log + on retombe sur des états par défaut au lieu
  // de laisser les anciennes valeurs en place — l'utilisateur ne voit pas
  // un audit obsolète après un changement de statut.
  const loadAudit = useCallback(async () => {
    if (!devis.id) return
    try {
      const [{ data: logs }, { data: negs }] = await Promise.all([
        supabase.from('devis_audit_log').select('event, from_party, meta, created_at').eq('devis_id', devis.id).order('created_at'),
        supabase.from('devis_negotiations').select('*').eq('devis_id', devis.id).eq('status', 'pending').order('created_at', { ascending: false }).limit(1),
      ])
      setAuditLog(logs || [])
      setNeg(negs?.[0] || null)
    } catch (e) {
      if (import.meta.env.DEV) console.warn('[loadAudit]', e?.message || e)
      setAuditLog([])
      setNeg(null)
    }
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
        body: JSON.stringify({ action: 'send', devis_id: devis.id }),
      })
      const data = await res.json()
      if (!res.ok) { setSendErr(data.error); return }
      setPublicUrl(data.publicUrl)
      onChange({ ...devis, statut: 'envoye' })
      loadAudit()
    } catch { setSendErr('Erreur réseau') } finally { setSending(false) }
  }

  const copyLink = async () => {
    // navigator.clipboard peut rejeter : permission refusée, contexte non
    // sécurisé (http://), navigateur ancien, etc. Sans catch, l'utilisateur
    // croyait que la copie avait marché et collait du contenu obsolète
    // ailleurs.
    try {
      await navigator.clipboard.writeText(publicUrl || baseUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (e) {
      setSendErr("Copie indisponible — sélectionnez et copiez le lien à la main.")
      if (import.meta.env.DEV) console.warn('[copyLink]', e?.message || e)
    }
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
      {neg && !cloture && (() => {
        // Map id → ligne pour afficher les désignations dans la liste
        // des changements (sans ça l'artisan ne sait pas QUELLES lignes
        // le client veut retirer ou ajuster).
        const lignesMap = new Map((devis.lignes || []).map(l => [l.id, l]))
        const changes   = Array.isArray(neg.line_changes) ? neg.line_changes : []

        return (
        <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 14, padding: 16, marginBottom: 12 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: '#c2410c', marginBottom: 4 }}>
            🔄 Demande de modification du client — Round {neg.round}
          </div>
          <div style={{ fontSize: 12, color: '#9a3412', marginBottom: 12, lineHeight: 1.5 }}>
            Le client propose les changements ci-dessous. À vous d'adapter le devis (créez un nouvel indice avec vos ajustements) ou de refuser sa proposition.
          </div>

          {changes.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#9A8E82', textTransform: 'uppercase', marginBottom: 6, letterSpacing: '0.4px' }}>Modifications demandées</div>
              {changes.map((c, i) => {
                const ligne       = lignesMap.get(c.ligne_id)
                const designation = ligne?.designation || `Ligne #${c.ligne_id?.slice?.(0, 6) || '?'}`
                const unite       = ligne?.unite ? ` ${ligne.unite}` : ''
                const isRemove    = c.action === 'remove'
                return (
                  <div key={i} style={{ background: 'white', borderRadius: 10, padding: '10px 12px', marginBottom: 6, border: '1px solid #fed7aa' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ display: 'inline-block', background: isRemove ? '#fee2e2' : '#fff7ed', color: isRemove ? '#991b1b' : '#c2410c', fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4, letterSpacing: '0.4px' }}>
                        {isRemove ? 'RETIRER' : 'AJUSTER'}
                      </span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#1A1612', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>{designation}</span>
                    </div>
                    {!isRemove && (
                      <div style={{ fontSize: 12, color: '#555', marginLeft: 2 }}>
                        Quantité : <strong>{ligne?.quantite ?? '?'}{unite}</strong> → <strong style={{ color: '#c2410c' }}>{c.new_qty}{unite}</strong>
                      </div>
                    )}
                    {c.comment && (
                      <div style={{ fontSize: 12, color: '#6B6358', fontStyle: 'italic', marginTop: 4, marginLeft: 2 }}>
                        « {c.comment} »
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {neg.budget_target && (
            <div style={{ background: 'white', borderRadius: 10, padding: '10px 12px', marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #fed7aa' }}>
              <span style={{ fontSize: 12, color: '#6B6358' }}>Budget cible client</span>
              <strong style={{ fontSize: 14, color: '#1A1612' }}>{fmtEur(neg.budget_target)} HT</strong>
            </div>
          )}

          {neg.message && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#9A8E82', textTransform: 'uppercase', marginBottom: 6, letterSpacing: '0.4px' }}>Message du client</div>
              <div style={{ fontSize: 13, color: '#1A1612', background: 'white', borderRadius: 10, padding: '10px 12px', border: '1px solid #fed7aa', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                {neg.message}
              </div>
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
              style={{ flex: 1, padding: '9px', borderRadius: 10, border: '1.5px solid #ef4444', background: 'white', color: '#ef4444', fontWeight: 700, fontSize: 12, cursor: responding ? 'default' : 'pointer', opacity: responding ? 0.6 : 1 }}>
              ✗ Refuser
            </button>
            {onCreateIndice && (
              <button onClick={() => onCreateIndice(devis.id)} disabled={responding}
                style={{ flex: 2, padding: '9px', borderRadius: 10, border: 'none', background: '#6b21a8', color: 'white', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                ✦ Créer un nouvel indice
              </button>
            )}
          </div>
        </div>
        )
      })()}

      {/* ── Bouton d'envoi ── */}
      {!cloture && (
        <div style={{ background: 'white', borderRadius: 12, padding: '10px 12px', border: '1px solid #E8E2D8', marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#9A8E82', textTransform: 'uppercase', letterSpacing: '0.5px', flexShrink: 0 }}>Suivi</span>
            {client?.email
              ? <a href={`mailto:${client.email}`} style={{ fontSize: 12, color: '#1d4ed8', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textDecoration: 'none' }}>✉ {client.email}</a>
              : <span style={{ fontSize: 12, color: '#f97316' }}>⚠ Pas d'email</span>
            }
            {canSend && (
              <button onClick={send} disabled={sending}
                style={{ padding: '6px 12px', borderRadius: 8, border: 'none', background: '#1d4ed8', color: 'white', fontWeight: 700, fontSize: 11, cursor: 'pointer', opacity: sending ? 0.7 : 1, flexShrink: 0 }}>
                {sending ? 'Envoi…' : isSent ? '✉ Renvoyer' : '✉ Envoyer'}
              </button>
            )}
            {(isSent || devis.public_token) && (
              <button onClick={copyLink}
                style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #E8E2D8', background: 'white', color: copied ? '#22c55e' : '#6B6358', fontWeight: 600, fontSize: 11, cursor: 'pointer', flexShrink: 0 }}>
                {copied ? '✓ Copié' : '🔗 Lien'}
              </button>
            )}
          </div>
          {sendErr && <div style={{ fontSize: 11, color: '#ef4444', marginTop: 6 }}>{sendErr}</div>}
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
