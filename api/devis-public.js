// Page publique client — accès devis sans authentification Supabase
// GET  ?token=xxx                 → aperçu (avant OTP) ou données complètes (après OTP)
// POST {action:'send'}            → artisan envoie le devis par email (auth JWT requise)
// POST {action:'request_otp'}     → envoie code 6 chiffres à l'email du client
// POST {action:'verify_otp'}      → vérifie le code, ouvre la session 24h
// POST {action:'accept'}          → client accepte (session OTP requise)
// POST {action:'refuse'}          → client refuse avec raison (session OTP requise)
// POST {action:'negotiate'}       → client soumet proposition de modification
// POST {action:'artisan_respond'} → artisan répond à une négo (auth JWT requise)

import { cors }         from './_cors.js'
import { authenticate } from './_withAuth.js'
import { createHash }   from 'crypto'
import { createClient } from '@supabase/supabase-js'

function makeAdmin() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

const hashStr = s => createHash('sha256').update(String(s)).digest('hex')
const genOtp  = () => Math.floor(100000 + Math.random() * 900000).toString()
const fmtEur  = n => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n || 0)

async function sendEmail({ to, subject, html, cc, fromName }) {
  const gmailUser = process.env.GMAIL_USER
  const gmailPass = process.env.GMAIL_APP_PASSWORD || process.env.GMAIL_APP_PASWORD
  const displayName = fromName || 'Consulter votre devis'

  if (gmailUser && gmailPass) {
    const { createTransport } = await import('nodemailer')
    const transporter = createTransport({
      host: 'smtp.gmail.com', port: 587, secure: false,
      auth: { user: gmailUser, pass: gmailPass },
    })
    await transporter.sendMail({
      from: `${displayName} <${gmailUser}>`,
      to, subject, html,
      ...(cc ? { cc: Array.isArray(cc) ? cc.join(',') : cc } : {}),
    })
    return
  }

  const key = process.env.RESEND_API_KEY
  if (!key) throw new Error('Aucun service email configuré (GMAIL_USER+GMAIL_APP_PASSWORD ou RESEND_API_KEY)')
  const payload = { from: process.env.RESEND_FROM || `${displayName} <onboarding@resend.dev>`, to, subject, html }
  if (cc) payload.cc = Array.isArray(cc) ? cc : [cc]
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const e = await res.json().catch(() => ({}))
    throw new Error(e.message || `Resend ${res.status}`)
  }
}

async function notifyTg(kind, payload) {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return
  fetch(`${url}/functions/v1/notify-telegram`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({ kind, payload }),
  }).catch(() => {})
}

async function verifySession(admin, publicToken, sessionId) {
  if (!sessionId || !publicToken) return null
  const { data } = await admin.from('devis_otp_sessions')
    .select('id, email_hash')
    .eq('id', sessionId)
    .eq('public_token', publicToken)
    .not('verified_at', 'is', null)
    .gte('expires_at', new Date().toISOString())
    .maybeSingle()
  return data || null
}

