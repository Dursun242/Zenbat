import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const C = {
  terra:     '#C97B5C',
  darkTerra: '#A55F44',
  cream:     '#FAF7F2',
  creamlight:'#FFFCF7',
  ink:       '#1A1612',
  muted:     '#6B6358',
  border:    '#E8E2D8',
}

// Téléphone FR — pour validation côté client. Le serveur revalide.
const PHONE_FR_RE = /^(?:\+33[\s.-]?|0)[1-9](?:[\s.-]?\d{2}){4}$/

const SLOTS = [
  { id: 'matin',    label: 'Matin (9h–12h)' },
  { id: 'midi',     label: 'Midi (12h–14h)' },
  { id: 'apresmidi',label: 'Après-midi (14h–18h)' },
  { id: 'soir',     label: 'Soir (18h–20h)' },
]

export default function DemoCallbackModal({ open, onClose }) {
  const [phone, setPhone] = useState('')
  const [slot,  setSlot]  = useState('')
  const [website, setWebsite] = useState('') // honeypot
  const [status, setStatus] = useState('idle') // idle | submitting | success | error
  const [errMsg, setErrMsg] = useState('')
  const phoneRef = useRef(null)

  // Focus + ESC + scroll lock
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    setTimeout(() => phoneRef.current?.focus(), 80)
    const onKey = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  // Reset quand on referme/réouvre
  useEffect(() => {
    if (open) return
    const t = setTimeout(() => {
      setPhone(''); setSlot(''); setWebsite('')
      setStatus('idle'); setErrMsg('')
    }, 300)
    return () => clearTimeout(t)
  }, [open])

  async function onSubmit(e) {
    e.preventDefault()
    setErrMsg('')
    if (!PHONE_FR_RE.test(phone.trim())) {
      return setErrMsg('Numéro invalide (format français : 06 12 34 56 78).')
    }
    setStatus('submitting')
    try {
      const r = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type:  'callback',
          phone: phone.trim(),
          slot:  slot ? SLOTS.find(s => s.id === slot)?.label : undefined,
          website, // honeypot
        }),
      })
      if (!r.ok) {
        const j = await r.json().catch(() => ({}))
        throw new Error(j?.error || 'Erreur lors de l\'envoi.')
      }
      setStatus('success')
    } catch (err) {
      setStatus('error')
      setErrMsg(err?.message || 'Erreur lors de l\'envoi. Réessayez dans un instant.')
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-labelledby="demo-modal-title"
          style={{
            position: 'fixed', inset: 0, zIndex: 10000,
            background: 'rgba(26,22,18,.52)',
            backdropFilter: 'blur(4px)',
            WebkitBackdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 20,
          }}
        >
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0,  scale: 1 }}
            exit={{    opacity: 0, y: 8,  scale: 0.97 }}
            transition={{ duration: 0.22, ease: [.16,1,.3,1] }}
            onClick={e => e.stopPropagation()}
            style={{
              background: C.creamlight,
              borderRadius: 16,
              width: '100%', maxWidth: 420,
              boxShadow: '0 24px 60px rgba(26,22,18,.30)',
              border: `1px solid ${C.border}`,
              overflow: 'hidden',
              position: 'relative',
              maxHeight: 'calc(100vh - 40px)',
              display: 'flex', flexDirection: 'column',
            }}
          >
            {/* Close */}
            <button
              type="button"
              onClick={onClose}
              aria-label="Fermer"
              style={{
                position: 'absolute', top: 12, right: 12,
                width: 32, height: 32, borderRadius: '50%',
                border: 'none', background: 'rgba(26,22,18,.06)',
                color: C.muted, cursor: 'pointer', display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                fontSize: 18, lineHeight: 1, zIndex: 2,
              }}
            >×</button>

            {status === 'success' ? (
              <div style={{ padding: '40px 28px 36px', textAlign: 'center' }}>
                <div style={{
                  width: 56, height: 56, borderRadius: '50%',
                  background: 'rgba(34,197,94,.12)', color: '#15803d',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 26, marginBottom: 16,
                }}>✓</div>
                <h2 id="demo-modal-title" style={{
                  fontFamily: "'Syne', sans-serif", fontSize: 22, fontWeight: 500,
                  color: C.ink, margin: '0 0 8px',
                }}>Demande reçue !</h2>
                <p style={{ fontSize: 14, color: C.muted, lineHeight: 1.6, margin: '0 0 24px' }}>
                  Un conseiller Zenbat va vous rappeler{slot ? <> sur le créneau choisi</> : <> rapidement</>}.
                </p>
                <button
                  type="button"
                  onClick={onClose}
                  style={{
                    padding: '11px 24px', borderRadius: 10, border: 'none',
                    background: C.terra, color: '#fff',
                    fontSize: 14, fontWeight: 600, cursor: 'pointer',
                  }}
                >Fermer</button>
              </div>
            ) : (
              <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ padding: '28px 28px 8px' }}>
                  <span style={{
                    display: 'inline-block', fontSize: 11, fontWeight: 700,
                    letterSpacing: '.12em', textTransform: 'uppercase',
                    color: C.terra, background: 'rgba(201,123,92,.10)',
                    padding: '5px 10px', borderRadius: 999, marginBottom: 12,
                  }}>Démo gratuite</span>
                  <h2 id="demo-modal-title" style={{
                    fontFamily: "'Syne', sans-serif", fontSize: 22, fontWeight: 500,
                    color: C.ink, margin: '0 0 8px', lineHeight: 1.2,
                  }}>On vous rappelle</h2>
                  <p style={{ fontSize: 14, color: C.muted, lineHeight: 1.55, margin: 0 }}>
                    Laissez votre numéro — un conseiller expert vous appelle pour
                    une démo de 15 min. Sans engagement.
                  </p>
                </div>

                <div style={{ padding: '20px 28px 0', display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {/* Honeypot — caché aux humains, rempli par les bots */}
                  <input
                    type="text" name="website" tabIndex={-1} autoComplete="off"
                    value={website} onChange={e => setWebsite(e.target.value)}
                    style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, opacity: 0 }}
                    aria-hidden="true"
                  />

                  <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: C.ink }}>
                      Votre numéro <span style={{ color: C.terra }}>*</span>
                    </span>
                    <input
                      ref={phoneRef}
                      type="tel" required maxLength={20}
                      value={phone} onChange={e => setPhone(e.target.value)}
                      autoComplete="tel"
                      inputMode="tel"
                      placeholder="06 12 34 56 78"
                      style={inputStyle}
                    />
                  </label>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: C.ink }}>
                      Créneau préféré <span style={{ color: C.muted, fontWeight: 400 }}>(optionnel)</span>
                    </span>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                      {SLOTS.map(s => (
                        <button
                          key={s.id} type="button"
                          onClick={() => setSlot(slot === s.id ? '' : s.id)}
                          style={{
                            padding: '9px 10px', borderRadius: 8,
                            border: `1.5px solid ${slot === s.id ? C.terra : C.border}`,
                            background: slot === s.id ? 'rgba(201,123,92,.08)' : 'white',
                            color: slot === s.id ? C.terra : C.muted,
                            fontSize: 13, fontWeight: 500, cursor: 'pointer',
                            transition: 'all .15s',
                          }}
                        >{s.label}</button>
                      ))}
                    </div>
                  </div>

                  {errMsg && (
                    <p style={{ margin: 0, fontSize: 13, color: '#dc2626', background: 'rgba(220,38,38,.06)', padding: '8px 12px', borderRadius: 8 }}>
                      {errMsg}
                    </p>
                  )}
                </div>

                <div style={{ padding: '20px 28px 26px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <button
                    type="submit" disabled={status === 'submitting'}
                    style={{
                      padding: '13px 22px', borderRadius: 10, border: 'none',
                      background: status === 'submitting' ? C.muted : C.terra,
                      color: '#fff', fontSize: 15, fontWeight: 600,
                      cursor: status === 'submitting' ? 'wait' : 'pointer',
                      transition: 'background .18s',
                    }}
                  >
                    {status === 'submitting' ? 'Envoi…' : 'Être rappelé'}
                  </button>
                  <p style={{ margin: 0, fontSize: 11, color: C.muted, textAlign: 'center', lineHeight: 1.45 }}>
                    Vos données ne sont pas revendues.
                  </p>
                </div>
              </form>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

const inputStyle = {
  padding: '11px 14px',
  borderRadius: 8,
  border: `1.5px solid ${C.border}`,
  background: 'white',
  fontSize: 15,
  fontFamily: 'inherit',
  color: C.ink,
  outline: 'none',
  transition: 'border-color .15s',
}
