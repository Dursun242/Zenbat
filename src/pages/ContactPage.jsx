import { useState } from 'react'

const C = {
  terra:     '#C97B5C',
  terradark: '#A55F44',
  cream:     '#FAF7F2',
  ink:       '#1A1612',
  muted:     '#6B6358',
  border:    '#E8E2D8',
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function Field({ label, error, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 13, fontWeight: 600, color: error ? '#DC2626' : C.muted }}>
        {label}
      </label>
      {children}
      {error && (
        <span style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 12, color: '#DC2626' }}>{error}</span>
      )}
    </div>
  )
}

function Input({ type = 'text', value, onChange, placeholder, focused, onFocus, onBlur, hasError }) {
  return (
    <input
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      onFocus={onFocus}
      onBlur={onBlur}
      style={{
        padding: '12px 16px',
        borderRadius: 10,
        border: `1.5px solid ${hasError ? '#DC2626' : focused ? C.terra : C.border}`,
        background: 'white',
        fontFamily: "'DM Sans', system-ui, sans-serif",
        fontSize: 14,
        color: C.ink,
        outline: 'none',
        transition: 'border-color 0.18s',
        width: '100%',
        boxSizing: 'border-box',
      }}
    />
  )
}

function Textarea({ value, onChange, placeholder, focused, onFocus, onBlur, hasError }) {
  return (
    <textarea
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      rows={6}
      onFocus={onFocus}
      onBlur={onBlur}
      style={{
        padding: '12px 16px',
        borderRadius: 10,
        border: `1.5px solid ${hasError ? '#DC2626' : focused ? C.terra : C.border}`,
        background: 'white',
        fontFamily: "'DM Sans', system-ui, sans-serif",
        fontSize: 14,
        color: C.ink,
        outline: 'none',
        resize: 'vertical',
        transition: 'border-color 0.18s',
        width: '100%',
        boxSizing: 'border-box',
        lineHeight: 1.6,
      }}
    />
  )
}

