import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase.js'

// ── Helpers ────────────────────────────────────────────────────────────────

async function getToken() {
  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token ?? null
}

async function api(method, params = {}) {
  const token = await getToken()
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
  if (method === 'GET') {
    const qs = new URLSearchParams(params).toString()
    const r = await fetch(`/api/crm${qs ? '?' + qs : ''}`, { headers })
    if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.error || `Erreur ${r.status}`) }
    return r.json()
  }
  const r = await fetch('/api/crm', { method: 'POST', headers, body: JSON.stringify(params) })
  if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.error || `Erreur ${r.status}`) }
  return r.json()
}

// ── Constants ──────────────────────────────────────────────────────────────

const STATUTS = [
  { id: 'a_contacter', label: 'À contacter', color: '#6B6358', bg: '#F0ECE4' },
  { id: 'contacte',    label: 'Contacté',    color: '#2563eb', bg: '#dbeafe' },
  { id: 'repondu',     label: 'A répondu',   color: '#d97706', bg: '#fef3c7' },
  { id: 'converti',    label: 'Converti',    color: '#16a34a', bg: '#dcfce7' },
  { id: 'sans_suite',  label: 'Sans suite',  color: '#dc2626', bg: '#fee2e2' },
]

const SECTEURS = [
  'Plomberie', 'Électricité', 'Peinture', 'Menuiserie', 'Maçonnerie',
  'Carrelage', 'Toiture', 'Isolation', 'Climatisation', 'Chauffage',
  'Serrurerie', 'Plâtrerie', 'Jardinage', 'Nettoyage', 'Autre',
]

const DEFAULT_SUJET = 'Un outil made in Normandie pour arrêter de perdre du temps sur vos devis'

function buildTemplate(prospect) {
  const prenom = (prospect.nom || '').split(' ')[0] || prospect.nom || ''
  const ville  = prospect.ville ? ` de ${prospect.ville}` : ' de votre région'
  const metier = prospect.secteur ? ` (${prospect.secteur.toLowerCase()})` : ''
  return `Bonjour ${prenom},

Je m'appelle Dursun, développeur indépendant havrais.

Avant de coder, j'ai passé des années à travailler avec des artisans${metier} de la région — et j'ai vu la même scène se répéter : des soirées entières à taper des devis sur Word, des factures qui partent en retard, des relances oubliées. Des gens excellents dans leur métier, ralentis par la paperasse.

Alors j'ai construit **Zenbat** — un logiciel de devis et facturation conçu spécifiquement pour les artisans et indépendants français.

Ce que ça fait, concrètement :
• Devis en quelques clics, PDF professionnel envoyé directement au client
• Signature électronique du client depuis son téléphone
• Facturation conforme Factur-X (norme 2026 obligatoire pour la facturation B2B)
• Un assistant IA qui rédige les lignes de devis à votre place

Pourquoi je vous écris :
Je lance Zenbat en Baie de Seine en premier. Je veux que les premiers utilisateurs soient des entreprises${ville}, pas de Paris. Retours directs, échanges humains, et si quelque chose ne va pas — vous m'appelez, je corrige.

L'offre : Accès gratuit et complet pendant 3 mois, sans carte bancaire, sans engagement.

Si ça vous intéresse, répondez simplement à ce mail.

À bientôt,
Dursun
Créateur de Zenbat · Le Havre
zenbat.fr`
}

// ── Composants UI légers ───────────────────────────────────────────────────

function Badge({ statut }) {
  const s = STATUTS.find(x => x.id === statut) || STATUTS[0]
  return (
    <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20,
      color: s.color, background: s.bg, whiteSpace: 'nowrap' }}>
      {s.label}
    </span>
  )
}

function Spinner() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
      <div style={{ width: 20, height: 20, border: '2px solid #E8E2D8',
        borderTopColor: '#22c55e', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }}/>
    </div>
  )
}

// ── Modal ajout / édition prospect ────────────────────────────────────────

