import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../lib/auth.jsx'
import { saveCguAcceptance } from '../lib/api.js'
import { CGU_VERSION } from './CGU.jsx'
import { searchTrades, TRADE_EXAMPLES } from '../lib/trades.js'
import { ZB } from '../lib/theme.js'
import { btnPrimary } from '../components/ui/Register.jsx'
import { FORM_CSS, inputStyle, Iclose, Iplus, Iback } from '../components/onboarding/shared.jsx'

// Persistance du brouillon d'inscription : sans ça, un reload accidentel
// (notif push qui fait basculer l'app, batterie faible mobile, double-tap
// sur le bouton retour iOS, etc.) entre l'étape 1 et 2 fait tout perdre.
//
// ⚠ On NE persiste PAS :
//   - password : aucune raison de garder un mot de passe en clair dans
//     le localStorage. L'utilisateur le retape, c'est mineur.
//   - cguAccepted : à chaque session il faut re-cocher activement les
//     CGU (obligation légale — pas de pré-cochage caché).
//
// TTL 1 heure : assez pour récupérer un reload accidentel, trop court
// pour stocker durablement un email / une intention d'inscription.
const SIGNUP_DRAFT_KEY = 'zenbat_signup_draft'
const SIGNUP_DRAFT_TTL_MS = 60 * 60 * 1000

function readSignupDraft() {
  try {
    const raw = localStorage.getItem(SIGNUP_DRAFT_KEY)
    if (!raw) return null
    const d = JSON.parse(raw)
    if (!Number.isFinite(d?.savedAt) || Date.now() - d.savedAt > SIGNUP_DRAFT_TTL_MS) {
      localStorage.removeItem(SIGNUP_DRAFT_KEY)
      return null
    }
    return d
  } catch { return null }
}
function writeSignupDraft(d) {
  try {
    localStorage.setItem(SIGNUP_DRAFT_KEY, JSON.stringify({ ...d, savedAt: Date.now() }))
  } catch {}
}
function clearSignupDraft() {
  try { localStorage.removeItem(SIGNUP_DRAFT_KEY) } catch {}
}

const s = {
  wrap:   { minHeight:'100vh', display:'grid', placeItems:'center', padding:'24px 16px', background:ZB.paper, color:ZB.ink, fontFamily:ZB.font },
  card:   { width:'100%', maxWidth:440, background:ZB.sheet, border:`1px solid ${ZB.rule}`, borderRadius:8, padding:'24px 20px' },
  label:  { display:'block', fontSize:14, fontWeight:600, color:ZB.ink2, marginBottom:6 },
  input:  { ...inputStyle },
  btn:    { ...btnPrimary, width:'100%', minHeight:52, fontSize:16, marginTop:16 },
  err:    { background:ZB.dangerSoft, color:ZB.danger, padding:'10px 12px', borderRadius:8, fontSize:14, fontWeight:600, marginTop:12 },
  ok:     { background:ZB.stampSoft, color:ZB.stamp, padding:'12px 14px', borderRadius:8, fontSize:15, lineHeight:1.45, marginTop:4 },
  switch: { textAlign:'center', marginTop:16, fontSize:15, color:ZB.ink2 },
  link:   { color:ZB.accent, background:'none', border:0, cursor:'pointer', fontWeight:600, padding:'0 4px', minHeight:44, fontSize:15, fontFamily:'inherit' },
  title:  { margin:0, fontSize:22, fontWeight:700, color:ZB.ink, lineHeight:1.25 },
}

const normalize = t => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

