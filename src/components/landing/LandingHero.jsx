import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Mic, CheckCircle2 } from 'lucide-react'

const TYPEWRITER_TEXT = 'Cuisine 25m², carrelage sol et murs, peinture plafond, livraison 15 jours'
const DEVIS_LINES = [
  { label: 'Carrelage sol et murs', qty: '25 m²', pu: '85 €', total: '2 125 €' },
  { label: 'Peinture plafond',      qty: '25 m²', pu: '18 €', total: '450 €'   },
  { label: 'Pose et livraison',     qty: 'forfait', pu: '320 €', total: '320 €' },
]
// Durée en ms de chaque phase
const DURATIONS = [1500, 3500, 2500, 1500, 1000]

function usePhase() {
  const [phase, setPhase] = useState(0)
  useEffect(() => {
    const t = setTimeout(
      () => setPhase(p => (p + 1) % DURATIONS.length),
      DURATIONS[phase]
    )
    return () => clearTimeout(t)
  }, [phase])
  return phase
}

function HeroVisual() {
  const phase = usePhase()
  const [typed, setTyped]         = useState('')
  const [visLines, setVisLines]   = useState(0)

  // Typewriter
  useEffect(() => {
    if (phase !== 1) return
    setTyped('')
    let i = 0
    const t = setInterval(() => {
      if (i >= TYPEWRITER_TEXT.length) { clearInterval(t); return }
      setTyped(TYPEWRITER_TEXT.slice(0, ++i))
    }, 35)
    return () => clearInterval(t)
  }, [phase])

  // Lignes devis
  useEffect(() => {
    if (phase !== 2) return
    setVisLines(0)
    const timers = DEVIS_LINES.map((_, i) =>
      setTimeout(() => setVisLines(i + 1), i * 500)
    )
    return () => timers.forEach(clearTimeout)
  }, [phase])

  return (
    <div style={{
      width: '100%', maxWidth: 400, flexShrink: 0,
      background: '#1A1612', borderRadius: 20, padding: 24, minHeight: 300,
      boxShadow: '0 32px 72px rgba(26,22,18,.45)',
      border: '1px solid rgba(255,255,255,.07)',
      position: 'relative',
    }}>
      <AnimatePresence mode="wait">

        {/* Phase 0 — micro qui pulse */}
        {phase === 0 && (
          <motion.div key="mic"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 256, gap: 16 }}>
            <motion.div
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ repeat: Infinity, duration: 1.3, ease: 'easeInOut' }}
              style={{ width: 68, height: 68, borderRadius: '50%', background: 'rgba(201,123,92,.16)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Mic size={30} color="#C97B5C" />
            </motion.div>
            <p style={{ color: '#6B6358', fontSize: 13 }}>Dictez votre prestation…</p>
          </motion.div>
        )}

        {/* Phase 1 — typewriter */}
        {phase === 1 && (
          <motion.div key="type"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            style={{ minHeight: 256, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 14 }}>
            <p style={{ color: '#6B6358', fontSize: 10, textTransform: 'uppercase', letterSpacing: '.7px' }}>Vous dictez…</p>
            <div style={{ background: 'rgba(255,255,255,.04)', borderRadius: 10, padding: '12px 14px', border: '1px solid rgba(255,255,255,.07)' }}>
              <p style={{ color: '#F5F0EA', fontSize: 14, lineHeight: 1.6, minHeight: 56 }}>
                {typed}
                <span style={{ opacity: .5, animation: 'lp-blink 1s step-end infinite' }}>|</span>
              </p>
            </div>
          </motion.div>
        )}

        {/* Phase 2 — devis structuré */}
        {phase === 2 && (
          <motion.div key="devis"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            style={{ minHeight: 256, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <p style={{ color: '#6B6358', fontSize: 10, textTransform: 'uppercase', letterSpacing: '.7px', marginBottom: 4 }}>Devis structuré…</p>
            <div style={{ background: 'rgba(255,255,255,.04)', borderRadius: 10, overflow: 'hidden', border: '1px solid rgba(255,255,255,.07)' }}>
              <div style={{ padding: '7px 12px', borderBottom: '1px solid rgba(255,255,255,.06)', display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: 8, fontSize: 9, color: '#6B6358', textTransform: 'uppercase', letterSpacing: '.4px' }}>
                <span>Désignation</span><span>Qté</span><span>PU</span><span>Total</span>
              </div>
              {DEVIS_LINES.map((l, i) => (
                <motion.div key={i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={i < visLines ? { opacity: 1, x: 0 } : { opacity: 0, x: -10 }}
                  transition={{ duration: 0.3 }}
                  style={{ padding: '8px 12px', borderBottom: i < 2 ? '1px solid rgba(255,255,255,.04)' : 'none', display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: 8, alignItems: 'center' }}>
                  <span style={{ color: '#F5F0EA', fontSize: 12 }}>{l.label}</span>
                  <span style={{ color: '#6B6358', fontSize: 11 }}>{l.qty}</span>
                  <span style={{ color: '#6B6358', fontSize: 11 }}>{l.pu}</span>
                  <span style={{ color: '#C97B5C', fontSize: 12, fontWeight: 600 }}>{l.total}</span>
                </motion.div>
              ))}
            </div>
            {visLines === 3 && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
                style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <span style={{ background: 'rgba(201,123,92,.15)', color: '#C97B5C', fontSize: 13, fontWeight: 700, padding: '4px 12px', borderRadius: 8 }}>
                  Total TTC : 2 895 €
                </span>
              </motion.div>
            )}
          </motion.div>
        )}

        {/* Phase 3 — aperçu PDF */}
        {phase === 3 && (
          <motion.div key="pdf"
            initial={{ opacity: 0, scale: .97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.35 }}
            style={{ minHeight: 256, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: 14 }}>
            <div style={{ width: '100%', background: 'rgba(255,255,255,.05)', borderRadius: 12, padding: '16px', border: '1px solid rgba(255,255,255,.09)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <div style={{ width: 52, height: 10, background: '#C97B5C', borderRadius: 4, opacity: .75 }} />
                <span style={{ color: '#4A4642', fontSize: 9 }}>DEV-2026-042</span>
              </div>
              {[100, 80, 92].map((w, i) => (
                <div key={i} style={{ height: 6, background: 'rgba(255,255,255,.07)', borderRadius: 3, width: `${w}%`, marginBottom: 6 }} />
              ))}
              <div style={{ marginTop: 14, display: 'flex', justifyContent: 'flex-end' }}>
                <span style={{ color: '#C97B5C', fontSize: 13, fontWeight: 700 }}>2 895 € TTC</span>
              </div>
            </div>
            <p style={{ color: '#6B6358', fontSize: 12 }}>PDF généré — prêt à envoyer</p>
          </motion.div>
        )}

        {/* Phase 4 — envoyé */}
        {phase === 4 && (
          <motion.div key="sent"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            style={{ minHeight: 256, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: 12 }}>
            <motion.div
              initial={{ scale: 0 }} animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 280, damping: 18, delay: 0.1 }}>
              <CheckCircle2 size={52} color="#22c55e" />
            </motion.div>
            <p style={{ color: '#F5F0EA', fontSize: 15, fontWeight: 600 }}>Devis envoyé ✓</p>
            <p style={{ color: '#6B6358', fontSize: 12 }}>en 2 min 14 s</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Indicateur de phase */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 16 }}>
        {DURATIONS.map((_, i) => (
          <div key={i} style={{ width: 5, height: 5, borderRadius: '50%', background: phase === i ? '#C97B5C' : 'rgba(255,255,255,.15)', transition: 'background .3s' }} />
        ))}
      </div>
    </div>
  )
}

