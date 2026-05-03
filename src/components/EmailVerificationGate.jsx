import { useState } from 'react'
import { useAuth } from '../lib/auth.jsx'

export default function EmailVerificationGate({ blocking, children }) {
  const { session, resendConfirmation } = useAuth()
  const [sent,    setSent]    = useState(false)
  const [sending, setSending] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  const email = session?.user?.email || ""

  const resend = async () => {
    setSending(true)
    await resendConfirmation()
    setSending(false)
    setSent(true)
  }

  // Bannière persistante après 7 jours (non dismissable)
  if (blocking) {
    return (
      <>
        <div style={{ background: '#fef2f2', borderBottom: '2px solid #fecaca', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', fontFamily: 'system-ui, sans-serif' }}>
          <span style={{ fontSize: 16 }}>⚠️</span>
          <span style={{ fontSize: 12, color: '#991b1b', flex: 1, minWidth: 200 }}>
            <strong>Accès restreint</strong> — confirmez votre email <strong>{email}</strong> pour débloquer toutes les fonctionnalités.
          </span>
          {sent ? (
            <span style={{ fontSize: 12, color: '#15803d', fontWeight: 600, flexShrink: 0 }}>✓ Email renvoyé — vérifiez vos spams.</span>
          ) : (
            <button onClick={resend} disabled={sending}
              style={{ background: '#dc2626', color: 'white', border: 'none', borderRadius: 8, padding: '6px 14px', fontSize: 12, fontWeight: 700, cursor: sending ? 'default' : 'pointer', flexShrink: 0, opacity: sending ? 0.6 : 1 }}>
              {sending ? 'Envoi…' : 'Renvoyer l\'email'}
            </button>
          )}
        </div>
        {children}
      </>
    )
  }

  // Bannière douce dismissable (< 7 jours)
  return (
    <>
      {!dismissed && (
        <div style={{ background: '#fff7ed', borderBottom: '1px solid #fed7aa', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', fontFamily: 'system-ui, sans-serif' }}>
          <span style={{ fontSize: 15 }}>✉️</span>
          <span style={{ fontSize: 12, color: '#92400e', flex: 1, minWidth: 200 }}>
            Confirmez votre email <strong>{email}</strong> pour sécuriser votre compte.
          </span>
          {sent ? (
            <span style={{ fontSize: 12, color: '#15803d', fontWeight: 600 }}>✓ Email renvoyé !</span>
          ) : (
            <button onClick={resend} disabled={sending}
              style={{ background: '#f97316', color: 'white', border: 'none', borderRadius: 8, padding: '5px 12px', fontSize: 12, fontWeight: 700, cursor: sending ? 'default' : 'pointer', flexShrink: 0 }}>
              {sending ? 'Envoi…' : 'Renvoyer'}
            </button>
          )}
          <button onClick={() => setDismissed(true)} aria-label="Fermer"
            style={{ background: 'none', border: 'none', color: '#92400e', fontSize: 16, cursor: 'pointer', padding: '0 4px', flexShrink: 0 }}>×</button>
        </div>
      )}
      {children}
    </>
  )
}