export default function Signup({ onSwitchToLogin, onBack }) {
  const { signUpWithPassword } = useAuth()

  // Lecture one-shot du brouillon : s'il existe et est récent, on
  // pré-remplit les champs (sauf password + cguAccepted, cf en-tête).
  const draft = readSignupDraft()

  // Étape 1 — informations
  const [step,      setStep]      = useState(draft?.step      ?? 1)
  const [firstName, setFirstName] = useState(draft?.firstName ?? '')
  const [lastName,  setLastName]  = useState(draft?.lastName  ?? '')
  const [company,   setCompany]   = useState(draft?.company   ?? '')
  const [email,     setEmail]     = useState(draft?.email     ?? '')
  const [password,  setPassword]  = useState('')
  const [cguAccepted, setCguAccepted] = useState(false)

  // Étape 2 — métiers
  const [trades,     setTrades]     = useState(draft?.trades ?? [])
  const [tradeInput, setTradeInput] = useState('')
  const [showDrop,   setShowDrop]   = useState(false)
  const inputRef = useRef(null)

  // Résultat
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState(null)
  const [sent,    setSent]    = useState(false)

  // Persistance à chaque changement de champ. On debounce pas — le write
  // est synchrone et léger.
  useEffect(() => {
    writeSignupDraft({ step, firstName, lastName, company, email, trades })
  }, [step, firstName, lastName, company, email, trades])

  // Nettoyage au succès (compte créé) — pas de raison de garder un
  // brouillon une fois l'inscription effective.
  useEffect(() => {
    if (sent) clearSignupDraft()
  }, [sent])

  // ── Étape 1 → 2 ──────────────────────────────────────────
  const goToStep2 = (e) => {
    e.preventDefault()
    if (!cguAccepted) return
    setError(null)
    setStep(2)
  }

  // ── Sélection métiers ─────────────────────────────────────
  const addTrade = (label) => {
    const t = label.trim()
    if (!t || trades.length >= 10) return
    if (trades.some(x => normalize(x) === normalize(t))) return
    setTrades(prev => [...prev, t])
    setTradeInput(''); setShowDrop(false)
  }
  const removeTrade = (label) => setTrades(prev => prev.filter(t => t !== label))

  const onKey = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      if (suggestions.length) addTrade(suggestions[0])
      else if (tradeInput.trim()) addTrade(tradeInput)
    } else if (e.key === 'Backspace' && !tradeInput && trades.length) {
      removeTrade(trades[trades.length - 1])
    } else if (e.key === 'Escape') {
      setShowDrop(false)
    }
  }

  const suggestions = tradeInput.trim()
    ? searchTrades(tradeInput).filter(x => !trades.some(t => normalize(t) === normalize(x)))
    : []
  const showExact = tradeInput.trim() && !suggestions.some(x => normalize(x) === normalize(tradeInput.trim()))

  // ── Création du compte ────────────────────────────────────
  const submit = async () => {
    if (loading) return
    setError(null); setLoading(true)
    try {
      const fullName = `${firstName.trim()} ${lastName.trim()}`.trim()
      const { error } = await signUpWithPassword(email, password, {
        first_name:      firstName.trim(),
        last_name:       lastName.trim(),
        full_name:       fullName,
        company_name:    company,
        trades:          trades,
        cgu_version:     CGU_VERSION,
        cgu_accepted_at: new Date().toISOString(),
      })
      if (error) { setError(error.message); setStep(1); return }
      saveCguAcceptance(CGU_VERSION).catch(() => {})
      setSent(true)
    } finally {
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <div className="zb-form" style={s.wrap}>
        <style>{FORM_CSS}</style>
        <div style={s.card}>
          <div role="status" style={s.ok}>
            Compte créé ! Un email de confirmation a été envoyé à <b>{email}</b>. Clique sur le lien pour activer ton compte.
          </div>
          <div style={s.switch}>
            <button type="button" style={s.link} onClick={onSwitchToLogin}>Retour à la connexion</button>
          </div>
        </div>
      </div>
    )
  }

  const tradesDisabled = loading || trades.length === 0

  return (
    <div className="zb-form" style={s.wrap}>
      <style>{FORM_CSS}</style>
      <div style={s.card}>
        {/* Retour */}
        {(onBack || step === 2) && (
          <button type="button"
            onClick={step === 2 ? () => setStep(1) : onBack}
            style={{background:'none',border:'none',color:ZB.ink2,fontSize:15,fontWeight:600,cursor:'pointer',padding:'0 8px 0 0',minHeight:44,marginTop:-8,marginBottom:8,display:'flex',alignItems:'center',gap:4,fontFamily:'inherit'}}>
            {Iback} Retour
          </button>
        )}

        {/* Indicateur d'étapes */}
        <div aria-label={`Étape ${step} sur 2`} role="img" style={{display:'flex',gap:6,marginBottom:20}}>
          {[1,2].map(n => (
            <div key={n} style={{height:3,flex:1,borderRadius:2,background: n <= step ? ZB.ink : ZB.rule,transition:'background .2s'}} />
          ))}
        </div>

        {/* ── ÉTAPE 1 : Informations ── */}
        {step === 1 && (
          <>
            <h1 style={s.title}>Créer un compte</h1>
            <p style={{marginTop:4,marginBottom:20,fontSize:15,color:ZB.ink2}}>Gratuit à vie, aucune carte bancaire.</p>

            <form onSubmit={goToStep2}>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                <div>
                  <label style={s.label} htmlFor="signup-first">Prénom</label>
                  <input id="signup-first" required value={firstName} onChange={e=>setFirstName(e.target.value)} style={s.input} autoComplete="given-name" />
                </div>
                <div>
                  <label style={s.label} htmlFor="signup-last">Nom</label>
                  <input id="signup-last" required value={lastName} onChange={e=>setLastName(e.target.value)} style={s.input} autoComplete="family-name" />
                </div>
              </div>
              <div style={{height:12}}/>
              <label style={s.label} htmlFor="signup-company">Nom de l'entreprise</label>
              <input id="signup-company" required value={company} onChange={e=>setCompany(e.target.value)} style={s.input} autoComplete="organization" placeholder="Ex : SARL Dupont, Martin Plomberie…" />
              <div style={{height:12}}/>
              <label style={s.label} htmlFor="signup-email">Email</label>
              <input id="signup-email" type="email" required value={email} onChange={e=>setEmail(e.target.value)} style={s.input} autoComplete="email" />
              <div style={{height:12}}/>
              <label style={s.label} htmlFor="signup-password">Mot de passe (min. 6 caractères)</label>
              <input id="signup-password" type="password" required minLength={6} value={password} onChange={e=>setPassword(e.target.value)} style={s.input} autoComplete="new-password" />

              <label style={{display:'flex',alignItems:'flex-start',gap:10,marginTop:18,minHeight:44,cursor:'pointer',userSelect:'none'}}>
                <input type="checkbox" checked={cguAccepted} onChange={e=>setCguAccepted(e.target.checked)}
                  style={{width:20,height:20,marginTop:1,accentColor:ZB.accent,flexShrink:0,cursor:'pointer'}} />
                <span style={{fontSize:15,color:ZB.ink,lineHeight:1.45}}>
                  J'accepte les{' '}
                  <a href="/cgu" target="_blank" rel="noopener noreferrer"
                    style={{color:ZB.accent,fontWeight:600,textDecoration:'underline'}}>
                    Conditions Générales d'Utilisation et de Vente (CGU/CGV)
                  </a>
                </span>
              </label>

              {error && <div role="alert" style={s.err}>{error}</div>}

              <button type="submit" disabled={!cguAccepted}
                style={{...s.btn, opacity:!cguAccepted ? 0.5 : 1, cursor:!cguAccepted ? 'not-allowed' : 'pointer'}}>
                Suivant
              </button>
            </form>

            <div style={s.switch}>
              Déjà un compte ?{' '}
              <button type="button" style={s.link} onClick={onSwitchToLogin}>Se connecter</button>
            </div>
          </>
        )}

        {/* ── ÉTAPE 2 : Métiers ── */}
        {step === 2 && (
          <>
            <h1 style={s.title}>Ton activité</h1>
            <p style={{marginTop:4,marginBottom:18,fontSize:15,color:ZB.ink2,lineHeight:1.5}}>
              Choisis tes métiers pour que l'IA génère des devis <strong style={{color:ZB.ink}}>précis et adaptés</strong> dès le premier essai.
            </p>

            {/* Tags sélectionnés */}
            {trades.length > 0 && (
              <div style={{display:'flex',flexWrap:'wrap',gap:6,marginBottom:12}}>
                {trades.map(t => (
                  <span key={t} style={{display:'inline-flex',alignItems:'center',minHeight:44,background:ZB.accentSoft,border:`1px solid ${ZB.rule}`,color:ZB.ink,borderRadius:8,padding:'0 0 0 12px',fontSize:15,fontWeight:600}}>
                    {t}
                    <button type="button" onClick={()=>removeTrade(t)} aria-label={`Retirer ${t}`}
                      style={{width:40,height:44,display:'grid',placeItems:'center',background:'none',border:'none',color:ZB.ink2,cursor:'pointer',padding:0}}>{Iclose}</button>
                  </span>
                ))}
              </div>
            )}

            {/* Champ de recherche */}
            {trades.length < 10 && (
              <div style={{position:'relative',marginBottom:12}}>
                <input
                  ref={inputRef}
                  value={tradeInput}
                  onChange={e=>{setTradeInput(e.target.value);setShowDrop(true)}}
                  onKeyDown={onKey}
                  onFocus={()=>setShowDrop(true)}
                  onBlur={()=>setTimeout(()=>setShowDrop(false),150)}
                  placeholder="Rechercher un métier… ex : Plomberie, Coiffure"
                  aria-label="Rechercher un métier"
                  style={{...s.input, paddingRight:tradeInput?44:12}}
                />
                {tradeInput && (
                  <button type="button" aria-label="Effacer la saisie" onMouseDown={e=>{e.preventDefault();setTradeInput('');setShowDrop(false)}}
                    style={{position:'absolute',right:2,top:'50%',transform:'translateY(-50%)',width:44,height:44,display:'grid',placeItems:'center',background:'none',border:'none',color:ZB.ink2,cursor:'pointer',padding:0}}>{Iclose}</button>
                )}
                {showDrop && tradeInput.trim() && (suggestions.length > 0 || showExact) && (
                  <div style={{position:'absolute',top:'calc(100% + 4px)',left:0,right:0,background:ZB.sheet,border:`1px solid ${ZB.rule}`,borderRadius:8,zIndex:100,boxShadow:'0 10px 30px rgba(26,22,18,.16)',maxHeight:220,overflowY:'auto'}}>
                    {suggestions.map((sg, i) => (
                      <button key={sg} type="button" className="zb-opt" onMouseDown={()=>addTrade(sg)}
                        style={{width:'100%',minHeight:44,background:ZB.sheet,border:'none',borderTop:i>0?`1px solid ${ZB.ruleSoft}`:'none',padding:'10px 14px',textAlign:'left',color:ZB.ink,fontSize:15,cursor:'pointer',fontFamily:'inherit'}}>
                        {sg}
                      </button>
                    ))}
                    {showExact && (
                      <button type="button" className="zb-opt" onMouseDown={()=>addTrade(tradeInput)}
                        style={{width:'100%',minHeight:44,background:ZB.sheet,border:'none',borderTop:`1px solid ${ZB.ruleSoft}`,padding:'10px 14px',textAlign:'left',color:ZB.accent,fontSize:15,fontWeight:600,cursor:'pointer',display:'flex',alignItems:'center',gap:8,fontFamily:'inherit'}}>
                        {Iplus} Ajouter « {tradeInput.trim()} »
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Suggestions rapides */}
            {trades.length === 0 && !tradeInput && (
              <div style={{marginBottom:16}}>
                <p style={{margin:'0 0 8px',fontSize:14,fontWeight:600,color:ZB.ink2}}>Populaires</p>
                <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
                  {TRADE_EXAMPLES.map(t => (
                    <button key={t} type="button" className="zb-opt" onClick={()=>addTrade(t)}
                      style={{display:'inline-flex',alignItems:'center',gap:6,minHeight:44,background:ZB.sheet,border:`1px solid ${ZB.rule}`,color:ZB.ink,borderRadius:8,padding:'0 12px',fontSize:15,cursor:'pointer',fontFamily:'inherit'}}>
                      <span style={{color:ZB.ink2,display:'flex'}}>{Iplus}</span>{t}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div style={{fontSize:13,fontWeight:600,color:ZB.ink2,marginBottom:8,textAlign:'right',fontVariantNumeric:'tabular-nums'}}>
              {trades.length === 0 ? 'Aucun métier sélectionné' : `${trades.length} métier${trades.length>1?'s':''} sélectionné${trades.length>1?'s':''}`}
            </div>

            {error && <div role="alert" style={s.err}>{error}</div>}

            <button type="button" onClick={submit} disabled={tradesDisabled}
              style={{...s.btn, opacity:tradesDisabled ? 0.5 : 1, cursor:tradesDisabled ? 'not-allowed' : 'pointer'}}>
              {loading ? 'Création…' : 'Créer mon compte'}
            </button>

            <button type="button" onClick={submit} disabled={loading}
              style={{width:'100%',minHeight:48,padding:'0 10px',border:'none',background:'none',color:ZB.ink2,fontSize:15,fontWeight:600,cursor:loading?'not-allowed':'pointer',marginTop:4,fontFamily:'inherit'}}>
              Passer cette étape
            </button>
          </>
        )}
      </div>
    </div>
  )
}
