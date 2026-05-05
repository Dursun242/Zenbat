// Endpoints RGPD + envoi comptable en libre-service — routage par méthode HTTP :
//   GET  /api/account                            → export portabilité (art. 20)
//   POST /api/account  {action:'send-comptable'} → envoi CSV factures au comptable
//   POST /api/account  (sans action)             → suppression de compte (art. 17)

import { cors } from "./_cors.js"
import { authenticate, notifyTelegram } from "./_withAuth.js"

export default async function handler(req, res) {
  cors(req, res, { methods: "GET, POST, OPTIONS" })
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'GET' && req.method !== 'POST')
    return res.status(405).json({ error: 'Method not allowed' })

  const auth = await authenticate(req, res)
  if (!auth) return
  const { user, admin } = auth

  // Routage POST par champ action (suppression = pas d'action pour rétrocompat)
  if (req.method === 'POST' && req.body?.action === 'send-comptable') {
    return handleSendComptable({ req, res, user, admin })
  }

  // ── GET : export portabilité ─────────────────────────────────────────
  if (req.method === 'GET') {
    const owner_id = user.id

    const [
      profileR,
      clientsR,
      devisR,
      lignesDevisR,
      invoicesR,
      lignesInvoicesR,
      iaConvR,
      iaErrR,
      iaNegR,
      activityR,
    ] = await Promise.all([
      admin.from('profiles').select('*').eq('id', owner_id).maybeSingle(),
      admin.from('clients').select('*').eq('owner_id', owner_id),
      admin.from('devis').select('*').eq('owner_id', owner_id),
      admin.from('lignes_devis').select('*').eq('owner_id', owner_id),
      admin.from('invoices').select('*').eq('owner_id', owner_id),
      admin.from('lignes_invoices').select('*').eq('owner_id', owner_id),
      admin.from('ia_conversations').select('*').eq('owner_id', owner_id),
      admin.from('ia_error_logs').select('*').eq('owner_id', owner_id),
      admin.from('ia_negative_logs').select('*').eq('owner_id', owner_id),
      admin.from('activity_log').select('*').eq('owner_id', owner_id).order('created_at', { ascending: false }).limit(5000),
    ])

    let pdfFiles = []
    try {
      const { data: files } = await admin.storage.from('devis-pdfs').list(owner_id, { limit: 1000 })
      pdfFiles = (files || []).map(f => ({ name: f.name, size: f.metadata?.size, updated_at: f.updated_at }))
    } catch (e) {
      console.warn('[account/export] pdf list:', e?.message)
    }

    const archive = {
      rgpd: {
        regulation:       "Règlement (UE) 2016/679 (RGPD), articles 15 (accès) et 20 (portabilité)",
        generated_at:     new Date().toISOString(),
        generated_for:    { id: user.id, email: user.email, created_at: user.created_at },
        retention_notice: "Les factures émises sont conservées 10 ans côté Zenbat (LPF art. L102 B) même après suppression de votre compte. Cette archive constitue votre copie personnelle.",
        help:             "Pour toute question : Zenbat76@gmail.com",
      },
      profile:          profileR.data || null,
      clients:          clientsR.data || [],
      devis:            devisR.data || [],
      lignes_devis:     lignesDevisR.data || [],
      invoices:         invoicesR.data || [],
      lignes_invoices:  lignesInvoicesR.data || [],
      ia_conversations: iaConvR.data || [],
      ia_error_logs:    iaErrR.data || [],
      ia_negative_logs: iaNegR.data || [],
      activity_log:     activityR.data || [],
      pdf_files:        pdfFiles,
    }

    const filename = `zenbat-export-${owner_id}-${new Date().toISOString().slice(0,10)}.json`
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    return res.status(200).send(JSON.stringify(archive, null, 2))
  }

  // ── POST : suppression de compte ─────────────────────────────────────
  try {
    const { confirmEmail } = req.body || {}
    if (!confirmEmail || typeof confirmEmail !== 'string')
      return res.status(400).json({ error: "Confirmation par email obligatoire" })
    if (confirmEmail.trim().toLowerCase() !== (user.email || '').toLowerCase())
      return res.status(400).json({ error: "L'email de confirmation ne correspond pas à votre compte" })

    const adminEmail = process.env.ADMIN_EMAIL
    if (adminEmail && (user.email || '').toLowerCase() === adminEmail.toLowerCase())
      return res.status(400).json({
        error: "Le compte administrateur ne peut pas être supprimé en libre-service. Contactez l'équipe Zenbat.",
      })

    const purgeTables = ['ia_conversations', 'ia_error_logs', 'ia_negative_logs', 'activity_log']
    for (const t of purgeTables) {
      try {
        await admin.from(t).delete().eq('owner_id', user.id)
      } catch (e) {
        console.warn(`[account/delete] purge ${t}:`, e?.message)
      }
    }

    try {
      const { data: files } = await admin.storage.from('devis-pdfs').list(user.id, { limit: 1000 })
      if (files?.length) {
        const paths = files.map(f => `${user.id}/${f.name}`)
        await admin.storage.from('devis-pdfs').remove(paths)
      }
    } catch (e) {
      console.warn('[account/delete] storage cleanup:', e?.message)
    }

    // Récupère le plan avant suppression pour la notif
    const { data: planRow } = await admin.from('profiles').select('plan').eq('id', user.id).maybeSingle()

    const { error: delErr } = await admin.auth.admin.deleteUser(user.id)
    if (delErr) {
      console.error('[account/delete] deleteUser failed:', delErr)
      return res.status(500).json({
        error: delErr.message || 'Échec suppression compte',
        code:  delErr.code || delErr.status || null,
      })
    }

    await notifyTelegram('account_deleted', {
      email: user.email || null,
      plan:  planRow?.plan || null,
      by:    'self',
    })

    return res.status(200).json({ ok: true, deleted_at: new Date().toISOString() })
  } catch (err) {
    console.error('[account/delete] unhandled:', err)
    return res.status(500).json({ error: err?.message || String(err) || 'Erreur interne inconnue' })
  }
}

