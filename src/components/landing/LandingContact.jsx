import { useState } from 'react'

const C = {
  terra:     '#C97B5C',
  terradark: '#A55F44',
  cream:     '#FAF7F2',
  ink:       '#1A1612',
  muted:     '#6B6358',
  border:    '#E8E2D8',
}

function Field({ label, error, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label
        style={{
          fontFamily:  "'DM Sans', system-ui, sans-serif",
          fontSize:    13,
          fontWeight:  600,
          color:       error ? '#DC2626' : C.muted,
        }}
      >
        {label}
      </label>
      {children}
      {error && (
        <span style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 12, color: '#DC2626' }}>
          {error}
        </span>
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
        padding:      '12px 16px',
        borderRadius: 10,
        border:       `1.5px solid ${hasError ? '#DC2626' : focused ? C.terra : C.border}`,
        background:   'white',
        fontFamily:   "'DM Sans', system-ui, sans-serif",
        fontSize:     14,
        color:        C.ink,
        outline:      'none',
        transition:   'border-color 0.18s',
        width:        '100%',
        boxSizing:    'border-box',
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
      rows={5}
      onFocus={onFocus}
      onBlur={onBlur}
      style={{
        padding:      '12px 16px',
        borderRadius: 10,
        border:       `1.5px solid ${hasError ? '#DC2626' : focused ? C.terra : C.border}`,
        background:   'white',
        fontFamily:   "'DM Sans', system-ui, sans-serif",
        fontSize:     14,
        color:        C.ink,
        outline:      'none',
        resize:       'vertical',
        transition:   'border-color 0.18s',
        width:        '100%',
        boxSizing:    'border-box',
        lineHeight:   1.6,
      }}
    />
  )
}

