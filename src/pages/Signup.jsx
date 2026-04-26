import { useState, useRef } from 'react'
import { useAuth } from '../lib/auth.jsx'
import { saveCguAcceptance } from '../lib/api.js'
import { CGU_VERSION } from './CGU.jsx'
import { searchTrades, TRADE_EXAMPLES } from '../lib/trades.js'

const s = {
  wrap:   { minHeight:'100vh', display:'grid', placeItems:'center', padding:24, background:'#FAF7F2', fontFamily:'Inter,system-ui,sans-serif' },
  card:   { width:'100%', maxWidth:440, background:'#fff', borderRadius:16, padding:32, boxShadow:'0 8px 24px rgba(15,23,42,.08)' },
  label:  { display:'block', fontSize:12, fontWeight:600, color:'#3D3028', marginBottom:6 },
  input:  { width:'100%', padding:'12px 14px', border:'1px solid #E8E2D8', borderRadius:10, fontSize:14, outline:'none', boxSizing:'border-box' },
  btn:    { width:'100%', padding:'12px 14px', border:0, borderRadius:10, fontSize:14, fontWeight:600, cursor:'pointer', background:'#1A1612', color:'#fff', marginTop:16 },
  err:    { background:'#fef2f2', color:'#991b1b', padding:10, borderRadius:10, fontSize:13, marginTop:12 },
  ok:     { background:'#ecfdf5', color:'#065f46', padding:10, borderRadius:10, fontSize:13, marginTop:12 },
  switch: { textAlign:'center', marginTop:20, fontSize:13, color:'#6B6358' },
  link:   { color:'#1d4ed8', background:'none', border:0, cursor:'pointer', fontWeight:600, padding:0 },
}

const normalize = t => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

