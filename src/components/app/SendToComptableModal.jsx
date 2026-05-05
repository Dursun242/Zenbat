// Modal d'envoi de l'export factures au comptable.
// - Liste les périodes (mois dernier par défaut)
// - Permet d'éditer l'email comptable (sauvegardé sur profiles.comptable_email)
// - Appelle POST /api/account { action:'send-comptable', period, from?, to?, email }

import { useState, useEffect, useRef } from "react"
import { getToken } from "../../lib/getToken.js"
import { supabase } from "../../lib/supabase.js"

const PERIODS = [
  { id: 'last_month',   label: 'Mois dernier' },
  { id: 'this_month',   label: 'Mois en cours' },
  { id: 'this_quarter', label: 'Trimestre en cours' },
  { id: 'this_year',    label: 'Année en cours' },
  { id: 'all',          label: 'Tout l\'historique' },
  { id: 'custom',       label: 'Période personnalisée' },
]

export default function SendToComptableModal({ user, onClose }) {
  const [period, setPeriod]   = useState('last_month')
  const [from, setFrom]       = useState('')
  const [to, setTo]           = useState('')
  const [email, setEmail]     = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const [result, setResult]   = useState(null)
  const emailRef = useRef(null)

  // Préremplir l'email comptable depuis profiles
  useEffect(() => {
    let cancel = false
    supabase.from('profiles')
      .select('comptable_email').eq('id', user?.id).maybeSingle()
      .then(({ data }) => { if (!cancel && data?.comptable_email) setEmail(data.comptable_email) })
    return () => { cancel = true }
  }, [user?.id])

  async function send() {
    if (loading) return
    setError('')
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      setError('Adresse email invalide')
      emailRef.current?.focus()
      return
    }
    if (period === 'custom' && (!from || !to)) {
      setError('Sélectionnez une date de début et de fin')
      return
    }
    setLoading(true)
    try {
      const tok = await getToken()
      const res = await fetch('/api/account', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` },
        body:    JSON.stringify({ action: 'send-comptable', period, from, to, email }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || `Erreur ${res.status}`)
      setResult(data)
    } catch (e) {
      setError(e.message || 'Erreur d\'envoi')
    } finally {
      setLoading(false)
    }
  }

  const C = {
    terra:     '#C97B5C',
    terradark: '#A55F44',
    cream:     '#FAF7F2',
    ink:       '#1A1612',
    muted:     '#6B6358',
    border:    '#E8E2D8',
  }

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget && !loading) onClose() }}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 300,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
      }}>
      <div style={{
        background: 'white', borderRadius: 16, width: '100%', maxWidth: 480,
        maxHeight: '90vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 12px 40px rgba(0,0,0,.2)',
      }}>
        {/* Header */}
        <div style={{ padding: '18px 20px 14px', borderBottom: `1px solid ${C.cream}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.terra, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 4 }}>
              Comptable
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: C.ink }}>
              Envoyer l'export factures
            </div>
          </div>
          <button onClick={onClose} disabled={loading}
            style={{ background: 'none', border: 'none', fontSize: 22, color: C.muted, cursor: loading ? 'wait' : 'pointer', lineHeight: 1, padding: 4 }}>
            ×
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: 20, overflowY: 'auto' }}>
          {result ? (
            <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 12, padding: 16, color: '#166534' }}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>✓ Email envoyé à {result.sent_to}</div>
              <div style={{ fontSize: 13, lineHeight: 1.5 }}>
                {result.count} facture{result.count > 1 ? 's' : ''} · Total TTC : {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(result.total_ttc || 0)}
                {typeof result.pdfs === 'number' && (
                  <div style={{ marginTop: 4, fontSize: 12, color: '#15803D' }}>
                    {result.pdfs > 0
                      ? `+ ${result.pdfs} PDF${result.pdfs > 1 ? 's' : ''} en pièce jointe`
                      : 'CSV uniquement (aucun PDF disponible)'}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: C.muted, marginBottom: 6 }}>
                Email du comptable
              </label>
              <input
                ref={emailRef}
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="comptable@exemple.fr"
                disabled={loading}
                style={{
                  width: '100%', boxSizing: 'border-box', padding: '10px 12px',
                  border: `1.5px solid ${C.border}`, borderRadius: 10,
                  fontSize: 14, color: C.ink, outline: 'none', fontFamily: 'inherit',
                }}
              />
              <div style={{ fontSize: 11, color: C.muted, marginTop: 6, marginBottom: 18 }}>
                Mémorisé pour les prochains envois.
              </div>

              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: C.muted, marginBottom: 6 }}>
                Période
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {PERIODS.map(p => {
                  const active = p.id === period
                  return (
                    <button
                      key={p.id}
                      onClick={() => setPeriod(p.id)}
                      disabled={loading}
                      style={{
                        padding: '10px 12px', borderRadius: 10,
                        border: `1.5px solid ${active ? C.terra : C.border}`,
                        background: active ? '#FFF6F0' : 'white',
                        color: active ? C.terradark : C.ink,
                        fontSize: 13, fontWeight: active ? 600 : 500,
                        cursor: loading ? 'wait' : 'pointer', textAlign: 'left',
                        fontFamily: 'inherit',
                      }}>
                      {p.label}
                    </button>
                  )
                })}
              </div>

              {period === 'custom' && (
                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: 11, color: C.muted, marginBottom: 4 }}>Du</label>
                    <input type="date" value={from} onChange={e => setFrom(e.target.value)} disabled={loading}
                      style={{ width: '100%', boxSizing: 'border-box', padding: 10, border: `1.5px solid ${C.border}`, borderRadius: 10, fontSize: 13, fontFamily: 'inherit' }}/>
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: 11, color: C.muted, marginBottom: 4 }}>Au</label>
                    <input type="date" value={to} onChange={e => setTo(e.target.value)} disabled={loading}
                      style={{ width: '100%', boxSizing: 'border-box', padding: 10, border: `1.5px solid ${C.border}`, borderRadius: 10, fontSize: 13, fontFamily: 'inherit' }}/>
                  </div>
                </div>
              )}

              <div style={{ marginTop: 18, padding: 12, background: C.cream, borderRadius: 10, fontSize: 12, color: C.muted, lineHeight: 1.5 }}>
                Le comptable recevra un email avec <strong>2 fichiers CSV</strong> en pièce jointe :
                <ul style={{ margin: '6px 0 0 18px', padding: 0 }}>
                  <li>Liste des factures (HT, TVA, TTC, statut)</li>
                  <li>Détail des lignes</li>
                </ul>
              </div>

              {error && (
                <div style={{ marginTop: 12, padding: '10px 12px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, color: '#991B1B', fontSize: 13 }}>
                  {error}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: 16, borderTop: `1px solid ${C.cream}`, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          {result ? (
            <button onClick={onClose}
              style={{ padding: '10px 20px', borderRadius: 10, border: 'none', background: C.ink, color: 'white', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
              Fermer
            </button>
          ) : (
            <>
              <button onClick={onClose} disabled={loading}
                style={{ padding: '10px 16px', borderRadius: 10, border: `1.5px solid ${C.border}`, background: 'white', color: C.muted, fontSize: 14, fontWeight: 500, cursor: loading ? 'wait' : 'pointer', fontFamily: 'inherit' }}>
                Annuler
              </button>
              <button onClick={send} disabled={loading}
                style={{ padding: '10px 20px', borderRadius: 10, border: 'none', background: loading ? C.terradark : C.terra, color: 'white', fontSize: 14, fontWeight: 600, cursor: loading ? 'wait' : 'pointer', fontFamily: 'inherit' }}>
                {loading ? 'Envoi…' : 'Envoyer'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