export default function LandingHero({ onSignup }) {
  const [mobile, setMobile] = useState(window.innerWidth < 768)
  useEffect(() => {
    const fn = () => setMobile(window.innerWidth < 768)
    window.addEventListener('resize', fn)
    return () => window.removeEventListener('resize', fn)
  }, [])

  return (
    <section style={{ background: '#FFFCF7', padding: mobile ? '72px 20px 60px' : '100px 24px 80px', minHeight: 'calc(100vh - 64px)', display: 'flex', alignItems: 'center' }}>
      <div style={{ maxWidth: 1120, margin: '0 auto', width: '100%', display: 'flex', alignItems: 'center', gap: 64, flexDirection: mobile ? 'column' : 'row' }}>

        {/* Copie gauche */}
        <div style={{ flex: 1, minWidth: 0 }}>

          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [.16,1,.3,1] }}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(201,123,92,.10)', border: '1px solid rgba(201,123,92,.22)', borderRadius: 20, padding: '6px 14px', marginBottom: 28 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#C97B5C', display: 'inline-block', animation: 'lp-badge 2.5s ease infinite' }} />
            <span style={{ color: '#C97B5C', fontSize: 11, fontWeight: 600, letterSpacing: '.6px' }}>DISPONIBLE — 30 JOURS GRATUITS</span>
          </motion.div>

          {/* H1 */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, delay: 0.1, ease: [.16,1,.3,1] }}
            style={{ fontFamily: "'Syne', sans-serif", fontSize: mobile ? 40 : 64, fontWeight: 700, lineHeight: 1.08, color: '#1A1612', letterSpacing: '-2px', marginBottom: 22 }}>
            Dictez vos devis.<br />
            Encaissez vos factures.<br />
            <span style={{ color: '#C97B5C', fontFamily: "'Playfair Display', Georgia, serif", fontStyle: 'italic', fontWeight: 400, letterSpacing: '0px' }}>Sans y penser.</span>
          </motion.h1>

          {/* Sous-titre */}
          <motion.p
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, delay: 0.2, ease: [.16,1,.3,1] }}
            style={{ fontSize: 17, color: '#6B6358', lineHeight: 1.75, marginBottom: 36, maxWidth: 480 }}>
            L'assistant commercial qui transforme votre voix en chiffre d'affaires.
            Pour les artisans, consultants, freelances et dirigeants qui gèrent seuls leur partie commerciale.
          </motion.p>

          {/* CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.28, ease: [.16,1,.3,1] }}
            style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
            <motion.button
              whileHover={{ scale: 1.02, backgroundColor: '#A55F44' }}
              onClick={onSignup}
              style={{ padding: '13px 26px', borderRadius: 10, border: 'none', background: '#C97B5C', color: '#fff', fontSize: 15, fontWeight: 600, cursor: 'pointer', transition: 'background .2s' }}>
              Essayer 30 jours gratuit
            </motion.button>
            <a href="#features" style={{ padding: '13px 26px', borderRadius: 10, border: '1.5px solid #E8E2D8', background: 'transparent', color: '#6B6358', fontSize: 15, fontWeight: 500, cursor: 'pointer', textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>
              Voir une démo
            </a>
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            transition={{ delay: 0.38 }}
            style={{ fontSize: 12, color: '#9A9088', marginBottom: 28 }}>
            Sans CB · Sans engagement · Annulable en 1 clic
          </motion.p>

          {/* Badges plateformes */}
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            transition={{ delay: 0.44 }}
            style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            {['iOS', 'Android', 'macOS', 'Windows', 'Web'].map((p, i) => (
              <span key={p} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 12, color: '#B0A898' }}>{p}</span>
                {i < 4 && <span style={{ width: 3, height: 3, borderRadius: '50%', background: '#D8D2C8', display: 'inline-block' }} />}
              </span>
            ))}
          </motion.div>
        </div>

        {/* Visuel animé (caché sur mobile) */}
        {!mobile && (
          <motion.div
            initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.7, delay: 0.15, ease: [.16,1,.3,1] }}>
            <HeroVisual />
          </motion.div>
        )}
      </div>
    </section>
  )
}