// ── Templates email ────────────────────────────────────────────────────────
function emailDevis({ clientName, company, brand, devis, fmtEurFn, publicUrl }) {
  const accent = brand?.color || '#22c55e'
  const logo   = brand?.logo  || null
  const date   = devis.date_validite
    ? new Date(devis.date_validite).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
    : null

  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f0f0f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f0f0;padding:40px 16px">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%">

  <!-- Barre de marque -->
  <tr><td style="background:${accent};height:4px;border-radius:4px 4px 0 0;font-size:0">&nbsp;</td></tr>

  <!-- Corps principal -->
  <tr><td style="background:#ffffff;padding:40px 48px 32px;border-radius:0 0 4px 4px">

    <!-- Logo / Nom entreprise -->
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:36px">
      <tr>
        <td>
          ${logo
            ? `<img src="${logo}" alt="${company || ''}" style="max-height:40px;max-width:160px;object-fit:contain;display:block">`
            : company
              ? `<span style="font-size:16px;font-weight:700;color:#111;letter-spacing:-0.3px">${company}</span>`
              : ''}
        </td>
        <td align="right" style="font-size:11px;color:#999;font-weight:500;letter-spacing:0.5px;text-transform:uppercase;white-space:nowrap">Devis</td>
      </tr>
    </table>

    <!-- Accroche -->
    <p style="margin:0 0 6px;font-size:22px;font-weight:700;color:#111;line-height:1.3">
      Bonjour${clientName ? ' ' + clientName : ''},
    </p>
    <p style="margin:0 0 32px;font-size:15px;color:#555;line-height:1.6">
      ${company ? company + ' vous ' : 'Vous '}a préparé un devis${devis.objet ? ` pour&nbsp;<strong style="color:#111">${devis.objet}</strong>` : ''}.<br>
      Consultez-le, posez vos questions ou acceptez-le en ligne.
    </p>

    <!-- Carte devis -->
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e8e8e8;border-radius:8px;margin-bottom:28px;overflow:hidden">
      <tr>
        <td style="padding:20px 24px;border-bottom:1px solid #e8e8e8">
          <p style="margin:0 0 2px;font-size:11px;color:#999;font-weight:500;text-transform:uppercase;letter-spacing:0.5px">Référence</p>
          <p style="margin:0;font-size:15px;font-weight:700;color:#111">${devis.numero}</p>
        </td>
        <td style="padding:20px 24px;border-bottom:1px solid #e8e8e8;text-align:right">
          <p style="margin:0 0 2px;font-size:11px;color:#999;font-weight:500;text-transform:uppercase;letter-spacing:0.5px">Montant HT</p>
          <p style="margin:0;font-size:22px;font-weight:800;color:#111;letter-spacing:-0.5px">${fmtEurFn(devis.montant_ht)}</p>
        </td>
      </tr>
      ${date ? `<tr><td colspan="2" style="padding:14px 24px;background:#fafafa">
        <p style="margin:0;font-size:12px;color:#888">Valable jusqu'au <strong style="color:#555">${date}</strong></p>
      </td></tr>` : ''}
    </table>

    <!-- CTA -->
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:32px">
      <tr>
        <td align="center">
          <a href="${publicUrl}" style="display:inline-block;background:${accent};color:#fff;text-decoration:none;padding:14px 36px;border-radius:6px;font-size:15px;font-weight:700;letter-spacing:-0.2px">
            Voir mon devis &rarr;
          </a>
        </td>
      </tr>
    </table>

    <!-- Contact -->
    ${brand?.phone || brand?.email ? `
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr><td style="border-top:1px solid #f0f0f0;padding-top:24px">
        <p style="margin:0;font-size:13px;color:#888">Une question ? Contactez-nous directement&nbsp;:
          ${brand.phone ? `<br><strong style="color:#555">${brand.phone}</strong>` : ''}
          ${brand.email ? `<br><a href="mailto:${brand.email}" style="color:${accent};text-decoration:none">${brand.email}</a>` : ''}
        </p>
      </td></tr>
    </table>` : ''}

  </td></tr>

  <!-- Footer -->
  <tr><td style="padding:20px 0;text-align:center;font-size:11px;color:#bbb;line-height:1.6">
    Ce lien est personnel — ne le partagez pas<br>
    <span style="color:#ddd">·</span> Zenbat, logiciel de devis pour artisans
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`
}

function emailOtp({ otp, devis }) {
  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f5f5f5;font-family:Inter,system-ui,sans-serif">
<div style="max-width:480px;margin:32px auto;background:white;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08)">
  <div style="background:#1A1612;padding:24px 32px;text-align:center">
    <div style="font-size:22px;font-weight:800;letter-spacing:-1px"><span style="color:#22c55e">Zen</span><span style="color:white">bat</span></div>
  </div>
  <div style="padding:32px;text-align:center">
    <p style="color:#6B6358;font-size:14px;margin:0 0 24px">Code d'accès pour le devis <strong>${devis.numero}</strong></p>
    <div style="background:#FAF7F2;border-radius:16px;padding:28px;margin-bottom:24px;letter-spacing:12px;font-size:38px;font-weight:800;color:#1A1612;font-family:monospace">${otp}</div>
    <p style="color:#9A8E82;font-size:12px;margin:0">Ce code expire dans <strong>15 minutes</strong>.<br>Si vous n'avez pas demandé ce code, ignorez cet email.</p>
  </div>
</div></body></html>`
}

