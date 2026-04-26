import { useState, useEffect } from 'react'

const C = {
  terra:   '#C97B5C',
  cream:   '#FAF7F2',
  ink:     '#1A1612',
  muted:   '#6B6358',
  border:  '#E8E2D8',
  success: '#22c55e',
}

const inputStyle = {
  flex:        1,
  minWidth:    180,
  padding:     '11px 16px',
  borderRadius: 10,
  border:      `1.5px solid ${C.border}`,
  background:  'white',
  fontSize:    14,
  color:       C.ink,
  outline:     'none',
  fontFamily:  "'DM Sans', system-ui, sans-serif",
}

const btnStyle = (disabled) => ({
  padding:      '11px 22px',
  borderRadius: 10,
  border:       'none',
  background:   C.terra,
  color:        'white',
  fontFamily:   "'DM Sans', system-ui, sans-serif",
  fontWeight:   600,
  fontSize:     14,
  cursor:       disabled ? 'default' : 'pointer',
  opacity:      disabled ? 0.65 : 1,
  whiteSpace:   'nowrap',
  transition:   'opacity .2s',
})

const successBox = (msg) => (
  <div style={{
    background:   'rgba(34,197,94,.08)',
    border:       '1px solid rgba(34,197,94,.28)',
    borderRadius: 10,
    padding:      '14px 18px',
    display:      'flex',
    alignItems:   'center',
    gap:          10,
  }}>
    <span style={{ color: C.success, fontSize: 20, lineHeight: 1 }}>✓</span>
    <p style={{ margin: 0, fontSize: 14, color: '#15803d', fontWeight: 500 }}>{msg}</p>
  </div>
)

function NewsletterBlock() {
  const [email,  setEmail]  = useState('')
  const [status, setStatus] = useState('idle') // idle | loading | success

  async function handleSubmit(e) {
    e.preventDefault()
    if (!email || status === 'loading') return
    setStatus('loading')
    // TODO: connecter à votre service newsletter (Brevo, Mailchimp…)
    await new Promise(r => setTimeout(r, 700))
    setStatus('success')
  }

  return (
    <div style={{ flex: 1, minWidth: 260 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <div style={{
          width: 40, height: 40, borderRadius: 12,
          background: 'rgba(201,123,92,.12)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 20,
        }}>
          📩
        </div>
        <div>
          <p style={{ margin: 0, fontFamily: "'DM Sans', system-ui, sans-serif", fontWeight: 700, fontSize: 16, color: C.ink }}>
            Newsletter
          </p>
          <p style={{ margin: 0, fontSize: 12, color: C.muted }}>
            Conseils, astuces &amp; nouveautés Zenbat
          </p>
        </div>
      </div>

      {status === 'success'
        ? successBox('Inscription confirmée — à bientôt !')
        : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="votre@email.fr"
              required
              style={inputStyle}
            />
            <button type="submit" disabled={status === 'loading'} style={btnStyle(status === 'loading')}>
              {status === 'loading' ? '…' : "S'abonner"}
            </button>
          </form>
        )
      }

      <p style={{ fontSize: 11, color: '#B0A898', marginTop: 10 }}>
        Sans spam · Désinscription en 1 clic
      </p>
    </div>
  )
}

function CallbackBlock() {
  const [phone,  setPhone]  = useState('')
  const [status, setStatus] = useState('idle')

  async function handleSubmit(e) {
    e.preventDefault()
    if (!phone || status === 'loading') return
    setStatus('loading')
    // TODO: enregistrer la demande (Supabase, email, CRM…)
    await new Promise(r => setTimeout(r, 700))
    setStatus('success')
  }

  return (
    <div style={{ flex: 1, minWidth: 260 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <div style={{
          width: 40, height: 40, borderRadius: 12,
          background: 'rgba(201,123,92,.12)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 20,
        }}>
          📞
        </div>
        <div>
          <p style={{ margin: 0, fontFamily: "'DM Sans', system-ui, sans-serif", fontWeight: 700, fontSize: 16, color: C.ink }}>
            Rappel gratuit
          </p>
          <p style={{ margin: 0, fontSize: 12, color: C.muted }}>
            On vous rappelle sous 24 h
          </p>
        </div>
      </div>

      {status === 'success'
        ? successBox('Reçu ! Nous vous rappelons sous 24 h.')
        : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input
              type="tel"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="06 12 34 56 78"
              required
              style={inputStyle}
            />
            <button type="submit" disabled={status === 'loading'} style={btnStyle(status === 'loading')}>
              {status === 'loading' ? '…' : 'Me rappeler'}
            </button>
          </form>
        )
      }

      <p style={{ fontSize: 11, color: '#B0A898', marginTop: 10 }}>
        Gratuit · Sans engagement · Lun – Sam
      </p>
    </div>
  )
}

export default function LandingContact() {
  const [mobile, setMobile] = useState(window.innerWidth < 768)
  useEffect(() => {
    const fn = () => setMobile(window.innerWidth < 768)
    window.addEventListener('resize', fn)
    return () => window.removeEventListener('resize', fn)
  }, [])

  return (
    <section style={{
      background:   '#FFFCF7',
      borderTop:    `1px solid ${C.border}`,
      padding:      mobile ? '52px 20px' : '72px 24px',
    }}>
      <div style={{ maxWidth: 1120, margin: '0 auto' }}>

        {/* Titre */}
        <p style={{
          fontFamily:    "'Syne', sans-serif",
          fontSize:      12,
          fontWeight:    600,
          letterSpacing: '.1em',
          textTransform: 'uppercase',
          color:         C.terra,
          marginBottom:  8,
          textAlign:     'center',
        }}>
          Restez en contact
        </p>
        <h2 style={{
          fontFamily:   "'Syne', sans-serif",
          fontSize:     mobile ? 28 : 36,
          fontWeight:   400,
          color:        C.ink,
          lineHeight:   1.2,
          marginBottom: 48,
          textAlign:    'center',
          letterSpacing: '-.5px',
        }}>
          On est là pour vous.
        </h2>

        {/* Deux blocs côte à côte */}
        <div style={{
          display:  'flex',
          gap:      mobile ? 40 : 56,
          flexWrap: 'wrap',
        }}>
          <NewsletterBlock />

          {/* Séparateur vertical (masqué sur mobile) */}
          {!mobile && (
            <div style={{
              width:      1,
              background: C.border,
              alignSelf:  'stretch',
              flexShrink: 0,
            }} />
          )}

          <CallbackBlock />
        </div>
      </div>
    </section>
  )
}
