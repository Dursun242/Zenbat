// Suivi client d'un devis (fiche devis) : envoi par email, lien public,
// demande de modification du client, historique.
//
// useDevisSuivi porte l'état et les appels ; NegotiationPanel et SuiviLog
// l'affichent. DevisDetail place l'envoi dans sa zone d'action.

import { useState, useEffect, useCallback } from 'react'
import { supabase }  from '../lib/supabase.js'
import { getToken }  from '../lib/getToken.js'
import { fmt }       from '../lib/utils.js'
import { ZB, NUM }   from '../lib/theme.js'

const fmtDT = d => d ? new Date(d).toLocaleString('fr-FR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) : '—'

const AUDIT_LABELS = {
  sent:              'Envoyé au client',
  opened:            'Consulté par le client',
  accepted:          'Signé par le client',
  refused:           'Refusé par le client',
  negotiation_sent:  'Demande de modification reçue',
  artisan_responded: 'Réponse envoyée au client',
}

export function useDevisSuivi({ devis, client, onChange }) {
  const [sending,    setSending]    = useState(false)
  const [sendErr,    setSendErr]    = useState(null)
  const [sentTo,     setSentTo]     = useState(null)
  const [publicUrl,  setPublicUrl]  = useState(null)
  const [copied,     setCopied]     = useState(false)
  const [auditLog,   setAuditLog]   = useState(null)
  const [neg,        setNeg]        = useState(null)
  const [artMsg,     setArtMsg]     = useState('')
  const [responding, setResponding] = useState(false)
  const [respErr,    setRespErr]    = useState(null)

  // public_token est généré côté serveur au 1er envoi : avant, pas de lien.
  const baseUrl = devis.public_token ? `${window.location.origin}/d/${devis.public_token}` : ''

  // Audit + négociation en cours (RLS artisan). En cas d'échec, on retombe
  // sur des états vides plutôt que de garder un historique obsolète.
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

  const send = async () => {
    if (!client?.email) { setSendErr("Ce client n'a pas d'email.") ; return false }
    setSending(true); setSendErr(null)
    try {
      const token = await getToken()
      const res   = await fetch('/api/devis-public', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'send', devis_id: devis.id }),
      })
      const data = await res.json()
      if (!res.ok) { setSendErr(data.error || "L'envoi a échoué. Réessaie."); return false }
      setPublicUrl(data.publicUrl)
      setSentTo(client.email)
      onChange({ ...devis, statut: devis.statut === 'brouillon' ? 'envoye' : devis.statut })
      loadAudit()
      return true
    } catch {
      setSendErr("Pas de connexion : le devis n'est pas parti. Réessaie.")
      return false
    } finally { setSending(false) }
  }

  const copyLink = async () => {
    // navigator.clipboard peut rejeter (permission, http://, vieux navigateur).
    try {
      await navigator.clipboard.writeText(publicUrl || baseUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (e) {
      setSendErr('Copie impossible ici : ouvre le PDF et partage-le depuis là.')
      if (import.meta.env.DEV) console.warn('[copyLink]', e?.message || e)
    }
  }

  const respond = async (response) => {
    if (responding || !neg) return
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
      if (!res.ok) { setRespErr(data.error || 'La réponse n\'est pas partie. Réessaie.'); return }
      setNeg(null); setArtMsg('')
      if (response === 'accept_client_changes') {
        onChange({ ...devis, statut: 'accepte', montant_ht: data.newHt ?? devis.montant_ht })
      } else {
        onChange({ ...devis, statut: 'envoye' })
      }
      loadAudit()
    } catch { setRespErr('Pas de connexion : la réponse n\'est pas partie. Réessaie.') } finally { setResponding(false) }
  }

  const lastSent = [...(auditLog || [])].reverse().find(e => e.event === 'sent')
  const hasLink = !!(publicUrl || baseUrl)

  return {
    sending, sendErr, sentTo, send, copyLink, copied, hasLink, lastSent,
    auditLog, neg, artMsg, setArtMsg, respond, responding, respErr,
  }
}

const btn = {
  minHeight: 44, padding: '0 16px', borderRadius: 10, fontFamily: 'inherit', fontSize: 15, fontWeight: 700, cursor: 'pointer',
}