// ═══════════════════════════════════════════════════════════════════
// Envoi de l'export factures au comptable
//
// Body : { action:'send-comptable', period:'last_month'|'this_month'|'this_quarter'|'this_year'|'all'|'custom', from?, to?, email? }
// - email : si fourni, met à jour profiles.comptable_email avant envoi
// - Génère 2 CSV (factures + lignes) pour la période, attache à un email Resend
// ═══════════════════════════════════════════════════════════════════

function csvEscape(v) {
  if (v == null) return ''
  const s = String(v)
  if (/[",\n;]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

function toCsv(rows, columns) {
  const header = columns.map(c => csvEscape(c.label)).join(';')
  const body   = rows.map(r => columns.map(c => csvEscape(c.get(r))).join(';')).join('\n')
  return '﻿' + header + '\n' + body  // BOM UTF-8 pour Excel FR
}

function periodRange(period, from, to) {
  const now = new Date()
  const y   = now.getFullYear()
  const m   = now.getMonth()
  if (period === 'this_month') {
    return { from: new Date(y, m, 1), to: new Date(y, m + 1, 0, 23, 59, 59) }
  }
  if (period === 'last_month') {
    return { from: new Date(y, m - 1, 1), to: new Date(y, m, 0, 23, 59, 59) }
  }
  if (period === 'this_quarter') {
    const q = Math.floor(m / 3)
    return { from: new Date(y, q * 3, 1), to: new Date(y, q * 3 + 3, 0, 23, 59, 59) }
  }
  if (period === 'this_year') {
    return { from: new Date(y, 0, 1), to: new Date(y, 11, 31, 23, 59, 59) }
  }
  if (period === 'custom' && from && to) {
    return { from: new Date(from), to: new Date(`${to}T23:59:59`) }
  }
  // 'all' ou inconnu : pas de filtre
  return { from: null, to: null }
}

function periodLabel(period, from, to) {
  const fr = (d) => new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
  switch (period) {
    case 'this_month':   return 'mois en cours'
    case 'last_month':   return 'mois dernier'
    case 'this_quarter': return 'trimestre en cours'
    case 'this_year':    return 'année en cours'
    case 'custom':       return from && to ? `du ${fr(from)} au ${fr(to)}` : 'période personnalisée'
    case 'all':
    default:             return 'historique complet'
  }
}

async function sendViaResend({ to, subject, html, attachments }) {
  const key = process.env.RESEND_API_KEY
  if (!key) throw new Error('RESEND_API_KEY non configuré')
  const from = process.env.RESEND_FROM || 'Zenbat <onboarding@resend.dev>'
  const payload = { from, to, subject, html }
  if (attachments?.length) payload.attachments = attachments
  const r = await fetch('https://api.resend.com/emails', {
    method:  'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body:    JSON.stringify(payload),
  })
  if (!r.ok) {
    const e = await r.json().catch(() => ({}))
    throw new Error(e.message || `Resend ${r.status}`)
  }
}

async function handleSendComptable({ req, res, user, admin }) {
  try {
    const { period = 'last_month', from, to, email: bodyEmail } = req.body || {}

    // Récupère/met à jour l'email comptable
    const { data: profile } = await admin.from('profiles')
      .select('comptable_email, full_name, company_name')
      .eq('id', user.id).maybeSingle()

    let comptableEmail = (bodyEmail || profile?.comptable_email || '').trim()
    if (!comptableEmail || !/^\S+@\S+\.\S+$/.test(comptableEmail)) {
      return res.status(400).json({ error: 'Email du comptable invalide' })
    }

    if (bodyEmail && bodyEmail.trim() !== profile?.comptable_email) {
      await admin.from('profiles').update({ comptable_email: comptableEmail }).eq('id', user.id)
    }

    // Période → filtres
    const { from: dFrom, to: dTo } = periodRange(period, from, to)

    // Factures + clients + lignes en parallèle
    let invoicesQ = admin.from('invoices').select('*').eq('owner_id', user.id)
    if (dFrom) invoicesQ = invoicesQ.gte('date_emission', dFrom.toISOString().slice(0, 10))
    if (dTo)   invoicesQ = invoicesQ.lte('date_emission', dTo.toISOString().slice(0, 10))

    const [{ data: invoices = [] }, { data: clients = [] }] = await Promise.all([
      invoicesQ.order('date_emission', { ascending: true }),
      admin.from('clients').select('id, raison_sociale, siret, tva_intra, email').eq('owner_id', user.id),
    ])

    if (!invoices.length) {
      return res.status(400).json({ error: `Aucune facture trouvée sur la période (${periodLabel(period, from, to)}).` })
    }

    const invoiceIds = invoices.map(i => i.id)
    const { data: lignes = [] } = await admin.from('lignes_invoices')
      .select('*').in('invoice_id', invoiceIds)

    // Index clients pour join lisible
    const clientById = new Map(clients.map(c => [c.id, c]))

    // CSV factures
    const csvFactures = toCsv(invoices, [
      { label: 'Numero',       get: i => i.numero },
      { label: 'Date',         get: i => i.date_emission },
      { label: 'Echeance',     get: i => i.date_echeance || '' },
      { label: 'Client',       get: i => clientById.get(i.client_id)?.raison_sociale || '' },
      { label: 'SIRET',        get: i => clientById.get(i.client_id)?.siret || '' },
      { label: 'TVA intra',    get: i => clientById.get(i.client_id)?.tva_intra || '' },
      { label: 'Objet',        get: i => i.objet || '' },
      { label: 'Type',         get: i => i.invoice_type || (i.operation_type === 'service' ? 'service' : 'vente') },
      { label: 'Statut',       get: i => i.statut },
      { label: 'Montant HT',   get: i => Number(i.montant_ht  || 0).toFixed(2) },
      { label: 'TVA',          get: i => Number(i.montant_tva || 0).toFixed(2) },
      { label: 'Montant TTC',  get: i => Number(i.montant_ttc || 0).toFixed(2) },
      { label: 'Retenue',      get: i => Number(i.retenue_garantie_eur || 0).toFixed(2) },
    ])

    // CSV lignes (détail)
    const invById = new Map(invoices.map(i => [i.id, i]))
    const csvLignes = toCsv(lignes, [
      { label: 'Facture',      get: l => invById.get(l.invoice_id)?.numero || '' },
      { label: 'Date facture', get: l => invById.get(l.invoice_id)?.date_emission || '' },
      { label: 'Type ligne',   get: l => l.type_ligne },
      { label: 'Lot',          get: l => l.lot || '' },
      { label: 'Designation',  get: l => l.designation },
      { label: 'Unite',        get: l => l.unite || '' },
      { label: 'Quantite',     get: l => Number(l.quantite || 0) },
      { label: 'PU HT',        get: l => Number(l.prix_unitaire || 0).toFixed(2) },
      { label: 'TVA %',        get: l => Number(l.tva_rate || 0) },
    ])

    const totalHT  = invoices.reduce((s, i) => s + Number(i.montant_ht  || 0), 0)
    const totalTVA = invoices.reduce((s, i) => s + Number(i.montant_tva || 0), 0)
    const totalTTC = invoices.reduce((s, i) => s + Number(i.montant_ttc || 0), 0)

    const periodTxt = periodLabel(period, from, to)
    const dateTag   = new Date().toISOString().slice(0, 10)
    const slug      = (profile?.company_name || profile?.full_name || 'zenbat')
      .toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30)

    const fmtEur = n => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n)

    const html = `
<!doctype html><html><body style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#1A1612;line-height:1.5;max-width:560px;margin:0 auto;padding:24px">
  <h2 style="margin:0 0 16px;font-size:20px;color:#1A1612">Export comptable Zenbat</h2>
  <p>Bonjour,</p>
  <p>Voici l'export des factures de <strong>${profile?.company_name || profile?.full_name || user.email}</strong> sur la période <strong>${periodTxt}</strong>.</p>
  <table style="width:100%;border-collapse:collapse;margin:16px 0;background:#FAF7F2;border-radius:8px;overflow:hidden">
    <tr><td style="padding:10px 14px;color:#6B6358">Nombre de factures</td><td style="padding:10px 14px;text-align:right;font-weight:600">${invoices.length}</td></tr>
    <tr><td style="padding:10px 14px;color:#6B6358;border-top:1px solid #E8E2D8">Total HT</td><td style="padding:10px 14px;text-align:right;font-weight:600;border-top:1px solid #E8E2D8">${fmtEur(totalHT)}</td></tr>
    <tr><td style="padding:10px 14px;color:#6B6358;border-top:1px solid #E8E2D8">TVA collectée</td><td style="padding:10px 14px;text-align:right;font-weight:600;border-top:1px solid #E8E2D8">${fmtEur(totalTVA)}</td></tr>
    <tr><td style="padding:10px 14px;color:#6B6358;border-top:1px solid #E8E2D8">Total TTC</td><td style="padding:10px 14px;text-align:right;font-weight:700;border-top:1px solid #E8E2D8">${fmtEur(totalTTC)}</td></tr>
  </table>
  <p>Deux fichiers CSV en pièce jointe :</p>
  <ul>
    <li><strong>factures.csv</strong> — une ligne par facture (avec client, montants HT/TVA/TTC)</li>
    <li><strong>lignes.csv</strong> — détail des lignes pour chaque facture</li>
  </ul>
  <p style="color:#6B6358;font-size:13px;margin-top:24px">Encodage UTF-8 avec BOM, séparateur point-virgule (compatible Excel France).</p>
  <hr style="border:none;border-top:1px solid #E8E2D8;margin:24px 0"/>
  <p style="color:#9A8E82;font-size:12px">Envoyé depuis Zenbat — l'assistant commercial vocal des artisans.<br/>Pour répondre, écrivez directement à ${user.email}.</p>
</body></html>`.trim()

    await sendViaResend({
      to:      comptableEmail,
      subject: `Export factures ${profile?.company_name || profile?.full_name || ''} — ${periodTxt}`.trim(),
      html,
      attachments: [
        { filename: `factures-${slug}-${dateTag}.csv`, content: Buffer.from(csvFactures, 'utf-8').toString('base64') },
        { filename: `lignes-${slug}-${dateTag}.csv`,   content: Buffer.from(csvLignes,   'utf-8').toString('base64') },
      ],
    })

    notifyTelegram('comptable_export', {
      email:        user.email,
      comptable:    comptableEmail,
      period:       periodTxt,
      count:        invoices.length,
      total_ttc:    Number(totalTTC.toFixed(2)),
    }).catch(() => {})

    return res.status(200).json({
      ok: true,
      sent_to: comptableEmail,
      count:   invoices.length,
      total_ht:  Number(totalHT.toFixed(2)),
      total_tva: Number(totalTVA.toFixed(2)),
      total_ttc: Number(totalTTC.toFixed(2)),
    })
  } catch (err) {
    console.error('[account/send-comptable] unhandled:', err)
    return res.status(500).json({ error: err?.message || 'Erreur envoi comptable' })
  }
}