function ProspectModal({ prospect, onSave, onClose }) {
  const [form, setForm] = useState({
    nom: prospect?.nom || '', entreprise: prospect?.entreprise || '',
    email: prospect?.email || '', telephone: prospect?.telephone || '',
    ville: prospect?.ville || '', secteur: prospect?.secteur || '',
    statut: prospect?.statut || 'a_contacter', notes: prospect?.notes || '',
  })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }))

  const handleSave = async () => {
    if (!form.nom.trim() || !form.email.trim()) { setErr('Nom et email requis.'); return }
    setSaving(true); setErr('')
    try {
      const action = prospect ? 'update' : 'create'
      const payload = { action, ...form }
      if (prospect) payload.id = prospect.id
      const data = await api('POST', payload)
      onSave(data.prospect)
    } catch (e) { setErr(e.message) }
    finally { setSaving(false) }
  }

  const inputStyle = {
    width: '100%', padding: '8px 10px', border: '1px solid #E8E2D8',
    borderRadius: 8, fontSize: 13, background: '#FAF7F2',
    fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
  }
  const labelStyle = { display: 'block', fontSize: 11, fontWeight: 600,
    color: '#6B6358', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(26,22,18,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 16, padding: 28, width: '100%',
        maxWidth: 480, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: '#1A1612' }}>
            {prospect ? 'Modifier le prospect' : 'Nouveau prospect'}
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20,
            color: '#6B6358', cursor: 'pointer', lineHeight: 1, padding: 4 }}>×</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div style={{ gridColumn: '1/-1' }}>
            <label style={labelStyle}>Nom *</label>
            <input style={inputStyle} value={form.nom} onChange={set('nom')} placeholder="Jean Dupont" />
          </div>
          <div>
            <label style={labelStyle}>Entreprise</label>
            <input style={inputStyle} value={form.entreprise} onChange={set('entreprise')} placeholder="Dupont Plomberie" />
          </div>
          <div>
            <label style={labelStyle}>Email *</label>
            <input style={inputStyle} type="email" value={form.email} onChange={set('email')} placeholder="jean@dupont.fr" />
          </div>
          <div>
            <label style={labelStyle}>Téléphone</label>
            <input style={inputStyle} value={form.telephone} onChange={set('telephone')} placeholder="06 12 34 56 78" />
          </div>
          <div>
            <label style={labelStyle}>Ville</label>
            <input style={inputStyle} value={form.ville} onChange={set('ville')} placeholder="Le Havre" />
          </div>
          <div>
            <label style={labelStyle}>Secteur</label>
            <select style={{ ...inputStyle, cursor: 'pointer' }} value={form.secteur} onChange={set('secteur')}>
              <option value="">— Choisir —</option>
              {SECTEURS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Statut</label>
            <select style={{ ...inputStyle, cursor: 'pointer' }} value={form.statut} onChange={set('statut')}>
              {STATUTS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </div>
          <div style={{ gridColumn: '1/-1' }}>
            <label style={labelStyle}>Notes</label>
            <textarea style={{ ...inputStyle, minHeight: 64, resize: 'vertical' }}
              value={form.notes} onChange={set('notes')} placeholder="Informations utiles…" />
          </div>
        </div>

        {err && <p style={{ color: '#dc2626', fontSize: 12, marginTop: 12 }}>{err}</p>}

        <div style={{ display: 'flex', gap: 8, marginTop: 20, justifyContent: 'flex-end' }}>
          <button onClick={onClose} disabled={saving}
            style={{ padding: '9px 18px', border: '1px solid #E8E2D8', borderRadius: 8,
              background: '#FAF7F2', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
            Annuler
          </button>
          <button onClick={handleSave} disabled={saving}
            style={{ padding: '9px 18px', border: 'none', borderRadius: 8, background: '#1A1612',
              color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
            {saving ? 'Enregistrement…' : (prospect ? 'Enregistrer' : 'Créer')}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Panneau de détail prospect ─────────────────────────────────────────────

function ProspectDetail({ prospectId, onUpdate, onDelete }) {
  const [data, setData]         = useState(null)
  const [tab, setTab]           = useState('emails') // 'emails' | 'composer'
  const [loading, setLoading]   = useState(true)
  const [sujet, setSujet]       = useState('')
  const [corps, setCorps]       = useState('')
  const [sending, setSending]   = useState(false)
  const [sendErr, setSendErr]   = useState('')
  const [sendOk, setSendOk]     = useState(false)
  const [editModal, setEditModal] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const d = await api('GET', { action: 'get', id: prospectId })
      setData(d)
    } catch {}
    finally { setLoading(false) }
  }, [prospectId])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (data?.prospect) {
      setSujet(DEFAULT_SUJET)
      setCorps(buildTemplate(data.prospect))
      setSendOk(false)
      setSendErr('')
    }
  }, [data?.prospect?.id])

  const handleSend = async () => {
    if (!sujet.trim() || !corps.trim()) { setSendErr('Sujet et corps requis.'); return }
    setSending(true); setSendErr(''); setSendOk(false)
    try {
      await api('POST', { action: 'send_email', id: prospectId, sujet, corps })
      setSendOk(true)
      // Rafraîchir l'historique + statut
      const d = await api('GET', { action: 'get', id: prospectId })
      setData(d)
      onUpdate(d.prospect)
      setTab('emails')
    } catch (e) { setSendErr(e.message) }
    finally { setSending(false) }
  }

  const handleChangeStatut = async (statut) => {
    try {
      const { prospect } = await api('POST', { action: 'update', id: prospectId, statut })
      setData(d => ({ ...d, prospect }))
      onUpdate(prospect)
    } catch {}
  }

  const handleDelete = async () => {
    if (!window.confirm('Supprimer ce prospect et tout son historique ?')) return
    try {
      await api('POST', { action: 'delete', id: prospectId })
      onDelete(prospectId)
    } catch {}
  }

  if (loading) return <Spinner />
  if (!data) return <div style={{ padding: 40, color: '#6B6358', textAlign: 'center' }}>Impossible de charger.</div>

  const { prospect, emails } = data
  const s = STATUTS.find(x => x.id === prospect.statut) || STATUTS[0]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header prospect */}
      <div style={{ padding: '20px 24px', borderBottom: '1px solid #E8E2D8', background: '#fff' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 4 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1A1612' }}>{prospect.nom}</h2>
              {prospect.entreprise && <span style={{ fontSize: 13, color: '#6B6358' }}>{prospect.entreprise}</span>}
              <Badge statut={prospect.statut} />
            </div>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              <a href={`mailto:${prospect.email}`} style={{ fontSize: 12, color: '#2563eb', textDecoration: 'none' }}>{prospect.email}</a>
              {prospect.telephone && <span style={{ fontSize: 12, color: '#6B6358' }}>{prospect.telephone}</span>}
              {prospect.ville && <span style={{ fontSize: 12, color: '#6B6358' }}>📍 {prospect.ville}</span>}
              {prospect.secteur && <span style={{ fontSize: 12, color: '#6B6358' }}>🔨 {prospect.secteur}</span>}
            </div>
            {prospect.notes && <p style={{ fontSize: 12, color: '#6B6358', marginTop: 6, fontStyle: 'italic' }}>{prospect.notes}</p>}
          </div>
          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
            <select
              value={prospect.statut}
              onChange={e => handleChangeStatut(e.target.value)}
              style={{ fontSize: 11, padding: '5px 8px', border: `1px solid ${s.color}`, borderRadius: 6,
                color: s.color, background: s.bg, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>
              {STATUTS.map(st => <option key={st.id} value={st.id}>{st.label}</option>)}
            </select>
            <button onClick={() => setEditModal(true)}
              style={{ padding: '6px 12px', border: '1px solid #E8E2D8', borderRadius: 6,
                background: '#FAF7F2', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
              Modifier
            </button>
            <button onClick={handleDelete}
              style={{ padding: '6px 12px', border: '1px solid #fecaca', borderRadius: 6,
                background: '#fff', color: '#dc2626', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
              Supprimer
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid #E8E2D8', background: '#fff' }}>
        {[
          { id: 'emails',   label: `Historique${emails.length ? ` (${emails.length})` : ''}` },
          { id: 'composer', label: '✉ Rédiger un mail' },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ padding: '10px 20px', border: 'none', borderBottom: tab === t.id ? '2px solid #1A1612' : '2px solid transparent',
              background: 'none', fontSize: 13, fontWeight: tab === t.id ? 600 : 400,
              color: tab === t.id ? '#1A1612' : '#6B6358', cursor: 'pointer', fontFamily: 'inherit' }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
        {tab === 'emails' && (
          emails.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#6B6358' }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>✉</div>
              <div style={{ fontSize: 14 }}>Aucun mail envoyé encore.</div>
              <button onClick={() => setTab('composer')}
                style={{ marginTop: 12, padding: '8px 16px', border: 'none', borderRadius: 8,
                  background: '#1A1612', color: '#fff', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                Rédiger le premier mail
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {emails.map(em => (
                <div key={em.id} style={{ border: '1px solid #E8E2D8', borderRadius: 10, padding: '14px 16px', background: '#fff' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#1A1612' }}>{em.sujet}</span>
                    <span style={{ fontSize: 11, color: '#6B6358', whiteSpace: 'nowrap' }}>
                      {new Date(em.sent_at).toLocaleDateString('fr-FR', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' })}
                    </span>
                  </div>
                  <pre style={{ fontSize: 12, color: '#6B6358', whiteSpace: 'pre-wrap', fontFamily: 'inherit', lineHeight: 1.6,
                    maxHeight: 200, overflow: 'hidden', position: 'relative' }}>
                    {em.corps.slice(0, 400)}{em.corps.length > 400 ? '…' : ''}
                  </pre>
                </div>
              ))}
            </div>
          )
        )}

        {tab === 'composer' && (
          <div style={{ maxWidth: 640 }}>
            {sendOk && (
              <div style={{ background: '#dcfce7', border: '1px solid #86efac', borderRadius: 8,
                padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#16a34a' }}>
                ✓ Mail envoyé avec succès et enregistré dans l'historique.
              </div>
            )}
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#6B6358',
                marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Objet</label>
              <input
                value={sujet}
                onChange={e => setSujet(e.target.value)}
                style={{ width: '100%', padding: '9px 12px', border: '1px solid #E8E2D8', borderRadius: 8,
                  fontSize: 13, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', background: '#FAF7F2' }}
              />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#6B6358',
                marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Corps du mail</label>
              <textarea
                value={corps}
                onChange={e => setCorps(e.target.value)}
                rows={20}
                style={{ width: '100%', padding: '10px 12px', border: '1px solid #E8E2D8', borderRadius: 8,
                  fontSize: 13, fontFamily: 'inherit', lineHeight: 1.7, outline: 'none',
                  resize: 'vertical', boxSizing: 'border-box', background: '#FAF7F2' }}
              />
            </div>
            {sendErr && <p style={{ color: '#dc2626', fontSize: 12, marginBottom: 12 }}>{sendErr}</p>}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button onClick={handleSend} disabled={sending}
                style={{ padding: '10px 20px', border: 'none', borderRadius: 8, background: '#1A1612',
                  color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                  opacity: sending ? 0.6 : 1 }}>
                {sending ? 'Envoi en cours…' : `Envoyer à ${prospect.email}`}
              </button>
              <button onClick={() => setCorps(buildTemplate(prospect))}
                style={{ padding: '10px 16px', border: '1px solid #E8E2D8', borderRadius: 8,
                  background: '#FAF7F2', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', color: '#6B6358' }}>
                Réinitialiser le template
              </button>
            </div>
            <p style={{ fontSize: 11, color: '#6B6358', marginTop: 8 }}>
              Le mail est envoyé depuis votre adresse Gmail configurée sur Vercel.
            </p>
          </div>
        )}
      </div>

      {editModal && (
        <ProspectModal
          prospect={prospect}
          onSave={p => { setData(d => ({ ...d, prospect: p })); onUpdate(p); setEditModal(false) }}
          onClose={() => setEditModal(false)}
        />
      )}
    </div>
  )
}

// ── Page principale CRM ────────────────────────────────────────────────────

export default function CRM() {
  const [authState, setAuthState]   = useState('loading') // 'loading' | 'ok' | 'denied'
  const [prospects, setProspects]   = useState([])
  const [selId, setSelId]           = useState(null)
  const [loading, setLoading]       = useState(true)
  const [filterStatut, setFilter]   = useState('all')
  const [search, setSearch]         = useState('')
  const [addModal, setAddModal]     = useState(false)

  // Vérification admin au montage
  useEffect(() => {
    ;(async () => {
      try {
        const token = await getToken()
        if (!token) { setAuthState('denied'); return }
        const r = await fetch('/api/account', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ action: 'whoami' }),
        })
        const d = await r.json().catch(() => ({}))
        setAuthState(d?.is_admin ? 'ok' : 'denied')
      } catch { setAuthState('denied') }
    })()
  }, [])

  const loadProspects = useCallback(async () => {
    setLoading(true)
    try {
      const { prospects: list } = await api('GET', { action: 'list' })
      setProspects(list || [])
    } catch {}
    finally { setLoading(false) }
  }, [])

  useEffect(() => { if (authState === 'ok') loadProspects() }, [authState, loadProspects])

  const filtered = prospects.filter(p => {
    if (filterStatut !== 'all' && p.statut !== filterStatut) return false
    if (search.trim()) {
      const q = search.toLowerCase()
      return (p.nom + p.entreprise + p.email + p.ville + p.secteur).toLowerCase().includes(q)
    }
    return true
  })

  const counts = STATUTS.reduce((acc, s) => {
    acc[s.id] = prospects.filter(p => p.statut === s.id).length
    return acc
  }, {})

  const handleProspectAdded = (p) => {
    setProspects(prev => [p, ...prev])
    setSelId(p.id)
    setAddModal(false)
  }

  const handleProspectUpdated = (p) => {
    setProspects(prev => prev.map(x => x.id === p.id ? { ...x, ...p } : x))
  }

  const handleProspectDeleted = (id) => {
    setProspects(prev => prev.filter(x => x.id !== id))
    if (selId === id) setSelId(null)
  }

  // ── Guards ─────────────────────────────────────────────────────────────

  if (authState === 'loading') {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center',
        background: '#FAF7F2', fontFamily: 'Inter, system-ui, sans-serif' }}>
        <Spinner />
      </div>
    )
  }

  if (authState === 'denied') {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center',
        background: '#FAF7F2', fontFamily: 'Inter, system-ui, sans-serif', textAlign: 'center', padding: 24 }}>
        <div>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🔒</div>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: '#1A1612', marginBottom: 8 }}>Accès restreint</h1>
          <p style={{ fontSize: 14, color: '#6B6358', marginBottom: 20 }}>Cette page est réservée à l'administrateur.</p>
          <a href="/" style={{ fontSize: 13, color: '#2563eb', textDecoration: 'none' }}>← Retour à l'accueil</a>
        </div>
      </div>
    )
  }

  // ── Layout principal ───────────────────────────────────────────────────

  return (
    <div style={{ minHeight: '100vh', background: '#FAF7F2', fontFamily: 'Inter, system-ui, sans-serif', display: 'flex', flexDirection: 'column' }}>
      <style>{`
        *{box-sizing:border-box;margin:0;padding:0}
        @keyframes spin{to{transform:rotate(360deg)}}
        body{margin:0}
      `}</style>

      {/* Header */}
      <div style={{ background: '#1A1612', color: '#fff', padding: '14px 24px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <a href="/" style={{ color: '#A8A09A', fontSize: 12, textDecoration: 'none' }}>← Zenbat</a>
          <span style={{ color: '#3a3530', fontSize: 14 }}>|</span>
          <span style={{ fontSize: 15, fontWeight: 700 }}>CRM Prospection</span>
          <span style={{ fontSize: 12, color: '#A8A09A' }}>Baie de Seine</span>
        </div>
        <button onClick={() => setAddModal(true)}
          style={{ padding: '7px 14px', background: '#22c55e', border: 'none', borderRadius: 8,
            color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
          + Prospect
        </button>
      </div>

      {/* Pipeline summary */}
      <div style={{ background: '#fff', borderBottom: '1px solid #E8E2D8',
        display: 'flex', gap: 0, overflowX: 'auto', flexShrink: 0 }}>
        {[{ id: 'all', label: 'Tous', color: '#1A1612', bg: '#F0ECE4' }, ...STATUTS].map(s => {
          const count = s.id === 'all' ? prospects.length : (counts[s.id] || 0)
          const active = filterStatut === s.id
          return (
            <button key={s.id} onClick={() => setFilter(s.id)}
              style={{ padding: '10px 16px', border: 'none', borderBottom: active ? `2px solid ${s.color}` : '2px solid transparent',
                background: 'none', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
                display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 18, fontWeight: 700, color: active ? s.color : '#6B6358' }}>{count}</span>
              <span style={{ fontSize: 12, color: active ? s.color : '#6B6358', fontWeight: active ? 600 : 400 }}>
                {s.id === 'all' ? 'Tous' : s.label}
              </span>
            </button>
          )
        })}
      </div>

      {/* Body */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', height: 'calc(100vh - 106px)' }}>

        {/* Sidebar liste */}
        <div style={{ width: 300, borderRight: '1px solid #E8E2D8', background: '#fff',
          display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
          <div style={{ padding: '10px 12px', borderBottom: '1px solid #E8E2D8' }}>
            <input
              placeholder="Rechercher…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ width: '100%', padding: '7px 10px', border: '1px solid #E8E2D8', borderRadius: 8,
                fontSize: 13, fontFamily: 'inherit', outline: 'none', background: '#FAF7F2' }}
            />
          </div>

          <div style={{ flex: 1, overflowY: 'auto' }}>
            {loading ? <Spinner /> : filtered.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center', color: '#6B6358', fontSize: 13 }}>
                {prospects.length === 0 ? 'Aucun prospect.\nCliquez sur + Prospect.' : 'Aucun résultat.'}
              </div>
            ) : (
              filtered.map(p => {
                const active = selId === p.id
                const s = STATUTS.find(x => x.id === p.statut) || STATUTS[0]
                return (
                  <button key={p.id} onClick={() => setSelId(p.id)}
                    style={{ width: '100%', textAlign: 'left', padding: '12px 14px',
                      border: 'none', borderBottom: '1px solid #F0ECE4',
                      background: active ? '#F0ECE4' : 'none', cursor: 'pointer',
                      fontFamily: 'inherit', display: 'block' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#1A1612' }}>{p.nom}</span>
                      <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 12,
                        color: s.color, background: s.bg }}>{s.label}</span>
                    </div>
                    {p.entreprise && <div style={{ fontSize: 12, color: '#6B6358' }}>{p.entreprise}</div>}
                    <div style={{ fontSize: 11, color: '#A8A09A', marginTop: 2 }}>
                      {[p.ville, p.secteur].filter(Boolean).join(' · ')}
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </div>

        {/* Panneau principal */}
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {selId ? (
            <ProspectDetail
              key={selId}
              prospectId={selId}
              onUpdate={handleProspectUpdated}
              onDelete={handleProspectDeleted}
            />
          ) : (
            <div style={{ flex: 1, display: 'grid', placeItems: 'center', color: '#6B6358' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>👥</div>
                <div style={{ fontSize: 15, fontWeight: 600, color: '#1A1612', marginBottom: 6 }}>Sélectionnez un prospect</div>
                <div style={{ fontSize: 13 }}>ou créez-en un nouveau avec le bouton + Prospect</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {addModal && (
        <ProspectModal onSave={handleProspectAdded} onClose={() => setAddModal(false)} />
      )}
    </div>
  )
}