// Demande de modification du client, en attente de réponse.
export function NegotiationPanel({ devis, suivi, onCreateIndice }) {
  const { neg, artMsg, setArtMsg, respond, responding, respErr } = suivi
  const [creating, setCreating] = useState(false)
  if (!neg) return null
  const lignesMap = new Map((devis.lignes || []).map(l => [l.id, l]))
  const changes   = Array.isArray(neg.line_changes) ? neg.line_changes : []
  const busy = responding || creating
  return (
    <section aria-labelledby="neg-title" style={{ background: ZB.sheet, border: `1px solid ${ZB.rule}`, borderTop: `3px solid ${ZB.accent}`, borderRadius: 8, padding: '16px 18px', marginBottom: 16 }}>
      <h2 id="neg-title" style={{ margin: 0, fontSize: 17, fontWeight: 700, color: ZB.ink }}>
        Le client demande des modifications{neg.round > 1 ? ` (tour ${neg.round})` : ''}
      </h2>
      <p style={{ margin: '6px 0 12px', fontSize: 15, color: ZB.ink2, lineHeight: 1.45 }}>
        Adapte le devis dans un nouvel indice, ou refuse sa proposition.
      </p>

      {changes.length > 0 && (
        <ul style={{ listStyle: 'none', margin: '0 0 12px', padding: 0, borderTop: `1px solid ${ZB.rule}` }}>
          {changes.map((c, i) => {
            const ligne = lignesMap.get(c.ligne_id)
            const designation = ligne?.designation || 'Ligne supprimée depuis'
            const unite = ligne?.unite ? ` ${ligne.unite}` : ''
            const isRemove = c.action === 'remove'
            return (
              <li key={i} style={{ padding: '10px 0', borderBottom: `1px solid ${ZB.ruleSoft}` }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: ZB.ink }}>
                  <span style={{ color: isRemove ? ZB.danger : ZB.accent }}>{isRemove ? 'Retirer' : 'Ajuster'} : </span>{designation}
                </div>
                {!isRemove && (
                  <div style={{ fontSize: 14, color: ZB.ink2, marginTop: 2, ...NUM }}>
                    Quantité {ligne?.quantite ?? '?'}{unite} → <strong style={{ color: ZB.ink }}>{c.new_qty}{unite}</strong>
                  </div>
                )}
                {c.comment && <div style={{ fontSize: 14, color: ZB.ink2, marginTop: 2 }}>« {c.comment} »</div>}
              </li>
            )
          })}
        </ul>
      )}

      {neg.budget_target && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '8px 0', marginBottom: 8, borderBottom: `1px solid ${ZB.ruleSoft}` }}>
          <span style={{ fontSize: 14, color: ZB.ink2 }}>Budget visé par le client</span>
          <strong style={{ fontSize: 16, color: ZB.ink, ...NUM }}>{fmt(neg.budget_target)} HT</strong>
        </div>
      )}

      {neg.message && (
        <blockquote style={{ margin: '0 0 12px', padding: '10px 12px', background: ZB.paper, borderRadius: 8, fontSize: 15, color: ZB.ink, whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
          {neg.message}
        </blockquote>
      )}

      <label htmlFor="neg-msg" style={{ display: 'block', fontSize: 13, fontWeight: 600, color: ZB.ink2, marginBottom: 6 }}>
        Message au client (facultatif, envoyé par mail si tu refuses)
      </label>
      <textarea id="neg-msg" value={artMsg} onChange={e => setArtMsg(e.target.value)} rows={2}
        style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 8, border: `1px solid ${ZB.field}`, fontFamily: 'inherit', fontSize: 16, resize: 'vertical', marginBottom: 12 }}/>

      {respErr && <div role="alert" style={{ color: ZB.danger, fontSize: 14, marginBottom: 8 }}>{respErr}</div>}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
        <button type="button" onClick={() => respond('refuse_client_changes')} disabled={busy}
          style={{ ...btn, background: 'none', border: `1px solid ${ZB.rule}`, color: ZB.ink, opacity: busy ? 0.6 : 1 }}>
          Refuser sa proposition
        </button>
        {onCreateIndice && (
          <button type="button" disabled={busy} onClick={async () => {
              setCreating(true)
              try { await onCreateIndice(devis.id) } finally { setCreating(false) }
            }}
            style={{ ...btn, border: 'none', background: ZB.accent, color: '#fff', opacity: busy ? 0.6 : 1 }}>
            {creating ? 'Création…' : 'Créer un nouvel indice'}
          </button>
        )}
      </div>
    </section>
  )
}

// Historique d'envoi, de consultation et de signature.
export function SuiviLog({ suivi }) {
  const { auditLog } = suivi
  const [open, setOpen] = useState(false)
  if (!auditLog || auditLog.length === 0) return null
  return (
    <section style={{ marginTop: 20 }}>
      <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open}
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', minHeight: 44, padding: '0', background: 'none', border: 'none', borderBottom: `1px solid ${ZB.rule}`, fontFamily: 'inherit', fontSize: 15, fontWeight: 700, color: ZB.ink, cursor: 'pointer' }}>
        <span>Suivi du devis <span style={{ fontWeight: 500, color: ZB.ink2 }}>· {auditLog.length} événement{auditLog.length > 1 ? 's' : ''}</span></span>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
          style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}><path d="M6 9l6 6 6-6"/></svg>
      </button>
      {open && (
        <ol style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {auditLog.map((e, i) => (
            <li key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '10px 0', borderBottom: `1px solid ${ZB.ruleSoft}`, fontSize: 14 }}>
              <span style={{ color: e.event === 'accepted' ? ZB.stamp : e.event === 'refused' ? ZB.danger : ZB.ink }}>
                {AUDIT_LABELS[e.event] || e.event}
                {e.meta?.client_name ? ` : ${e.meta.client_name}` : ''}
                {e.meta?.reason ? <span style={{ color: ZB.ink2 }}> · « {e.meta.reason} »</span> : ''}
              </span>
              <span style={{ color: ZB.ink2, whiteSpace: 'nowrap', ...NUM }}>{fmtDT(e.created_at)}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
