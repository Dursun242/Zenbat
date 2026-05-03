import { useState } from 'react'
import { useAuth } from '../lib/auth.jsx'

export default function EmailVerificationGate({ blocking, children }) {
  const { session, signOut, resendConfirmation } = useAuth()
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

  if (blocking) {
    return (
      <div style={{ minHeight: '100vh', background: '#FAF7F2', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ background: 'white', borderRadius: 20, padding: 32, maxWidth: 420, width: '100%', boxShadow: '0 4px 24px rgba(0,0,0,.08)', textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>✉️</div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1A1612', marginBottom: 8 }}>
            Confirmez votre adresse email
          </h2>
          <p style={{ fontSize: 13, color: '#6B6358', lineHeight: 1.6, marginBottom: 6 }}>
            Un email de confirmation a été envoyé à <strong>{email}</strong>.
          </p>
          <p style={{ fontSize: 13, color: '#6B6358', lineHeight: 1.6, marginBottom: 24 }}>
            Veuillez cliquer sur le lien dans cet email pour accéder à votre espace. Sans confirmation, votre compte reste inaccessible.
          </p>

          {sent ? (
            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: '10px 16px', fontSize: 13, color: '#15803d', marginBottom: 16 }}>
              ✓ Email renvoyé — vérifiez votre boîte (et vos spams).
            </div>
          ) : (
            <button onClick={resend} disabled={sending}
              style={{ width: '100%', background: '#1A1612', color: 'white', border: 'none', borderRadius: 12, padding: '13px 0', fontSize: 14, fontWeight: 700, cursor: sending ? 'default' : 'pointer', marginBottom: 12, opacity: sending ? 0.6 : 1 }}>
              {sending ? 'Envoi…' : 'Renvoyer l\'email de confirmation'}
            </button>
          )}

          <button onClick={signOut}
            style={{ width: '100%', background: '#F0EBE3', color: '#6B6358', border: 'none', borderRadius: 12, padding: '11px 0', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            Se déconnecter
          </button>
        </div>
      </div>
    )
  }

  // Bannière douce (< 7 jours)
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
          <button onClick={() => setDismissed(true)}
            aria-label="Fermer"
            style={{ background: 'none', border: 'none', color: '#92400e', fontSize: 16, cursor: 'pointer', padding: '0 4px', flexShrink: 0 }}>×</button>
        </div>
      )}
      {children}
    </>
  )
}