function emailClientConfirm({ devis, clientName, newHt }) {
  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f5f5f5;font-family:Inter,system-ui,sans-serif">
<div style="max-width:480px;margin:32px auto;background:white;border-radius:16px;overflow:hidden">
  <div style="background:#22c55e;padding:24px 32px;text-align:center">
    <div style="font-size:32px">✅</div>
    <div style="color:white;font-size:18px;font-weight:700;margin-top:8px">Devis accepté</div>
  </div>
  <div style="padding:32px">
    <p style="color:#1A1612;font-size:14px">Bonjour${clientName ? ' ' + clientName : ''},</p>
    <p style="color:#6B6358;font-size:14px;line-height:1.6">Le devis <strong>${devis.numero}</strong>${newHt ? ` (${fmtEur(newHt)} HT)` : ''} a bien été accepté avec vos modifications. L'artisan prendra contact avec vous pour la suite.</p>
  </div>
</div></body></html>`
}

function emailArtisanMsg({ devis, message }) {
  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f5f5f5;font-family:Inter,system-ui,sans-serif">
<div style="max-width:480px;margin:32px auto;background:white;border-radius:16px;overflow:hidden">
  <div style="background:#1A1612;padding:24px 32px"><div style="font-size:20px;font-weight:800"><span style="color:#22c55e">Zen</span><span style="color:white">bat</span></div></div>
  <div style="padding:32px">
    <p style="color:#6B6358;font-size:14px">Concernant le devis <strong>${devis.numero}</strong>, voici la réponse de l'artisan&nbsp;:</p>
    <div style="background:#FAF7F2;border-radius:12px;padding:16px;font-size:14px;color:#1A1612;white-space:pre-wrap">${message}</div>
  </div>
</div></body></html>`
}

