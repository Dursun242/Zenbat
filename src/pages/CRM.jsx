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

const DEFAULT_SUJET = 'Ce que vous faisiez en 2h, Zenbat le fait en 5 minutes'

function buildTemplate(prospect) {
  const prenom = (prospect.nom || '').split(' ')[0] || prospect.nom || ''
  const ville  = prospect.ville ? ` de ${prospect.ville}` : ' de votre région'
  const metier = prospect.secteur ? ` (${prospect.secteur.toLowerCase()})` : ''
  return `Bonjour ${prenom},

Je m'appelle Dursun. Maître d'œuvre basé au Havre, j'ai travaillé pendant des années aux côtés d'artisans et d'entreprises du bâtiment${ville}.

Et j'ai vu la même réalité partout : des professionnels excellents sur le chantier, mais qui perdaient un temps fou sur la paperasse — devis refaits à la main, factures en retard, relances oubliées, CA qui s'échappe.

Avec l'arrivée de l'IA, j'ai décidé de construire l'outil que j'aurais voulu leur donner bien plus tôt. **Zenbat**, c'est un logiciel de devis et facturation conçu pour que vous passiez moins de temps derrière un écran et plus de temps à faire ce qui vous rapporte vraiment.

Lancé début 2026, il compte déjà plus de 250 utilisateurs actifs — et je veux que les entreprises${ville} fassent partie des premiers à en bénéficier.

L'offre : **1 mois gratuit sans limite** — toutes les fonctionnalités débloquées, sans carte bancaire, sans engagement.

Répondez simplement à ce mail, je m'adapte à votre préférence.

À bientôt,
Dursun
Créateur de Zenbat · Le Havre`
}

const ZENBAT_LINK = `<a href="https://zenbat.vercel.app" style="color:#C97B5C;text-decoration:none;font-weight:700;">Zenbat</a>`

function linkifyZenbat(html) {
  return html.replace(/Zenbat/g, ZENBAT_LINK)
}

// Convertit le texte plat (paragraphes, • listes, **gras**) en blocs HTML email
function textToHtmlBlocks(text) {
  const paragraphs = text.split(/\n\n+/)
  return paragraphs.map(para => {
    const lines = para.split('\n')
    const isList = lines.every(l => l.trim().startsWith('•') || l.trim() === '')
    if (isList) {
      const items = lines.filter(l => l.trim().startsWith('•')).map(l => {
        const content = l.replace(/^•\s*/, '').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        return `<tr>
          <td style="padding:4px 0;vertical-align:top;color:#C97B5C;font-size:16px;padding-right:10px;">•</td>
          <td style="padding:4px 0;font-size:15px;color:#3D3832;line-height:1.65;">${content}</td>
        </tr>`
      }).join('')
      return `<table cellpadding="0" cellspacing="0" style="margin:0 0 4px 0;">${items}</table>`
    }
    const html = para.replace(/\*\*(.*?)\*\*/g, '<strong style="color:#1A1612;">$1</strong>')
    return `<p style="margin:0 0 18px 0;font-size:15px;color:#3D3832;line-height:1.75;">${html.replace(/\n/g, '<br>')}</p>`
  }).join('')
}