export default function LandingContact() {
  const [form, setForm]     = useState({ name: '', email: '', message: '' })
  const [focus, setFocus]   = useState({})
  const [errors, setErrors] = useState({})
  const [status, setStatus] = useState('idle') // idle | loading | ok | error

  function set(field) {
    return e => {
      setForm(f => ({ ...f, [field]: e.target.value }))
      if (errors[field]) setErrors(err => ({ ...err, [field]: null }))
    }
  }

  function validate() {
    const e = {}
    if (!form.name.trim())  e.name = 'Votre nom est requis.'
    if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      e.email = 'Adresse email invalide.'
    if (!form.message.trim() || form.message.trim().length < 10)
      e.message = 'Message trop court (10 caractères minimum).'
    return e
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }
    setStatus('loading')

    try {
      const res = await fetch('/api/contact', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ name: form.name.trim(), email: form.email.trim(), message: form.message.trim() }),
      })
      if (!res.ok) { setStatus('error'); return }
      setStatus('ok')
    } catch {
      setStatus('error')
    }
  }

  return (
    <section
      id="contact"
      style={{
        background: 'white',
        borderTop:  `1px solid ${C.border}`,
        padding:    '80px 24px',
      }}
    >
      <div style={{ maxWidth: 680, margin: '0 auto' }}>
        {/* Header */}
        <p
          style={{
            fontFamily:    "'DM Sans', system-ui, sans-serif",
            fontSize:      11,
            fontWeight:    700,
            letterSpacing: '.1em',
            textTransform: 'uppercase',
            color:         C.terra,
            marginBottom:  12,
            textAlign:     'center',
          }}
        >
          Contactez-nous
        </p>

        <h2
          style={{
            fontFamily:  "'Syne', sans-serif",
            fontSize:    'clamp(28px, 5vw, 40px)',
            fontWeight:  400,
            color:       C.ink,
            lineHeight:  1.2,
            margin:      '0 0 12px',
            textAlign:   'center',
          }}
        >
          Une question ? On vous répond.
        </h2>

        <p
          style={{
            fontFamily:   "'DM Sans', system-ui, sans-serif",
            fontSize:     15,
            color:        C.muted,
            marginBottom: 40,
            lineHeight:   1.6,
            textAlign:    'center',
          }}
        >
          Remplissez le formulaire ci-dessous ou écrivez-nous directement à{' '}
          <a
            href="mailto:Zenbat76@gmail.com"
            style={{ color: C.terra, textDecoration: 'none', fontWeight: 600 }}
          >
            Zenbat76@gmail.com
          </a>
        </p>

        {/* Success state */}
        {status === 'ok' ? (
          <div
            style={{
              display:      'flex',
              flexDirection: 'column',
              alignItems:   'center',
              gap:           12,
              background:   '#F0FDF4',
              border:       '1px solid #BBF7D0',
              borderRadius: 16,
              padding:      '40px 32px',
              textAlign:    'center',
            }}
          >
            <div
              style={{
                width:        48,
                height:       48,
                borderRadius: '50%',
                background:   '#DCFCE7',
                display:      'flex',
                alignItems:   'center',
                justifyContent: 'center',
              }}
            >
              <svg width="22" height="22" fill="none" stroke="#16A34A" strokeWidth="2.5" viewBox="0 0 24 24">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </div>
            <p
              style={{
                fontFamily: "'Syne', sans-serif",
                fontSize:   22,
                fontWeight: 400,
                color:      '#15803D',
                margin:     0,
              }}
            >
              Message envoyé !
            </p>
            <p
              style={{
                fontFamily: "'DM Sans', system-ui, sans-serif",
                fontSize:   14,
                color:      '#16A34A',
                margin:     0,
                lineHeight: 1.5,
              }}
            >
              Nous vous répondrons dans les plus brefs délais.
            </p>
          </div>
        ) : (
          /* Form */
          <form
            onSubmit={handleSubmit}
            noValidate
            style={{ display: 'flex', flexDirection: 'column', gap: 20 }}
          >
            <div
              style={{
                display:             'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap:                 20,
              }}
            >
              <Field label="Nom *" error={errors.name}>
                <Input
                  value={form.name}
                  onChange={set('name')}
                  placeholder="Jean Dupont"
                  focused={focus.name}
                  onFocus={() => setFocus(f => ({ ...f, name: true }))}
                  onBlur={() => setFocus(f => ({ ...f, name: false }))}
                  hasError={!!errors.name}
                />
              </Field>

              <Field label="Email *" error={errors.email}>
                <Input
                  type="email"
                  value={form.email}
                  onChange={set('email')}
                  placeholder="jean@exemple.fr"
                  focused={focus.email}
                  onFocus={() => setFocus(f => ({ ...f, email: true }))}
                  onBlur={() => setFocus(f => ({ ...f, email: false }))}
                  hasError={!!errors.email}
                />
              </Field>
            </div>

            <Field label="Message *" error={errors.message}>
              <Textarea
                value={form.message}
                onChange={set('message')}
                placeholder="Bonjour, j'aimerais en savoir plus sur…"
                focused={focus.message}
                onFocus={() => setFocus(f => ({ ...f, message: true }))}
                onBlur={() => setFocus(f => ({ ...f, message: false }))}
                hasError={!!errors.message}
              />
            </Field>

            {status === 'error' && (
              <p
                style={{
                  fontFamily: "'DM Sans', system-ui, sans-serif",
                  fontSize:   13,
                  color:      '#DC2626',
                  margin:     0,
                }}
              >
                Une erreur est survenue. Réessayez ou écrivez-nous directement par email.
              </p>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="submit"
                disabled={status === 'loading'}
                style={{
                  padding:      '13px 36px',
                  borderRadius: 10,
                  border:       'none',
                  background:   status === 'loading' ? C.terradark : C.terra,
                  color:        'white',
                  fontFamily:   "'DM Sans', system-ui, sans-serif",
                  fontWeight:   600,
                  fontSize:     15,
                  cursor:       status === 'loading' ? 'wait' : 'pointer',
                  transition:   'background 0.18s, transform 0.18s',
                  transform:    status === 'loading' ? 'scale(1)' : undefined,
                }}
                onMouseEnter={e => { if (status !== 'loading') e.currentTarget.style.transform = 'scale(1.02)' }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)' }}
              >
                {status === 'loading' ? 'Envoi en cours…' : 'Envoyer le message'}
              </button>
            </div>

            <p
              style={{
                fontFamily: "'DM Sans', system-ui, sans-serif",
                fontSize:   11,
                color:      '#B0A898',
                margin:     0,
                textAlign:  'right',
              }}
            >
              Vos données ne sont utilisées que pour vous répondre (RGPD).
            </p>
          </form>
        )}
      </div>
    </section>
  )
}