// ── Handler principal ──────────────────────────────────────────────────────
export default async function handler(req, res) {
  cors(req, res, { methods: 'GET, POST, OPTIONS' })
  if (req.method === 'OPTIONS') return res.status(204).end()

  const admin = makeAdmin()
  if (!admin) return res.status(500).json({ error: 'Supabase non configuré' })

  // ── GET : données publiques ─────────────────────────────────────────────
  if (req.method === 'GET') {
    const { token, session_id } = req.query
    if (!token) return res.status(400).json({ error: 'token manquant' })

    const { data: devis, error: de } = await admin.from('devis')
      .select('id, numero, objet, montant_ht, statut, date_emission, date_validite, public_token, client_id, owner_id, client_accepted_at, client_refused_at, client_refusal_reason, lignes:lignes_devis(*)')
      .eq('public_token', token)
      .maybeSingle()
    if (de || !devis) return res.status(404).json({ error: 'Devis introuvable' })

    const { data: profile } = await admin.from('profiles')
      .select('company_name, full_name, brand_data').eq('id', devis.owner_id).maybeSingle()
    const brand = (() => { try { return JSON.parse(profile?.brand_data || '{}') } catch { return {} } })()

    const artisan = {
      company: profile?.company_name || brand.companyName || '',
      email:   brand.email  || '',
      phone:   brand.phone  || '',
      address: brand.address || '',
    }

    const { data: client } = await admin.from('clients')
      .select('raison_sociale, nom, prenom, email').eq('id', devis.client_id).maybeSingle()

    const emailHint = client?.email
      ? client.email.replace(/^([\w.]{1,3})(.*)@/, (_, s) => s.length ? s + '***@' : s + '@')
      : null

    const session = session_id ? await verifySession(admin, token, session_id) : null

    const preview = {
      numero:    devis.numero,
      objet:     devis.objet,
      montant_ht:  devis.montant_ht,
      statut:    devis.statut,
      date_emission: devis.date_emission,
      date_validite: devis.date_validite,
      artisan,
      emailHint,
      verified:  !!session,
      client_accepted_at:   devis.client_accepted_at,
      client_refused_at:    devis.client_refused_at,
      client_refusal_reason: devis.client_refusal_reason,
    }
    if (!session) return res.status(200).json(preview)

    const { data: docs } = await admin.from('devis_documents')
      .select('id, name, category, storage_path, size_bytes')
      .or(`devis_id.eq.${devis.id},and(owner_id.eq.${devis.owner_id},devis_id.is.null)`)
      .order('created_at')

    const { data: auditLog } = await admin.from('devis_audit_log')
      .select('event, from_party, meta, created_at')
      .eq('devis_id', devis.id).order('created_at')

    const { data: negotiation } = await admin.from('devis_negotiations')
      .select('*').eq('devis_id', devis.id).eq('status', 'pending')
      .order('created_at', { ascending: false }).limit(1).maybeSingle()

    return res.status(200).json({
      ...preview,
      lignes:    (devis.lignes || []).sort((a, b) => (a.position || 0) - (b.position || 0)),
      client:    { name: (`${client?.prenom || ''} ${client?.nom || ''}`).trim() || client?.raison_sociale || '', email: client?.email },
      docs:      docs || [],
      auditLog:  auditLog || [],
      negotiation,
    })
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const body = req.body || {}
  const { action } = body

  // ── send : artisan envoie le devis (auth requise, pas besoin de public_token côté client) ──
  if (action === 'send') {
    const auth = await authenticate(req, res)
    if (!auth) return
    const { user } = auth

    const { devis_id } = body
    if (!devis_id) return res.status(400).json({ error: 'devis_id manquant' })

    const { data: devis } = await admin.from('devis')
      .select('id, numero, objet, montant_ht, public_token, client_id, owner_id, statut')
      .eq('id', devis_id).eq('owner_id', user.id).maybeSingle()
    if (!devis) return res.status(404).json({ error: 'Devis introuvable' })

    // Génère un public_token si absent (devis créé avant migration)
    let publicToken = devis.public_token
    if (!publicToken) {
      const { randomUUID } = await import('crypto')
      publicToken = randomUUID()
      await admin.from('devis').update({ public_token: publicToken }).eq('id', devis.id)
    }

    const { data: client } = await admin.from('clients')
      .select('raison_sociale, nom, prenom, email').eq('id', devis.client_id).maybeSingle()
    if (!client?.email) return res.status(400).json({ error: "Le client n'a pas d'email renseigné" })

    const { data: profile } = await admin.from('profiles')
      .select('company_name, brand_data').eq('id', user.id).maybeSingle()
    const brand = (() => { try { return JSON.parse(profile?.brand_data || '{}') } catch { return {} } })()
    const company    = profile?.company_name || brand.companyName || ''
    const clientName = (`${client.prenom || ''} ${client.nom || ''}`).trim() || client.raison_sociale || ''
    const publicUrl  = `${process.env.VITE_PUBLIC_URL || 'https://zenbat.vercel.app'}/d/${publicToken}`

    const ccEmails = [...new Set([user.email, brand.email].filter(Boolean))]
    try {
      await sendEmail({
        to: client.email,
        cc: ccEmails.length ? ccEmails : undefined,
        fromName: 'Consulter votre devis',
        subject: `Consulter votre devis${devis.objet ? ' — ' + devis.objet : ' ' + devis.numero}${company ? ' · ' + company : ''}`,
        html: emailDevis({ clientName, company, brand, devis, fmtEurFn: fmtEur, publicUrl }),
      })
    } catch (e) {
      return res.status(502).json({ error: `Impossible d'envoyer l'email : ${e.message}` })
    }

    await admin.from('devis').update({ statut: 'envoye', sent_to_client_at: new Date().toISOString() }).eq('id', devis.id)
    await admin.from('devis_audit_log').insert({ devis_id: devis.id, event: 'sent', from_party: 'artisan', meta: { to: client.email } })

    return res.status(200).json({ ok: true, publicUrl, token: publicToken })
  }

  const { token } = body
  if (!token) return res.status(400).json({ error: 'token manquant' })

  // ── artisan_respond : réponse à une négociation (auth requise) ─────────
  if (action === 'artisan_respond') {
    const auth = await authenticate(req, res)
    if (!auth) return
    const { user } = auth

    const { data: devis } = await admin.from('devis')
      .select('id, numero, objet, statut, owner_id, client_id, lignes:lignes_devis(*)')
      .eq('public_token', token).maybeSingle()
    if (!devis) return res.status(404).json({ error: 'Devis introuvable' })
    if (devis.owner_id !== user.id) return res.status(403).json({ error: 'Non autorisé' })

    const { response, artisan_message, negotiation_id } = body

    if (response === 'accept_client_changes') {
      const { data: neg } = await admin.from('devis_negotiations')
        .select('*').eq('id', negotiation_id).eq('devis_id', devis.id).maybeSingle()
      if (!neg) return res.status(404).json({ error: 'Négociation introuvable' })

      const changes    = Array.isArray(neg.line_changes) ? neg.line_changes : []
      const removedIds = changes.filter(c => c.action === 'remove').map(c => c.ligne_id)
      const qtyChanges = changes.filter(c => c.action === 'change_qty')

      if (removedIds.length) await admin.from('lignes_devis').delete().in('id', removedIds)
      for (const qc of qtyChanges) {
        await admin.from('lignes_devis').update({ quantite: Number(qc.new_qty) }).eq('id', qc.ligne_id)
      }

      const { data: newLignes } = await admin.from('lignes_devis')
        .select('quantite, prix_unitaire, type_ligne').eq('devis_id', devis.id)
      const newHt = Math.round((newLignes || [])
        .filter(l => l.type_ligne === 'ouvrage')
        .reduce((s, l) => s + (l.quantite || 0) * (l.prix_unitaire || 0), 0) * 100) / 100

      await admin.from('devis').update({ statut: 'accepte', montant_ht: newHt, client_accepted_at: new Date().toISOString() }).eq('id', devis.id)
      await admin.from('devis_negotiations').update({ status: 'accepted' }).eq('id', negotiation_id)
      await admin.from('devis_audit_log').insert({ devis_id: devis.id, event: 'accepted', from_party: 'artisan', meta: { via: 'client_changes', negotiation_id } })

      const { data: client } = await admin.from('clients').select('email, nom, prenom, raison_sociale').eq('id', devis.client_id).maybeSingle()
      if (client?.email) {
        const cName = (`${client.prenom || ''} ${client.nom || ''}`).trim() || client.raison_sociale || ''
        sendEmail({ to: client.email, subject: `Devis ${devis.numero} accepté — vos modifications ont été prises en compte`, html: emailClientConfirm({ devis, clientName: cName, newHt }) }).catch(() => {})
      }
      return res.status(200).json({ ok: true, newHt })
    }

    if (response === 'refuse_client_changes') {
      await admin.from('devis_negotiations').update({ status: 'rejected' }).eq('id', negotiation_id)
      await admin.from('devis').update({ statut: 'envoye' }).eq('id', devis.id)
      await admin.from('devis_audit_log').insert({ devis_id: devis.id, event: 'artisan_responded', from_party: 'artisan', meta: { response: 'refused', message: artisan_message || null } })

      if (artisan_message) {
        const { data: client } = await admin.from('clients').select('email').eq('id', devis.client_id).maybeSingle()
        if (client?.email) {
          sendEmail({ to: client.email, subject: `Réponse concernant le devis ${devis.numero}`, html: emailArtisanMsg({ devis, message: artisan_message }) }).catch(() => {})
        }
      }
      return res.status(200).json({ ok: true })
    }

    return res.status(400).json({ error: 'response invalide' })
  }

  // ── request_otp ────────────────────────────────────────────────────────
  if (action === 'request_otp') {
    const { email } = body
    if (!email) return res.status(400).json({ error: 'email manquant' })

    const { data: devis } = await admin.from('devis')
      .select('id, numero, statut, client_id').eq('public_token', token).maybeSingle()
    if (!devis) return res.status(404).json({ error: 'Devis introuvable' })
    if (['accepte', 'refuse', 'remplace'].includes(devis.statut))
      return res.status(400).json({ error: 'Ce devis est clôturé' })

    const { data: client } = await admin.from('clients').select('email').eq('id', devis.client_id).maybeSingle()
    if (!client?.email) return res.status(400).json({ error: 'Client sans email' })
    if (email.toLowerCase().trim() !== client.email.toLowerCase().trim())
      return res.status(403).json({ error: 'Email non reconnu pour ce devis' })

    const fifteenAgo = new Date(Date.now() - 15 * 60_000).toISOString()
    const { count } = await admin.from('devis_otp_sessions')
      .select('id', { count: 'exact', head: true })
      .eq('public_token', token).gte('created_at', fifteenAgo)
    if ((count || 0) >= 3) return res.status(429).json({ error: 'Trop de tentatives. Réessayez dans 15 minutes.' })

    const otp = genOtp()
    const { data: sess, error: sessErr } = await admin.from('devis_otp_sessions').insert({
      public_token: token,
      email_hash:   hashStr(email.toLowerCase().trim()),
      otp_hash:     hashStr(otp),
      expires_at:   new Date(Date.now() + 15 * 60_000).toISOString(),
    }).select('id').single()
    if (sessErr || !sess) return res.status(500).json({ error: 'Erreur création session OTP — vérifiez que la migration 0032 est appliquée' })

    try {
      await sendEmail({ to: email, subject: `${otp} — Code d'accès devis ${devis.numero}`, html: emailOtp({ otp, devis }) })
    } catch (e) {
      return res.status(502).json({ error: `Échec envoi email : ${e.message}` })
    }

    return res.status(200).json({ session_id: sess.id })
  }

  // ── verify_otp ────────────────────────────────────────────────────────
  if (action === 'verify_otp') {
    const { session_id, code } = body
    if (!session_id || !code) return res.status(400).json({ error: 'session_id et code requis' })

    const { data: sess } = await admin.from('devis_otp_sessions')
      .select('*').eq('id', session_id).eq('public_token', token).maybeSingle()
    if (!sess) return res.status(404).json({ error: 'Session introuvable' })
    if (sess.verified_at) return res.status(200).json({ ok: true })
    if (new Date(sess.expires_at) < new Date()) return res.status(410).json({ error: 'Code expiré. Demandez-en un nouveau.' })
    if (sess.attempts >= 3) return res.status(429).json({ error: 'Trop de tentatives. Demandez un nouveau code.' })

    await admin.from('devis_otp_sessions').update({ attempts: sess.attempts + 1 }).eq('id', session_id)
    if (hashStr(code.trim()) !== sess.otp_hash) {
      const left = 2 - sess.attempts
      return res.status(401).json({ error: `Code incorrect${left > 0 ? ` (${left} essai${left > 1 ? 's' : ''} restant)` : ''}` })
    }

    await admin.from('devis_otp_sessions').update({
      verified_at: new Date().toISOString(),
      expires_at:  new Date(Date.now() + 24 * 3600_000).toISOString(),
    }).eq('id', session_id)

    const { data: devis } = await admin.from('devis').select('id').eq('public_token', token).maybeSingle()
    if (devis) {
      await admin.from('devis_audit_log').insert({
        devis_id: devis.id, event: 'opened', from_party: 'client',
        meta: { ip: req.headers['x-forwarded-for'] || null },
      })
    }
    return res.status(200).json({ ok: true })
  }

  // ── Actions client (session OTP obligatoire) ───────────────────────────
  const session = await verifySession(admin, token, body.session_id)
  if (!session) return res.status(401).json({ error: 'Session invalide ou expirée. Rafraîchissez la page.' })

  const { data: devis } = await admin.from('devis')
    .select('id, numero, objet, statut, owner_id, client_id, montant_ht, lignes:lignes_devis(*)')
    .eq('public_token', token).maybeSingle()
  if (!devis) return res.status(404).json({ error: 'Devis introuvable' })
  if (['accepte', 'refuse', 'remplace'].includes(devis.statut))
    return res.status(400).json({ error: 'Ce devis est déjà clôturé' })

  const ip = req.headers['x-forwarded-for'] || null

  // ── accept ─────────────────────────────────────────────────────────────
  if (action === 'accept') {
    const { client_name } = body
    if (!client_name?.trim()) return res.status(400).json({ error: 'Votre nom est requis pour accepter' })

    await admin.from('devis').update({ statut: 'accepte', client_name: client_name.trim(), client_accepted_at: new Date().toISOString() }).eq('id', devis.id)
    await admin.from('devis_negotiations').update({ status: 'superseded' }).eq('devis_id', devis.id).eq('status', 'pending')
    await admin.from('devis_audit_log').insert({ devis_id: devis.id, event: 'accepted', from_party: 'client', meta: { client_name: client_name.trim(), ip } })
    notifyTg('devis_accepted', { numero: devis.numero, objet: devis.objet, montant_ht: devis.montant_ht, client_name: client_name.trim() })
    return res.status(200).json({ ok: true })
  }

  // ── refuse ─────────────────────────────────────────────────────────────
  if (action === 'refuse') {
    const { reason } = body
    if (!reason?.trim()) return res.status(400).json({ error: 'La raison du refus est requise' })

    await admin.from('devis').update({ statut: 'refuse', client_refused_at: new Date().toISOString(), client_refusal_reason: reason.trim() }).eq('id', devis.id)
    await admin.from('devis_audit_log').insert({ devis_id: devis.id, event: 'refused', from_party: 'client', meta: { reason: reason.trim(), ip } })
    notifyTg('devis_refused', { numero: devis.numero, objet: devis.objet, reason: reason.trim() })
    return res.status(200).json({ ok: true })
  }

  // ── negotiate ──────────────────────────────────────────────────────────
  if (action === 'negotiate') {
    const { message, line_changes, budget_target } = body
    const changes = Array.isArray(line_changes) ? line_changes : []
    if (!message?.trim() && changes.length === 0 && !budget_target)
      return res.status(400).json({ error: 'Précisez vos modifications, un budget cible ou un message' })

    const removedIds = changes.filter(c => c.action === 'remove').map(c => c.ligne_id)
    const qtyChanges = changes.filter(c => c.action === 'change_qty')
    const newTotal   = Math.round((devis.lignes || [])
      .filter(l => l.type_ligne === 'ouvrage' && !removedIds.includes(l.id))
      .reduce((s, l) => {
        const qc  = qtyChanges.find(c => c.ligne_id === l.id)
        const qty = qc ? Number(qc.new_qty) : (l.quantite || 0)
        return s + qty * (l.prix_unitaire || 0)
      }, 0))

    const { count: roundCount } = await admin.from('devis_negotiations')
      .select('id', { count: 'exact', head: true }).eq('devis_id', devis.id)

    await admin.from('devis_negotiations').insert({
      devis_id: devis.id, round: (roundCount || 0) + 1, from_party: 'client',
      message: message?.trim() || null,
      line_changes: changes.length ? changes : null,
      budget_target: budget_target ? Number(budget_target) : null,
    })
    await admin.from('devis').update({ statut: 'en_negociation' }).eq('id', devis.id)
    await admin.from('devis_audit_log').insert({ devis_id: devis.id, event: 'negotiation_sent', from_party: 'client', meta: { round: (roundCount || 0) + 1, new_total: newTotal, ip } })
    notifyTg('devis_negotiation', { numero: devis.numero, objet: devis.objet, new_total: newTotal, message: message?.trim() || null, changes_count: changes.length })
    return res.status(200).json({ ok: true, newTotal })
  }

  return res.status(400).json({ error: 'action invalide' })
}