function buildHtmlEmail(prospect, textBody) {
  const bodyHtml = linkifyZenbat(textToHtmlBlocks(textBody))
  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Zenbat</title>
</head>
<body style="margin:0;padding:0;background:#F0ECE4;font-family:Inter,Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#F0ECE4;">
<tr><td align="center" style="padding:40px 16px;">

  <table width="600" cellpadding="0" cellspacing="0" role="presentation" style="max-width:600px;width:100%;">

    <!-- HEADER -->
    <tr><td style="background:#FAF7F2;border-radius:16px 16px 0 0;padding:22px 36px;border-bottom:1px solid #E8E2D8;">
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
        <tr>
          <td>
            <span style="font-family:Arial,Helvetica,sans-serif;font-size:26px;font-weight:800;color:#1A1612;letter-spacing:-1px;">Zen<span style="color:#C97B5C;">bat</span></span>
          </td>
          <td align="right" style="vertical-align:middle;">
            <span style="font-size:10px;color:#9A9088;letter-spacing:1px;text-transform:uppercase;font-weight:600;">Devis &amp; Facturation IA</span>
          </td>
        </tr>
      </table>
    </td></tr>

    <!-- SOCIAL PROOF BAND -->
    <tr><td style="background:#FAF7F2;padding:14px 36px;border-bottom:1px solid #E8E2D8;">
      <table cellpadding="0" cellspacing="0" role="presentation" style="margin:0 auto;">
        <tr>
          <td style="padding:0 20px;text-align:center;border-right:1px solid #E8E2D8;">
            <p style="margin:0;font-size:20px;font-weight:800;color:#C97B5C;">250+</p>
            <p style="margin:0;font-size:10px;color:#6B6358;letter-spacing:0.6px;text-transform:uppercase;">Utilisateurs actifs</p>
          </td>
          <td style="padding:0 20px;text-align:center;border-right:1px solid #E8E2D8;">
            <p style="margin:0;font-size:20px;font-weight:800;color:#1A1612;">T1 2026</p>
            <p style="margin:0;font-size:10px;color:#6B6358;letter-spacing:0.6px;text-transform:uppercase;">Lancé début 2026</p>
          </td>
          <td style="padding:0 20px;text-align:center;">
            <p style="margin:0;font-size:20px;font-weight:800;color:#1A1612;">🇫🇷</p>
            <p style="margin:0;font-size:10px;color:#6B6358;letter-spacing:0.6px;text-transform:uppercase;">100% français</p>
          </td>
        </tr>
      </table>
    </td></tr>

    <!-- HERO BAND -->
    <tr><td style="background:#C97B5C;padding:13px 36px;">
      <p style="margin:0;font-size:12px;color:#fff;font-weight:600;letter-spacing:0.8px;text-transform:uppercase;">
        🎁&nbsp; Offre Baie de Seine · 1 mois gratuit sans limite &nbsp;·&nbsp; Sans carte bancaire
      </p>
    </td></tr>

    <!-- BODY -->
    <tr><td style="background:#FFFCF7;padding:40px 36px 32px;">

      ${bodyHtml}

      <!-- FEATURES -->
      <table cellpadding="0" cellspacing="0" role="presentation" style="width:100%;margin:28px 0;border-radius:12px;overflow:hidden;border:1px solid #E8E2D8;">
        <tr><td style="background:#FAF7F2;padding:16px 20px;border-bottom:1px solid #E8E2D8;">
          <p style="margin:0;font-size:11px;font-weight:700;color:#6B6358;letter-spacing:1px;text-transform:uppercase;">En pratique, ${ZENBAT_LINK} c'est</p>
        </td></tr>
        ${[
          ['⚡', 'Devis en 2 minutes', "L'IA rédige les lignes à votre place. Vous parlez, elle structure."],
          ['✍️', 'Signature électronique', 'Votre client signe depuis son téléphone. Fini les allers-retours.'],
          ['📄', 'Facturation Factur-X', 'Conforme à la norme obligatoire B2B dès 2026. Déjà prêt.'],
          ['📊', 'Suivi en temps réel', "Devis acceptés, factures en attente, CA du mois — tout en un coup d'œil."],
        ].map(([icon, title, desc]) => `
        <tr><td style="padding:14px 20px;border-bottom:1px solid #F0ECE4;">
          <table cellpadding="0" cellspacing="0" role="presentation">
            <tr>
              <td style="font-size:22px;padding-right:14px;vertical-align:top;">${icon}</td>
              <td>
                <p style="margin:0 0 2px;font-size:14px;font-weight:700;color:#1A1612;">${title}</p>
                <p style="margin:0;font-size:13px;color:#6B6358;line-height:1.5;">${desc}</p>
              </td>
            </tr>
          </table>
        </td></tr>`).join('')}
      </table>

      <!-- 3 CTAs -->
      <table cellpadding="0" cellspacing="0" role="presentation" style="width:100%;margin:32px 0 8px;">
        <tr><td align="center" style="padding-bottom:10px;">
          <p style="margin:0 0 18px;font-size:14px;font-weight:600;color:#1A1612;">Trois façons de démarrer — c'est vous qui choisissez :</p>
        </td></tr>
        <tr><td align="center" style="padding-bottom:10px;">
          <a href="https://zenbat.vercel.app" style="display:inline-block;background:#C97B5C;color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;padding:14px 32px;border-radius:10px;width:280px;text-align:center;">
            🚀 Tester en autonomie →
          </a>
          <p style="margin:6px 0 0;font-size:11px;color:#9A9088;">1 mois gratuit sans limite · Sans carte bancaire</p>
        </td></tr>
        <tr><td align="center" style="padding-bottom:10px;">
          <a href="mailto:zenbat76@gmail.com?subject=Demande de démo Zenbat" style="display:inline-block;background:#1A1612;color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;padding:14px 32px;border-radius:10px;width:280px;text-align:center;">
            🎥 Demander une démo gratuite →
          </a>
          <p style="margin:6px 0 0;font-size:11px;color:#9A9088;">En visio · 20 minutes · Je montre tout en direct</p>
        </td></tr>
        <tr><td align="center">
          <a href="mailto:zenbat76@gmail.com?subject=RDV présentation Zenbat" style="display:inline-block;background:#FAF7F2;color:#1A1612;text-decoration:none;font-size:15px;font-weight:700;padding:14px 32px;border-radius:10px;border:1.5px solid #E8E2D8;width:280px;text-align:center;">
            📅 Prendre un rendez-vous →
          </a>
          <p style="margin:6px 0 0;font-size:11px;color:#9A9088;">Visio ou au Havre · Je m'adapte à votre agenda</p>
        </td></tr>
      </table>

    </td></tr>

    <!-- FOOTER -->
    <tr><td style="background:#F0ECE4;border-radius:0 0 16px 16px;padding:22px 36px;border-top:1px solid #E8E2D8;">
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
        <tr>
          <td>
            <p style="margin:0 0 4px;font-size:13px;font-weight:600;color:#3D3832;">Dursun — Créateur de ${ZENBAT_LINK}</p>
            <p style="margin:0;font-size:12px;color:#9A9088;">Le Havre &nbsp;·&nbsp; <a href="https://zenbat.vercel.app" style="color:#C97B5C;text-decoration:none;">zenbat.vercel.app</a></p>
          </td>
          <td align="right" style="vertical-align:top;">
            <table cellpadding="0" cellspacing="0" role="presentation">
              <tr>
                <td style="padding-right:6px;">
                  <div style="background:#1A1612;border-radius:4px;padding:4px 8px;">
                    <span style="font-size:11px;font-weight:800;color:#fff;">Z</span>
                  </div>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr><td colspan="2" style="padding-top:14px;">
          <p style="margin:0;font-size:11px;color:#B0A898;line-height:1.6;">
            Vous recevez cet email car vous avez été contacté personnellement par Dursun.<br>
            Pour ne plus recevoir de messages, répondez simplement « Non merci » à cet email.
          </p>
        </td></tr>
      </table>
    </td></tr>

  </table>
</td></tr>
</table>
</body>
</html>`
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
    google_business_url: prospect?.google_business_url || '',
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
            <label style={labelStyle}>Lien Google Business</label>
            <input style={inputStyle} value={form.google_business_url} onChange={set('google_business_url')}
              placeholder="https://maps.google.com/..." />
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
  const [data, setData]           = useState(null)
  const [tab, setTab]             = useState('emails') // 'emails' | 'composer'
  const [composerView, setComposerView] = useState('edit') // 'edit' | 'preview'
  const [loading, setLoading]     = useState(true)
  const [sujet, setSujet]         = useState('')
  const [corps, setCorps]         = useState('')
  const [sending, setSending]     = useState(false)
  const [sendErr, setSendErr]     = useState('')
  const [sendOk, setSendOk]       = useState(false)
  const [editModal, setEditModal] = useState(false)
  const iframeRef = useRef(null)

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
      const corps_html = buildHtmlEmail(data.prospect, corps)
      await api('POST', { action: 'send_email', id: prospectId, sujet, corps, corps_html })
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
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
              <a href={`mailto:${prospect.email}`} style={{ fontSize: 12, color: '#2563eb', textDecoration: 'none' }}>{prospect.email}</a>
              {prospect.telephone && <span style={{ fontSize: 12, color: '#6B6358' }}>{prospect.telephone}</span>}
              {prospect.ville && <span style={{ fontSize: 12, color: '#6B6358' }}>📍 {prospect.ville}</span>}
              {prospect.secteur && <span style={{ fontSize: 12, color: '#6B6358' }}>🔨 {prospect.secteur}</span>}
              {prospect.google_business_url && (
                <a href={prospect.google_business_url} target="_blank" rel="noopener noreferrer"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12,
                    color: '#fff', background: '#4285F4', padding: '3px 10px', borderRadius: 6,
                    textDecoration: 'none', fontWeight: 600 }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="white"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
                  Google Business
                </a>
              )}
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
          <div style={{ maxWidth: 700 }}>
            {sendOk && (
              <div style={{ background: '#dcfce7', border: '1px solid #86efac', borderRadius: 8,
                padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#16a34a' }}>
                ✓ Mail envoyé avec succès et enregistré dans l'historique.
              </div>
            )}

            {/* Objet */}
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

            {/* Sous-onglets Éditer / Prévisualiser */}
            <div style={{ display: 'flex', gap: 0, marginBottom: 12, border: '1px solid #E8E2D8', borderRadius: 8, overflow: 'hidden' }}>
              {[{ id: 'edit', label: '✏ Éditer' }, { id: 'preview', label: '👁 Prévisualiser' }].map(v => (
                <button key={v.id} onClick={() => setComposerView(v.id)}
                  style={{ flex: 1, padding: '8px 0', border: 'none', fontSize: 13,
                    background: composerView === v.id ? '#1A1612' : '#FAF7F2',
                    color: composerView === v.id ? '#fff' : '#6B6358',
                    fontWeight: composerView === v.id ? 600 : 400,
                    cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s' }}>
                  {v.label}
                </button>
              ))}
            </div>

            {/* Éditeur texte */}
            {composerView === 'edit' && (
              <div style={{ marginBottom: 16 }}>
                <textarea
                  value={corps}
                  onChange={e => setCorps(e.target.value)}
                  rows={22}
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid #E8E2D8', borderRadius: 8,
                    fontSize: 13, fontFamily: 'Inter, system-ui, monospace', lineHeight: 1.75, outline: 'none',
                    resize: 'vertical', boxSizing: 'border-box', background: '#FAF7F2' }}
                />
                <p style={{ fontSize: 11, color: '#A8A09A', marginTop: 4 }}>
                  Utilisez <code style={{ background: '#E8E2D8', padding: '1px 4px', borderRadius: 3 }}>**texte**</code> pour le gras,
                  &nbsp;<code style={{ background: '#E8E2D8', padding: '1px 4px', borderRadius: 3 }}>•</code> pour les listes.
                </p>
              </div>
            )}

            {/* Preview iframe de l'email HTML */}
            {composerView === 'preview' && (
              <div style={{ border: '1px solid #E8E2D8', borderRadius: 12, overflow: 'hidden', marginBottom: 16,
                boxShadow: '0 4px 20px rgba(0,0,0,0.07)' }}>
                <div style={{ background: '#F0ECE4', padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 6,
                  borderBottom: '1px solid #E8E2D8' }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#fecaca' }} />
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#fef9c3' }} />
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#dcfce7' }} />
                  <span style={{ fontSize: 11, color: '#9A9088', marginLeft: 6 }}>Aperçu email — tel que reçu par {prospect.nom}</span>
                </div>
                <iframe
                  ref={iframeRef}
                  style={{ width: '100%', height: 680, border: 'none', display: 'block' }}
                  title="preview"
                  srcDoc={buildHtmlEmail(prospect, corps)}
                  sandbox="allow-same-origin"
                />
              </div>
            )}

            {sendErr && <p style={{ color: '#dc2626', fontSize: 12, marginBottom: 12 }}>{sendErr}</p>}

            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <button onClick={handleSend} disabled={sending}
                style={{ padding: '11px 22px', border: 'none', borderRadius: 8, background: '#C97B5C',
                  color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                  opacity: sending ? 0.6 : 1, letterSpacing: '0.1px' }}>
                {sending ? 'Envoi en cours…' : `Envoyer à ${prospect.email} →`}
              </button>
              <button onClick={() => { setCorps(buildTemplate(prospect)); setComposerView('edit') }}
                style={{ padding: '11px 16px', border: '1px solid #E8E2D8', borderRadius: 8,
                  background: '#FAF7F2', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', color: '#6B6358' }}>
                Réinitialiser
              </button>
            </div>
            <p style={{ fontSize: 11, color: '#A8A09A', marginTop: 8 }}>
              Mail envoyé depuis Gmail · Apparaît dans Historique après envoi
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

// ── Panneau recherche Google Places ───────────────────────────────────────

function PlacesSearch({ existingEmails, onAdd, onClose }) {
  const [query, setQuery]       = useState('plombier Le Havre')
  const [results, setResults]   = useState([])
  const [loading, setLoading]   = useState(false)
  const [err, setErr]           = useState('')
  const [details, setDetails]   = useState({}) // place_id → détails
  const [loadingId, setLoadingId] = useState(null)
  const [addedIds, setAddedIds] = useState(new Set())

  const search = async () => {
    if (!query.trim()) return
    setLoading(true); setErr(''); setResults([])
    try {
      const d = await api('GET', { action: 'search_places', q: query.trim() })
      setResults(d.results || [])
      if (!d.results?.length) setErr('Aucun résultat. Essayez "électricien Rouen" ou "maçon Caen".')
    } catch (e) { setErr(e.message) }
    finally { setLoading(false) }
  }

  const fetchDetails = async (place_id) => {
    if (details[place_id]) return
    setLoadingId(place_id)
    try {
      const d = await api('GET', { action: 'place_details', place_id })
      setDetails(prev => ({ ...prev, [place_id]: d }))
    } catch {}
    finally { setLoadingId(null) }
  }

  const handleAdd = async (r) => {
    const det = details[r.place_id] || {}
    const prospect = {
      action: 'create',
      nom: r.nom,
      entreprise: r.nom,
      email: '',
      telephone: det.telephone || '',
      ville: r.ville,
      secteur: r.secteur || det.secteur || '',
      google_business_url: det.maps_url || r.maps_url,
      notes: r.adresse,
    }
    try {
      const data = await api('POST', prospect)
      onAdd(data.prospect)
      setAddedIds(prev => new Set([...prev, r.place_id]))
    } catch (e) { alert(e.message) }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', justifyContent: 'flex-end' }}>
      <div onClick={onClose} style={{ flex: 1, background: 'rgba(26,22,18,0.4)' }} />
      <div style={{ width: 480, background: '#fff', display: 'flex', flexDirection: 'column',
        boxShadow: '-8px 0 40px rgba(0,0,0,0.15)', overflowY: 'auto' }}>

        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #E8E2D8', background: '#1A1612',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>🔍 Recherche Google Maps</div>
            <div style={{ fontSize: 11, color: '#6B6358', marginTop: 2 }}>Trouvez des artisans et ajoutez-les en 1 clic</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#6B6358',
            fontSize: 22, cursor: 'pointer', lineHeight: 1 }}>×</button>
        </div>

        {/* Barre de recherche */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #E8E2D8', background: '#FAF7F2' }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && search()}
              placeholder="plombier Le Havre, électricien Rouen…"
              style={{ flex: 1, padding: '10px 12px', border: '1px solid #E8E2D8', borderRadius: 8,
                fontSize: 13, fontFamily: 'inherit', outline: 'none', background: '#fff' }}
            />
            <button onClick={search} disabled={loading}
              style={{ padding: '10px 16px', background: '#1A1612', color: '#fff', border: 'none',
                borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                opacity: loading ? 0.6 : 1, whiteSpace: 'nowrap' }}>
              {loading ? '…' : 'Chercher'}
            </button>
          </div>
          {err && <p style={{ fontSize: 12, color: '#dc2626', marginTop: 8 }}>{err}</p>}
          <p style={{ fontSize: 11, color: '#9A9088', marginTop: 6 }}>
            ⚠ Nécessite <code style={{ background: '#E8E2D8', padding: '1px 4px', borderRadius: 3 }}>GOOGLE_PLACES_API_KEY</code> dans Vercel
          </p>
        </div>

        {/* Résultats */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {results.length === 0 && !loading && (
            <div style={{ padding: 32, textAlign: 'center', color: '#9A9088', fontSize: 13 }}>
              Lancez une recherche pour trouver des prospects.
            </div>
          )}
          {results.map(r => {
            const det = details[r.place_id]
            const alreadyIn = existingEmails.has(r.nom?.toLowerCase()) || addedIds.has(r.place_id)
            return (
              <div key={r.place_id} style={{ padding: '14px 20px', borderBottom: '1px solid #F0ECE4',
                background: alreadyIn ? '#f0fdf4' : '#fff' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#1A1612', marginBottom: 2 }}>{r.nom}</div>
                    <div style={{ fontSize: 11, color: '#6B6358', marginBottom: 4, lineHeight: 1.4 }}>{r.adresse}</div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                      {r.secteur && <span style={{ fontSize: 10, background: '#F0ECE4', color: '#6B6358',
                        padding: '2px 6px', borderRadius: 10, fontWeight: 600 }}>{r.secteur}</span>}
                      {r.rating && <span style={{ fontSize: 11, color: '#d97706' }}>★ {r.rating} ({r.nb_avis})</span>}
                      {det?.telephone && <span style={{ fontSize: 11, color: '#6B6358' }}>📞 {det.telephone}</span>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
                    {alreadyIn ? (
                      <span style={{ fontSize: 11, color: '#16a34a', fontWeight: 600 }}>✓ Ajouté</span>
                    ) : (
                      <button onClick={() => handleAdd(r)}
                        style={{ padding: '6px 12px', background: '#C97B5C', color: '#fff', border: 'none',
                          borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                        + Ajouter
                      </button>
                    )}
                    {!det && !alreadyIn && (
                      <button onClick={() => fetchDetails(r.place_id)} disabled={loadingId === r.place_id}
                        style={{ padding: '5px 10px', background: 'none', border: '1px solid #E8E2D8',
                          borderRadius: 6, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', color: '#6B6358' }}>
                        {loadingId === r.place_id ? '…' : 'Détails'}
                      </button>
                    )}
                    <a href={r.maps_url} target="_blank" rel="noopener noreferrer"
                      style={{ fontSize: 10, color: '#4285F4', textDecoration: 'none', textAlign: 'center' }}>
                      Maps ↗
                    </a>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default function CRM() {
  const [authState, setAuthState]   = useState('loading') // 'loading' | 'ok' | 'denied'
  const [prospects, setProspects]   = useState([])
  const [selId, setSelId]           = useState(null)
  const [loading, setLoading]       = useState(true)
  const [filterStatut, setFilter]   = useState('all')
  const [search, setSearch]         = useState('')
  const [addModal, setAddModal]     = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)

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
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setSearchOpen(true)}
            style={{ padding: '7px 14px', background: '#4285F4', border: 'none', borderRadius: 8,
              color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
            🔍 Google Maps
          </button>
          <button onClick={() => setAddModal(true)}
            style={{ padding: '7px 14px', background: '#22c55e', border: 'none', borderRadius: 8,
              color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
            + Prospect
          </button>
        </div>
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

      {searchOpen && (
        <PlacesSearch
          existingEmails={new Set(prospects.map(p => p.nom?.toLowerCase()))}
          onAdd={p => { setProspects(prev => [p, ...prev]); setSelId(p.id) }}
          onClose={() => setSearchOpen(false)}
        />
      )}
    </div>
  )
}
