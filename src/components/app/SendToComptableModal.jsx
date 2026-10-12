// Modal d'envoi de l'export factures au comptable.
// - Liste les périodes (mois dernier par défaut)
// - Permet d'éditer l'email comptable (sauvegardé sur profiles.comptable_email)
// - Appelle POST /api/account { action:'send-comptable', period, from?, to?, email }

import { useState, useEffect, useRef } from "react"
import { getToken } from "../../lib/getToken.js"
import { supabase } from "../../lib/supabase.js"
import { useModalGuard } from "../../hooks/useModalGuard.js"
import { ZB, NUM } from "../../lib/theme.js"
import { btnPrimary, btnSecondary } from "../ui/Register.jsx"

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

  // Échap ne ferme pas pendant l'envoi.
  useModalGuard(true, onClose, { onEscape: () => { if (!loading) onClose?.() } })

  // Préremplir l'email comptable depuis profiles
  useEffect(() => {
    let cancel = false
    supabase.from('profiles')
      .select('comptable_email').eq('id', user?.id).maybeSingle()
      .then(({ data }) => { if (!cancel && data?.comptable_email) setEmail(data.comptable_email) })
      // Sans ce catch, un blip réseau produisait un unhandledrejection
      // « Failed to fetch » qui finissait en app_logs. Préremplissage
      // best-effort : l'utilisateur peut toujours saisir l'email à la main.
      .catch(() => {})
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
      setError('Choisis une date de début et de fin')
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

  const labelStyle = { display: 'block', fontSize: 13, fontWeight: 600, color: ZB.ink2, marginBottom: 6 }
  const inputStyle = {
    width: '100%', minHeight: 44, boxSizing: 'border-box', padding: '10px 12px',
    background: ZB.sheet, border: `1px solid ${ZB.rule}`, borderRadius: 8,
    fontSize: 16, color: ZB.ink, outline: 'none', fontFamily: 'inherit',
  }

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget && !loading) onClose() }}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(26,22,18,.55)', zIndex: 300,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
        fontFamily: ZB.font, color: ZB.ink,
      }}>
      <style>{`
        .zb-compta input:focus { border-color: ${ZB.accent} !important; }
        .zb-compta input::placeholder { color: ${ZB.ink3}; opacity: 1; }
        .zb-compta button:focus-visible { outline: 2px solid ${ZB.accent}; outline-offset: 2px; }
      `}</style>
      <div role="dialog" aria-modal="true" aria-labelledby="comptable-title" className="zb-compta"
        style={{
          background: ZB.paper, border: `1px solid ${ZB.rule}`, borderRadius: 10, width: '100%', maxWidth: 480,
          maxHeight: '90vh', display: 'flex', flexDirection: 'column',
          boxShadow: '0 10px 30px rgba(26,22,18,.16)',
        }}>
        {/* Header */}
        <div style={{ padding: '6px 6px 6px 18px', borderBottom: `1px solid ${ZB.rule}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <h2 id="comptable-title" style={{ margin: 0, fontSize: 19, fontWeight: 700, color: ZB.ink }}>
            Envoyer l'export à ton comptable
          </h2>
          <button type="button" onClick={onClose} disabled={loading} aria-label="Fermer"
            style={{ width: 44, height: 44, flexShrink: 0, display: 'grid', placeItems: 'center', background: 'none', border: 'none', color: ZB.ink2, cursor: loading ? 'wait' : 'pointer' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: 18, overflowY: 'auto' }}>
          {result ? (
            <div role="status" style={{ background: ZB.stampSoft, border: `1px solid ${ZB.stamp}`, borderRadius: 8, padding: 16, color: ZB.ink }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 15, fontWeight: 700, color: ZB.stamp, marginBottom: 8 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>
                <span>Email envoyé à {result.sent_to}</span>
              </div>
              <div style={{ fontSize: 15, lineHeight: 1.5, ...NUM }}>
                {result.count} facture{result.count > 1 ? 's' : ''} · Total TTC : {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(result.total_ttc || 0)}
                {typeof result.pdfs === 'number' && (
                  <div style={{ marginTop: 4, fontSize: 14, color: ZB.ink2 }}>
                    {result.pdfs > 0
                      ? `+ ${result.pdfs} PDF${result.pdfs > 1 ? 's' : ''} en pièce jointe`
                      : 'CSV uniquement (aucun PDF disponible)'}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <>
              <label htmlFor="comptable-email" style={labelStyle}>
                Email du comptable
              </label>
              <input
                id="comptable-email"
                ref={emailRef}
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="comptable@exemple.fr"
                disabled={loading}
                style={inputStyle}
              />
              <div style={{ fontSize: 13, color: ZB.ink2, marginTop: 6, marginBottom: 18 }}>
                Mémorisé pour les prochains envois.
              </div>

              <div id="comptable-period" style={labelStyle}>
                Période
              </div>
              <div role="radiogroup" aria-labelledby="comptable-period" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                {PERIODS.map(p => {
                  const active = p.id === period
                  return (
                    <button
                      key={p.id}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => setPeriod(p.id)}
                      disabled={loading}
                      style={{
                        minHeight: 44, padding: '8px 12px', borderRadius: 8,
                        border: `1px solid ${active ? ZB.accent : ZB.rule}`,
                        background: active ? ZB.accentSoft : ZB.sheet,
                        color: active ? ZB.accent : ZB.ink,
                        fontSize: 15, fontWeight: active ? 700 : 500,
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
                    <label htmlFor="comptable-from" style={labelStyle}>Du</label>
                    <input id="comptable-from" type="date" value={from} onChange={e => setFrom(e.target.value)} disabled={loading}
                      style={inputStyle}/>
                  </div>
                  <div style={{ flex: 1 }}>
                    <label htmlFor="comptable-to" style={labelStyle}>Au</label>
                    <input id="comptable-to" type="date" value={to} onChange={e => setTo(e.target.value)} disabled={loading}
                      style={inputStyle}/>
                  </div>
                </div>
              )}

              <div style={{ marginTop: 18, padding: 12, background: ZB.paper2, border: `1px solid ${ZB.ruleSoft}`, borderRadius: 8, fontSize: 14, color: ZB.ink2, lineHeight: 1.5 }}>
                Ton comptable recevra un email avec <strong style={{ color: ZB.ink }}>2 fichiers CSV</strong> en pièce jointe :
                <ul style={{ margin: '6px 0 0 18px', padding: 0 }}>
                  <li>Liste des factures (HT, TVA, TTC, statut)</li>
                  <li>Détail des lignes</li>
                </ul>
              </div>

              {error && (
                <div role="alert" style={{ marginTop: 12, padding: '10px 12px', background: ZB.dangerSoft, border: `1px solid ${ZB.danger}`, borderRadius: 8, color: ZB.danger, fontSize: 14 }}>
                  {error}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 16px', borderTop: `1px solid ${ZB.rule}`, display: 'flex', gap: 10, flexShrink: 0 }}>
          {result ? (
            <button type="button" onClick={onClose} style={{ ...btnSecondary, flex: 1 }}>
              Fermer
            </button>
          ) : (
            <>
              <button type="button" onClick={onClose} disabled={loading}
                style={{ ...btnSecondary, flex: 1, cursor: loading ? 'wait' : 'pointer' }}>
                Annuler
              </button>
              <button type="button" onClick={send} disabled={loading}
                style={{ ...btnPrimary, flex: 2, opacity: loading ? 0.7 : 1, cursor: loading ? 'wait' : 'pointer' }}>
                {loading ? 'Envoi…' : 'Envoyer'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