export default function ContactPage() {
  const [form, setForm]     = useState({ name: '', email: '', subject: '', message: '' })
  const [focus, setFocus]   = useState({})
  const [errors, setErrors] = useState({})
  const [status, setStatus] = useState('idle')

  function set(field) {
    return e => {
      setForm(f => ({ ...f, [field]: e.target.value }))
      if (errors[field]) setErrors(err => ({ ...err, [field]: null }))
    }
  }

  function validate() {
    const e = {}
    if (!form.name.trim())                                      e.name    = 'Votre nom est requis.'
    if (!form.email.trim() || !EMAIL_RE.test(form.email))       e.email   = 'Adresse email invalide.'
    if (!form.subject.trim())                                   e.subject = 'L\'objet est requis.'
    if (!form.message.trim() || form.message.trim().length < 10) e.message = 'Message trop court (10 caractères minimum).'
    return e
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }
    setStatus('loading')
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name:    form.name.trim(),
          email:   form.email.trim(),
          message: `Objet : ${form.subject.trim()}\n\n${form.message.trim()}`,
        }),
      })
      setStatus(res.ok ? 'ok' : 'error')
    } catch {
      setStatus('error')
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: C.cream, fontFamily: 'Inter, system-ui, sans-serif', color: C.ink }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;700&family=DM+Sans:wght@400;600;700&display=swap');*{box-sizing:border-box;margin:0;padding:0}`}</style>

      {/* Nav */}
      <nav style={{ borderBottom: `1px solid ${C.border}`, background: 'white', padding: '0 24px', height: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <a href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ fontFamily: "'Syne', sans-serif", fontSize: 20, fontWeight: 700, color: C.terra }}>Zen</span>
          <span style={{ fontFamily: "'Syne', sans-serif", fontSize: 20, fontWeight: 700, color: C.ink }}>bat</span>
        </a>
        <a
          href="/"
          style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 13, color: C.muted, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
          Retour
        </a>
      </nav>

      {/* Main */}
      <main style={{ maxWidth: 680, margin: '0 auto', padding: '60px 24px 80px' }}>
        {/* Header */}
        <p style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: C.terra, marginBottom: 12 }}>
          Contactez-nous
        </p>
        <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: 'clamp(28px, 5vw, 42px)', fontWeight: 400, color: C.ink, lineHeight: 1.2, marginBottom: 14 }}>
          Une question ?<br />On vous répond.
        </h1>
        <p style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 15, color: C.muted, lineHeight: 1.7, marginBottom: 48 }}>
          Remplissez le formulaire ci-dessous ou écrivez-nous sur{' '}
          <a href="https://wa.me/33679116085" target="_blank" rel="noopener noreferrer" style={{ color: C.terra, textDecoration: 'none', fontWeight: 600 }}>WhatsApp</a>.
        </p>

        {status === 'ok' ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 16, padding: '48px 32px', textAlign: 'center' }}>
            <div style={{ width: 52, height: 52, borderRadius: '50%', background: '#DCFCE7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="24" height="24" fill="none" stroke="#16A34A" strokeWidth="2.5" viewBox="0 0 24 24">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </div>
            <p style={{ fontFamily: "'Syne', sans-serif", fontSize: 24, fontWeight: 400, color: '#15803D' }}>Message envoyé !</p>
            <p style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 14, color: '#16A34A', lineHeight: 1.6 }}>
              Nous vous répondrons dans les meilleurs délais.
            </p>
            <a href="/" style={{ marginTop: 8, fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 13, color: C.muted, textDecoration: 'none' }}>
              ← Retour à l'accueil
            </a>
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 20 }}>
              <Field label="Nom *" error={errors.name}>
                <Input
                  value={form.name} onChange={set('name')} placeholder="Jean Dupont"
                  focused={focus.name} onFocus={() => setFocus(f => ({ ...f, name: true }))} onBlur={() => setFocus(f => ({ ...f, name: false }))}
                  hasError={!!errors.name}
                />
              </Field>
              <Field label="Email *" error={errors.email}>
                <Input
                  type="email" value={form.email} onChange={set('email')} placeholder="jean@exemple.fr"
                  focused={focus.email} onFocus={() => setFocus(f => ({ ...f, email: true }))} onBlur={() => setFocus(f => ({ ...f, email: false }))}
                  hasError={!!errors.email}
                />
              </Field>
            </div>

            <Field label="Objet *" error={errors.subject}>
              <Input
                value={form.subject} onChange={set('subject')} placeholder="Question sur les tarifs, bug, partenariat…"
                focused={focus.subject} onFocus={() => setFocus(f => ({ ...f, subject: true }))} onBlur={() => setFocus(f => ({ ...f, subject: false }))}
                hasError={!!errors.subject}
              />
            </Field>

            <Field label="Message *" error={errors.message}>
              <Textarea
                value={form.message} onChange={set('message')} placeholder="Décrivez votre demande…"
                focused={focus.message} onFocus={() => setFocus(f => ({ ...f, message: true }))} onBlur={() => setFocus(f => ({ ...f, message: false }))}
                hasError={!!errors.message}
              />
            </Field>

            {status === 'error' && (
              <p style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 13, color: '#DC2626' }}>
                Une erreur est survenue. Réessayez ou écrivez-nous directement par email.
              </p>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="submit"
                disabled={status === 'loading'}
                style={{
                  padding: '13px 36px', borderRadius: 10, border: 'none',
                  background: status === 'loading' ? C.terradark : C.terra,
                  color: 'white', fontFamily: "'DM Sans', system-ui, sans-serif",
                  fontWeight: 600, fontSize: 15, cursor: status === 'loading' ? 'wait' : 'pointer',
                  transition: 'background 0.18s',
                }}
              >
                {status === 'loading' ? 'Envoi en cours…' : 'Envoyer le message'}
              </button>
            </div>

            <p style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 11, color: '#B0A898', textAlign: 'right' }}>
              Vos données ne sont utilisées que pour vous répondre (RGPD).
            </p>
          </form>
        )}
      </main>
    </div>
  )
}