export default function Signup({ onSwitchToLogin, onBack }) {
  const { signUpWithPassword } = useAuth()

  // Étape 1 — informations
  const [step,      setStep]      = useState(1)
  const [firstName, setFirstName] = useState('')
  const [lastName,  setLastName]  = useState('')
  const [company,   setCompany]   = useState('')
  const [email,     setEmail]     = useState('')
  const [password,  setPassword]  = useState('')
  const [cguAccepted, setCguAccepted] = useState(false)

  // Étape 2 — métiers
  const [trades,     setTrades]     = useState([])
  const [tradeInput, setTradeInput] = useState('')
  const [showDrop,   setShowDrop]   = useState(false)
  const inputRef = useRef(null)

  // Résultat
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState(null)
  const [sent,    setSent]    = useState(false)

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
    setError(null); setLoading(true)
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
    setLoading(false)
    if (error) { setError(error.message); setStep(1); return }
    saveCguAcceptance(CGU_VERSION).catch(() => {})
    setSent(true)
  }

  if (sent) {
    return (
      <div style={s.wrap}>
        <div style={s.card}>
          <div style={s.ok}>
            Compte créé ! Un email de confirmation a été envoyé à <b>{email}</b>. Cliquez sur le lien pour activer votre compte.
          </div>
          <div style={s.switch}>
            <button type="button" style={s.link} onClick={onSwitchToLogin}>Retour à la connexion</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={s.wrap}>
      <div style={s.card}>
        {/* Retour */}
        {(onBack || step === 2) && (
          <button type="button"
            onClick={step === 2 ? () => setStep(1) : onBack}
            style={{background:'none',border:'none',color:'#9A8E82',fontSize:13,cursor:'pointer',padding:0,marginBottom:16,display:'flex',alignItems:'center',gap:4}}>
            ← Retour
          </button>
        )}

        {/* Indicateur d'étapes */}
        <div style={{display:'flex',gap:6,marginBottom:24}}>
          {[1,2].map(n => (
            <div key={n} style={{height:3,flex:1,borderRadius:2,background: n <= step ? '#1A1612' : '#E8E2D8',transition:'background .2s'}} />
          ))}
        </div>

        {/* ── ÉTAPE 1 : Informations ── */}
        {step === 1 && (
          <>
            <h1 style={{margin:0,fontSize:22,fontWeight:600,color:'#1A1612',fontFamily:"'Syne',sans-serif",letterSpacing:'-0.5px'}}>Créer un compte</h1>
            <p style={{marginTop:4,marginBottom:24,fontSize:14,color:'#6B6358'}}>30 jours d'essai, aucune carte bancaire.</p>

            <form onSubmit={goToStep2}>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                <div>
                  <label style={s.label}>Prénom</label>
                  <input required value={firstName} onChange={e=>setFirstName(e.target.value)} style={s.input} autoComplete="given-name" />
                </div>
                <div>
                  <label style={s.label}>Nom</label>
                  <input required value={lastName} onChange={e=>setLastName(e.target.value)} style={s.input} autoComplete="family-name" />
                </div>
              </div>
              <div style={{height:12}}/>
              <label style={s.label}>Nom de l'entreprise</label>
              <input required value={company} onChange={e=>setCompany(e.target.value)} style={s.input} autoComplete="organization" placeholder="Ex : Aila Façade, SARL Dupont…" />
              <div style={{height:12}}/>
              <label style={s.label}>Email</label>
              <input type="email" required value={email} onChange={e=>setEmail(e.target.value)} style={s.input} autoComplete="email" />
              <div style={{height:12}}/>
              <label style={s.label}>Mot de passe (min. 6 caractères)</label>
              <input type="password" required minLength={6} value={password} onChange={e=>setPassword(e.target.value)} style={s.input} autoComplete="new-password" />

              <label style={{display:'flex',alignItems:'flex-start',gap:10,marginTop:20,cursor:'pointer',userSelect:'none'}}>
                <input type="checkbox" checked={cguAccepted} onChange={e=>setCguAccepted(e.target.checked)}
                  style={{width:16,height:16,marginTop:2,accentColor:'#1A1612',flexShrink:0,cursor:'pointer'}} />
                <span style={{fontSize:13,color:'#3D3028',lineHeight:1.5}}>
                  J'accepte les{' '}
                  <a href="/cgu" target="_blank" rel="noopener noreferrer"
                    style={{color:'#2563eb',fontWeight:600,textDecoration:'underline'}}>
                    Conditions Générales d'Utilisation
                  </a>
                </span>
              </label>

              {error && <div style={s.err}>{error}</div>}

              <button type="submit" disabled={!cguAccepted}
                style={{...s.btn, opacity:!cguAccepted ? 0.45 : 1, cursor:!cguAccepted ? 'not-allowed' : 'pointer'}}>
                Suivant →
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
            <h1 style={{margin:0,fontSize:22,fontWeight:600,color:'#1A1612',fontFamily:"'Syne',sans-serif",letterSpacing:'-0.5px'}}>Votre activité</h1>
            <p style={{marginTop:4,marginBottom:20,fontSize:14,color:'#6B6358',lineHeight:1.6}}>
              Choisissez vos métiers pour que l'IA génère des devis <strong>précis et adaptés</strong> dès le premier essai.
            </p>

            {/* Tags sélectionnés */}
            {trades.length > 0 && (
              <div style={{display:'flex',flexWrap:'wrap',gap:7,marginBottom:12}}>
                {trades.map(t => (
                  <span key={t} style={{display:'inline-flex',alignItems:'center',gap:5,background:'#f0fdf4',border:'1px solid #bbf7d0',color:'#15803d',borderRadius:20,padding:'5px 11px',fontSize:13,fontWeight:600}}>
                    {t}
                    <button onClick={()=>removeTrade(t)}
                      style={{background:'none',border:'none',color:'#16a34a',cursor:'pointer',fontSize:15,lineHeight:1,padding:'0 0 0 2px'}}>×</button>
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
                  style={{...s.input, paddingRight:tradeInput?40:14, borderColor: showDrop && tradeInput ? '#1A1612' : '#E8E2D8'}}
                />
                {tradeInput && (
                  <button onMouseDown={e=>{e.preventDefault();setTradeInput('');setShowDrop(false)}}
                    style={{position:'absolute',right:12,top:'50%',transform:'translateY(-50%)',background:'none',border:'none',color:'#9A8E82',cursor:'pointer',fontSize:18,lineHeight:1}}>×</button>
                )}
                {showDrop && tradeInput.trim() && (suggestions.length > 0 || showExact) && (
                  <div style={{position:'absolute',top:'100%',left:0,right:0,background:'#fff',border:'1px solid #E8E2D8',borderTop:'none',borderRadius:'0 0 10px 10px',zIndex:100,boxShadow:'0 8px 16px rgba(15,23,42,.08)',maxHeight:220,overflowY:'auto'}}>
                    {suggestions.map((sg, i) => (
                      <button key={sg} onMouseDown={()=>addTrade(sg)}
                        style={{width:'100%',background:'none',border:'none',borderTop:i>0?'1px solid #F0EBE3':'none',padding:'10px 14px',textAlign:'left',color:'#3D3028',fontSize:13,cursor:'pointer'}}>
                        {sg}
                      </button>
                    ))}
                    {showExact && (
                      <button onMouseDown={()=>addTrade(tradeInput)}
                        style={{width:'100%',background:'#FAF7F2',border:'none',borderTop:'1px solid #E8E2D8',padding:'10px 14px',textAlign:'left',color:'#1A1612',fontSize:13,fontWeight:600,cursor:'pointer'}}>
                        + Ajouter « {tradeInput.trim()} »
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Suggestions rapides */}
            {trades.length === 0 && !tradeInput && (
              <div style={{marginBottom:16}}>
                <div style={{fontSize:11,fontWeight:600,color:'#9A8E82',letterSpacing:'1px',textTransform:'uppercase',marginBottom:8}}>Populaires</div>
                <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
                  {TRADE_EXAMPLES.map(t => (
                    <button key={t} onClick={()=>addTrade(t)}
                      style={{background:'#FAF7F2',border:'1px solid #E8E2D8',color:'#475569',borderRadius:18,padding:'6px 12px',fontSize:12,cursor:'pointer'}}>
                      + {t}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div style={{fontSize:11,color:'#9A8E82',marginBottom:16,textAlign:'right'}}>
              {trades.length === 0 ? 'Aucun métier sélectionné' : `${trades.length} métier${trades.length>1?'s':''} sélectionné${trades.length>1?'s':''}`}
            </div>

            {error && <div style={s.err}>{error}</div>}

            <button onClick={submit} disabled={loading || trades.length === 0}
              style={{...s.btn, opacity:(loading || trades.length === 0) ? 0.45 : 1, cursor:(loading || trades.length === 0) ? 'not-allowed' : 'pointer'}}>
              {loading ? 'Création…' : '✓ Créer mon compte'}
            </button>

            <button type="button" onClick={submit} disabled={loading}
              style={{width:'100%',padding:'10px',border:'none',background:'none',color:'#9A8E82',fontSize:13,cursor:loading?'not-allowed':'pointer',marginTop:8}}>
              Passer cette étape
            </button>
          </>
        )}
      </div>
    </div>
  )
}
