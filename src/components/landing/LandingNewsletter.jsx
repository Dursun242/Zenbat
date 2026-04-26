import { useState } from 'react'

const C = {
  terra:     '#C97B5C',
  terradark: '#A55F44',
  cream:     '#FAF7F2',
  ink:       '#1A1612',
  muted:     '#6B6358',
  border:    '#E8E2D8',
}

export default function LandingNewsletter() {
  const [email,     setEmail]     = useState('')
  const [status,    setStatus]    = useState('idle') // idle | loading | ok | already | error
  const [inputFocus, setInputFocus] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (status === 'loading') return
    setStatus('loading')

    try {
      const res = await fetch('/api/newsletter', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email }),
      })
      const data = await res.json()
      if (!res.ok) { setStatus('error'); return }
      setStatus(data.already ? 'already' : 'ok')
    } catch {
      setStatus('error')
    }
  }

  const done = status === 'ok' || status === 'already'

  return (
    <section
      style={{
        background:  C.cream,
        borderTop:   `1px solid ${C.border}`,
        padding:     '72px 24px',
        textAlign:   'center',
      }}
    >
      <div style={{ maxWidth: 560, margin: '0 auto' }}>
        <p
          style={{
            fontFamily:    "'DM Sans', system-ui, sans-serif",
            fontSize:      11,
            fontWeight:    700,
            letterSpacing: '.1em',
            textTransform: 'uppercase',
            color:         C.terra,
            marginBottom:  12,
          }}
        >
          Newsletter
        </p>

        <h2
          style={{
            fontFamily:  "'Syne', sans-serif",
            fontSize:    32,
            fontWeight:  400,
            color:       C.ink,
            lineHeight:  1.2,
            margin:      '0 0 12px',
          }}
        >
          Conseils et nouveautés pour les artisans
        </h2>

        <p
          style={{
            fontFamily: "'DM Sans', system-ui, sans-serif",
            fontSize:   15,
            color:      C.muted,
            marginBottom: 32,
            lineHeight: 1.6,
          }}
        >
          Un email par mois. Pas de spam. Désinscription en un clic.
        </p>

        {done ? (
          <div
            style={{
              display:      'inline-flex',
              alignItems:   'center',
              gap:          10,
              background:   '#F0FDF4',
              border:       '1px solid #BBF7D0',
              borderRadius: 12,
              padding:      '14px 24px',
              color:        '#16A34A',
              fontFamily:   "'DM Sans', system-ui, sans-serif",
              fontSize:     15,
              fontWeight:   600,
            }}
          >
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            {status === 'already' ? 'Vous êtes déjà inscrit !' : 'Inscription confirmée, merci !'}
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            style={{
              display:     'flex',
              gap:         8,
              maxWidth:    440,
              margin:      '0 auto',
              flexWrap:    'wrap',
              justifyContent: 'center',
            }}
          >
            <input
              type="email"
              required
              placeholder="votre@email.fr"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onFocus={() => setInputFocus(true)}
              onBlur={() => setInputFocus(false)}
              style={{
                flex:         '1 1 200px',
                padding:      '12px 16px',
                borderRadius: 10,
                border:       `1.5px solid ${inputFocus ? C.terra : C.border}`,
                background:   'white',
                fontFamily:   "'DM Sans', system-ui, sans-serif",
                fontSize:     14,
                color:        C.ink,
                outline:      'none',
                transition:   'border-color 0.18s',
              }}
            />
            <button
              type="submit"
              disabled={status === 'loading'}
              style={{
                padding:      '12px 24px',
                borderRadius: 10,
                border:       'none',
                background:   status === 'loading' ? C.terradark : C.terra,
                color:        'white',
                fontFamily:   "'DM Sans', system-ui, sans-serif",
                fontWeight:   600,
                fontSize:     14,
                cursor:       status === 'loading' ? 'wait' : 'pointer',
                transition:   'background 0.18s',
                whiteSpace:   'nowrap',
              }}
            >
              {status === 'loading' ? 'Envoi…' : "S'inscrire"}
            </button>
          </form>
        )}

        {status === 'error' && (
          <p
            style={{
              fontFamily: "'DM Sans', system-ui, sans-serif",
              fontSize:   13,
              color:      '#DC2626',
              marginTop:  12,
            }}
          >
            Une erreur est survenue, réessayez.
          </p>
        )}

        <p
          style={{
            fontFamily: "'DM Sans', system-ui, sans-serif",
            fontSize:   11,
            color:      '#B0A898',
            marginTop:  16,
          }}
        >
          Conformément au RGPD, vos données ne seront jamais partagées.
        </p>
      </div>
    </section>
  )
}
