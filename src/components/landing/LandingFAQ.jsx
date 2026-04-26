import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronDown } from 'lucide-react'

const C = {
  terra:      '#C97B5C',
  terradark:  '#A55F44',
  cream:      '#FAF7F2',
  creamlight: '#FFFCF7',
  ink:        '#1A1612',
  muted:      '#6B6358',
  border:     '#E8E2D8',
}

const FAQ_ITEMS = [
  {
    q: 'Mes données m\'appartiennent-elles ?',
    a: 'Oui, exportables à tout moment en un clic. Hébergement en France, RGPD strict. Vous restez propriétaire de vos données client et de vos documents.',
  },
  {
    q: 'Que se passe-t-il après les 30 jours d\'essai ?',
    a: 'Vous choisissez votre plan ou vous arrêtez. Aucun prélèvement automatique sans votre accord explicite. Zéro surprise.',
  },
  {
    q: 'Zenbat fonctionne-t-il sans connexion ?',
    a: 'La dictée et la création de devis fonctionnent hors-ligne. La synchronisation est automatique au retour du réseau.',
  },
  {
    q: 'Suis-je vraiment prêt pour la facturation électronique 2026 ?',
    a: 'Oui. Factur-X est embarqué dans chaque PDF dès aujourd\'hui. Vous n\'avez rien à changer le jour J.',
  },
]

export default function LandingFAQ() {
  const [openIndex, setOpenIndex] = useState(0)

  function toggle(index) {
    setOpenIndex(prev => (prev === index ? -1 : index))
  }

  return (
    <>
      <style>{`
        .faq-btn {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          padding: 22px 24px;
          background: white;
          border: none;
          cursor: pointer;
          font-family: inherit;
          text-align: left;
          transition: background 0.18s;
        }
        .faq-btn:hover {
          background: ${C.cream};
        }
      `}</style>

      <section
        id="faq"
        style={{
          background: C.cream,
          padding:    '96px 24px',
        }}
      >
        <div
          style={{
            maxWidth: 720,
            margin:   '0 auto',
          }}
        >
          {/* Title */}
          <h2
            style={{
              fontFamily:   "'Syne', sans-serif",
              fontSize:     40,
              fontWeight:   700,
              color:        C.ink,
              lineHeight:   1.2,
              letterSpacing: "-0.5px",
              marginBottom: 48,
              marginTop:    0,
            }}
          >
            Les questions qu'on nous pose souvent.
          </h2>

          {/* Accordion container */}
          <div
            style={{
              border:       `1px solid ${C.border}`,
              borderRadius: 16,
              overflow:     'hidden',
            }}
          >
            {FAQ_ITEMS.map((item, index) => {
              const isOpen = openIndex === index
              const isLast = index === FAQ_ITEMS.length - 1

              return (
                <div
                  key={index}
                  style={{
                    background:   'white',
                    borderBottom: isLast ? 'none' : `1px solid ${C.border}`,
                  }}
                >
                  {/* Question button */}
                  <button
                    className="faq-btn"
                    onClick={() => toggle(index)}
                    aria-expanded={isOpen}
                    aria-controls={`faq-answer-${index}`}
                    id={`faq-btn-${index}`}
                  >
                    <span
                      style={{
                        fontFamily: "'DM Sans', system-ui, sans-serif",
                        fontSize:   16,
                        fontWeight: 600,
                        color:      C.ink,
                        lineHeight: 1.4,
                      }}
                    >
                      {item.q}
                    </span>

                    {/* Rotating chevron */}
                    <motion.div
                      animate={{ rotate: isOpen ? 180 : 0 }}
                      transition={{ duration: 0.22, ease: 'easeInOut' }}
                      style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}
                    >
                      <ChevronDown
                        size={20}
                        color={C.muted}
                        strokeWidth={2}
                        aria-hidden="true"
                      />
                    </motion.div>
                  </button>

                  {/* Answer — animated */}
                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        id={`faq-answer-${index}`}
                        role="region"
                        aria-labelledby={`faq-btn-${index}`}
                        key="answer"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.26, ease: 'easeInOut' }}
                        style={{ overflow: 'hidden' }}
                      >
                        <p
                          style={{
                            fontFamily: "'DM Sans', system-ui, sans-serif",
                            fontSize:   15,
                            lineHeight: 1.65,
                            color:      C.muted,
                            margin:     0,
                            padding:    '0 24px 22px',
                          }}
                        >
                          {item.a}
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )
            })}
          </div>
        </div>
      </section>
    </>
  )
}
