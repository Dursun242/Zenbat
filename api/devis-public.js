// Page publique client — accès devis sans authentification Supabase
// GET  ?token=xxx                 → aperçu (avant OTP) ou données complètes (après OTP)
// POST {action:'send'}            → artisan envoie le devis par email (auth JWT requise)
// POST {action:'request_otp'}     → envoie code 8 chiffres à l'email du client
// POST {action:'verify_otp'}      → vérifie le code, ouvre la session 24h
// POST {action:'accept'}          → client accepte (session OTP requise)
// POST {action:'refuse'}          → client refuse avec raison (session OTP requise)
// POST {action:'negotiate'}       → client soumet proposition de modification
// POST {action:'artisan_respond'} → artisan répond à une négo (auth JWT requise)

import { cors }         from './_cors.js'
import { authenticate } from './_withAuth.js'
import { rateLimit, sendRateLimited } from './_rateLimit.js'
import { createHash, randomInt } from 'crypto'
import { createClient } from '@supabase/supabase-js'

function makeAdmin() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

const hashStr = s => createHash('sha256').update(String(s)).digest('hex')
// 8 chiffres via crypto.randomInt (CSPRNG) — 10⁸ combinaisons,
// soit ~33 ans à brute-forcer même avec 10 essais/15 min.
const genOtp  = () => randomInt(10_000_000, 100_000_000).toString()
const fmtEur  = n => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n || 0)

async function sendEmail({ to, subject, html, cc, fromName, attachments }) {
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
      ...(attachments?.length ? { attachments } : {}),
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

function notifyTg(kind, payload) {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return
  fetch(`${url}/functions/v1/notify-telegram`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({ kind, payload }),
  }).catch(e => console.error('[notifyTg]', e?.message))
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
function emailDevis({ clientName, company, brand, devis, fmtEurFn, publicUrl, logoSrc }) {
  const accent = brand?.color || '#22c55e'
  const logo   = logoSrc || (brand?.logo?.startsWith('http') ? brand.logo : null)
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

// Email envoyé au client quand l'artisan refuse sa demande de modification.
// Envoyé systématiquement (même si l'artisan n'a pas tapé de message libre)
// pour que le client sache où en est sa demande et puisse rebondir
// (renégocier, accepter le devis initial, ou contacter l'artisan).
function emailRefusalToClient({ devis, clientName, company, brand, message, publicUrl }) {
  const accent     = brand?.color || '#1A1612'
  const senderName = company || "l'artisan"
  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,sans-serif">
<div style="max-width:520px;margin:32px auto;background:white;border-radius:12px;overflow:hidden;border:1px solid #ececec">

  <div style="background:${accent};padding:18px 24px;color:white">
    <div style="font-size:11px;font-weight:700;letter-spacing:1px;opacity:.9;text-transform:uppercase">Réponse de ${esc(senderName)}</div>
    <div style="font-size:18px;font-weight:700;margin-top:4px">Devis ${esc(devis.numero)}</div>
  </div>

  <div style="padding:24px 28px">
    <p style="font-size:14px;color:#1A1612;margin:0 0 6px">Bonjour${clientName ? ' ' + esc(clientName) : ''},</p>
    <p style="font-size:14px;color:#555;line-height:1.55;margin:0 0 16px">
      Votre demande de modification${devis.objet ? ` concernant <strong style="color:#1A1612">${esc(devis.objet)}</strong>` : ''} n'a pas pu être retenue par ${esc(senderName)}.
    </p>

    ${message ? `<div style="margin-bottom:18px">
      <div style="font-size:11px;font-weight:700;color:#999;letter-spacing:.5px;text-transform:uppercase;margin-bottom:6px">Message</div>
      <div style="background:#FAF7F2;border-left:3px solid ${accent};padding:12px 14px;border-radius:0 8px 8px 0;font-size:13px;color:#1A1612;white-space:pre-wrap;line-height:1.55">${esc(message)}</div>
    </div>` : ''}

    <p style="font-size:14px;color:#555;line-height:1.55;margin:0 0 20px">
      Le devis initial reste valable. Vous pouvez le consulter à nouveau, l'accepter, le refuser, ou contacter l'artisan pour discuter d'une autre proposition.
    </p>

    ${publicUrl ? `<a href="${publicUrl}" style="display:block;text-align:center;background:${accent};color:white;text-decoration:none;padding:13px 24px;border-radius:8px;font-size:14px;font-weight:700">
      Consulter le devis →
    </a>` : ''}

    ${(brand?.phone || brand?.email) ? `<p style="font-size:12px;color:#999;margin:18px 0 0;text-align:center">
      ${brand.phone ? `Téléphone : <strong style="color:#666">${esc(brand.phone)}</strong>` : ''}
      ${brand.phone && brand.email ? ' · ' : ''}
      ${brand.email ? `<a href="mailto:${esc(brand.email)}" style="color:${accent};text-decoration:none">${esc(brand.email)}</a>` : ''}
    </p>` : ''}
  </div>
</div></body></html>`
}

// Échappement HTML minimal pour ce qui vient du client public (message,
// commentaires, nom) avant d'être interpolé dans un template email.
const esc = s => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;')

// Email pour l'artisan quand le client envoie une demande de modification
// du devis (action 'negotiate'). Résume les changements de lignes, le
// budget cible, le message libre, et redirige vers l'app pour répondre.
function emailNegotiationArtisan({ company, devis, clientName, clientEmail, changes, lignesMap, budgetTarget, message, newTotal, oldTotal, appUrl }) {
  const accent = '#f97316' // orange — code couleur du statut "Négociation"

  const changesHtml = (changes || []).map(c => {
    const ligne = lignesMap.get(c.ligne_id)
    const designation = esc(ligne?.designation || 'Ligne')
    const commentHtml = c.comment
      ? `<div style="font-size:12px;color:#777;font-style:italic;margin-top:4px">« ${esc(c.comment)} »</div>`
      : ''
    if (c.action === 'remove') {
      return `<li style="padding:10px 0;border-bottom:1px solid #f0f0f0;list-style:none">
        <span style="display:inline-block;background:#fee2e2;color:#991b1b;font-size:11px;font-weight:700;padding:2px 8px;border-radius:4px;letter-spacing:.3px">RETIRER</span>
        <div style="font-size:14px;color:#1A1612;margin-top:6px;text-decoration:line-through;text-decoration-color:#bbb">${designation}</div>
        ${commentHtml}
      </li>`
    }
    if (c.action === 'change_qty') {
      const oldQty = ligne?.quantite ?? '?'
      const unite  = ligne?.unite ? ` ${esc(ligne.unite)}` : ''
      return `<li style="padding:10px 0;border-bottom:1px solid #f0f0f0;list-style:none">
        <span style="display:inline-block;background:#fff7ed;color:#c2410c;font-size:11px;font-weight:700;padding:2px 8px;border-radius:4px;letter-spacing:.3px">AJUSTER</span>
        <div style="font-size:14px;color:#1A1612;margin-top:6px">${designation}</div>
        <div style="font-size:13px;color:#555;margin-top:2px">Quantité : <strong>${oldQty}${unite}</strong> → <strong style="color:${accent}">${esc(c.new_qty)}${unite}</strong></div>
        ${commentHtml}
      </li>`
    }
    return ''
  }).filter(Boolean).join('')

  const diff = newTotal - oldTotal
  const showTotal = changes && changes.length > 0 && newTotal !== oldTotal
  const diffLabel = diff < 0
    ? `<span style="color:#15803d;font-size:12px">Économie de ${fmtEur(Math.abs(diff))} HT</span>`
    : diff > 0
      ? `<span style="color:#b45309;font-size:12px">+${fmtEur(diff)} HT</span>`
      : ''

  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,sans-serif">
<div style="max-width:560px;margin:32px auto;background:white;border-radius:12px;overflow:hidden;border:1px solid #ececec">

  <div style="background:${accent};padding:18px 24px;color:white">
    <div style="font-size:11px;font-weight:700;letter-spacing:1px;opacity:.9;text-transform:uppercase">Demande client</div>
    <div style="font-size:18px;font-weight:700;margin-top:4px">Modification du devis ${esc(devis.numero)}</div>
  </div>

  <div style="padding:24px 28px">
    <p style="font-size:14px;color:#1A1612;margin:0 0 6px">Bonjour${company ? ' ' + esc(company) : ''},</p>
    <p style="font-size:14px;color:#555;line-height:1.55;margin:0 0 18px">
      <strong>${esc(clientName) || 'Votre client'}</strong>${clientEmail ? ` (<a href="mailto:${esc(clientEmail)}" style="color:${accent};text-decoration:none">${esc(clientEmail)}</a>)` : ''}
      vous a transmis une proposition de modification${devis.objet ? ` pour <strong style="color:#1A1612">${esc(devis.objet)}</strong>` : ''}.
    </p>

    ${changesHtml ? `<div style="margin-bottom:18px">
      <div style="font-size:11px;font-weight:700;color:#999;letter-spacing:.5px;text-transform:uppercase;margin-bottom:8px">Modifications demandées</div>
      <ul style="margin:0;padding:0">${changesHtml}</ul>
    </div>` : ''}

    ${budgetTarget ? `<div style="background:#fafafa;border-radius:8px;padding:12px 14px;margin-bottom:14px;display:flex;justify-content:space-between;align-items:center">
      <span style="font-size:13px;color:#555">Budget cible client</span>
      <strong style="font-size:15px;color:#1A1612">${fmtEur(budgetTarget)} HT</strong>
    </div>` : ''}

    ${message ? `<div style="margin-bottom:18px">
      <div style="font-size:11px;font-weight:700;color:#999;letter-spacing:.5px;text-transform:uppercase;margin-bottom:6px">Message</div>
      <div style="background:#FAF7F2;border-left:3px solid ${accent};padding:12px 14px;border-radius:0 8px 8px 0;font-size:13px;color:#1A1612;white-space:pre-wrap;line-height:1.55">${esc(message)}</div>
    </div>` : ''}

    ${showTotal ? `<div style="background:#fafafa;border-radius:8px;padding:14px;margin-bottom:20px;display:flex;justify-content:space-between;align-items:center">
      <div>
        <div style="font-size:11px;color:#999;font-weight:600;text-transform:uppercase;letter-spacing:.5px">Nouveau total estimé</div>
        ${diffLabel ? `<div style="margin-top:3px">${diffLabel}</div>` : ''}
      </div>
      <strong style="font-size:20px;color:#1A1612;letter-spacing:-.5px">${fmtEur(newTotal)}</strong>
    </div>` : ''}

    <a href="${appUrl}" style="display:block;text-align:center;background:#1A1612;color:white;text-decoration:none;padding:13px 24px;border-radius:8px;font-size:14px;font-weight:700">
      Répondre dans l'app →
    </a>

    <p style="font-size:12px;color:#999;margin:18px 0 0;text-align:center">
      Vous pouvez accepter ces modifications, les refuser, ou contacter le client directement.
    </p>
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

    // Fallback résilient si la migration 0007 (signed_by) n'a pas été
    // appliquée sur la DB. Même pattern que src/lib/api.js updateDevis :
    // on retente sans signed_by si Postgres répond 42703 (column not exist).
    const FULL_DEVIS_SELECT = 'id, numero, objet, montant_ht, statut, date_emission, date_validite, public_token, client_id, owner_id, client_accepted_at, client_refused_at, client_refusal_reason, signed_at, signed_by, tva_rate, auto_liquidation_btp, lignes:lignes_devis(*)'
    const SAFE_DEVIS_SELECT = 'id, numero, objet, montant_ht, statut, date_emission, date_validite, public_token, client_id, owner_id, client_accepted_at, client_refused_at, client_refusal_reason, signed_at, tva_rate, auto_liquidation_btp, lignes:lignes_devis(*)'
    let { data: devis, error: de } = await admin.from('devis')
      .select(FULL_DEVIS_SELECT)
      .eq('public_token', token)
      .maybeSingle()
    if (de?.code === '42703') {
      ({ data: devis, error: de } = await admin.from('devis')
        .select(SAFE_DEVIS_SELECT)
        .eq('public_token', token)
        .maybeSingle())
    }
    if (de || !devis) return res.status(404).json({ error: 'Devis introuvable' })

    const { data: profile } = await admin.from('profiles')
      .select('company_name, full_name, brand_data').eq('id', devis.owner_id).maybeSingle()
    const brand = (() => { const r = profile?.brand_data; if (!r) return {}; if (typeof r === 'string') { try { return JSON.parse(r) } catch { return {} } } return r })()

    const artisan = {
      company: profile?.company_name || brand.companyName || '',
      email:   brand.email   || '',
      phone:   brand.phone   || '',
      address: brand.address || '',
      color:   brand.color   || '',
      logo:    brand.logo    || '',
      brand,
    }

    const { data: client } = await admin.from('clients')
      .select('raison_sociale, nom, prenom, email, adresse, code_postal, ville, telephone').eq('id', devis.client_id).maybeSingle()

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
      // Champs devis utilisés par pdfBuilder (côté navigateur) pour
      // recalculer les totaux TVA et afficher la mention d'auto-liquidation.
      tva_rate:             devis.tva_rate,
      auto_liquidation_btp: devis.auto_liquidation_btp,
      // Champs signature (déjà inclus en preview pour client_accepted_at,
      // dupliqués ici pour cohérence avec ce que pdfBuilder attend).
      signed_at:            devis.signed_at,
      signed_by:            devis.signed_by,
      // Vue résumée historique + vue complète (clientFull) pour le PDF
      // signé généré côté navigateur sur la page publique.
      client:    { name: (`${client?.prenom || ''} ${client?.nom || ''}`).trim() || client?.raison_sociale || '', email: client?.email },
      clientFull: client || null,
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
    const brand = (() => { const r = profile?.brand_data; if (!r) return {}; if (typeof r === 'string') { try { return JSON.parse(r) } catch { return {} } } return r })()
    const company    = profile?.company_name || brand.companyName || ''
    const clientName = (`${client.prenom || ''} ${client.nom || ''}`).trim() || client.raison_sociale || ''
    const publicUrl  = `${process.env.VITE_PUBLIC_URL || 'https://zenbat.vercel.app'}/d/${publicToken}`

    // Si le logo est une data URL base64, le passer en inline attachment (évite le blocage client mail)
    let logoSrc = null
    const attachments = []
    const rawLogo = brand.logo || ''
    if (rawLogo.startsWith('data:')) {
      const m = rawLogo.match(/^data:([^;]+);base64,(.+)$/)
      if (m) {
        attachments.push({ filename: 'logo.png', content: m[2], encoding: 'base64', cid: 'company-logo', contentType: m[1] })
        logoSrc = 'cid:company-logo'
      }
    } else if (rawLogo.startsWith('http')) {
      logoSrc = rawLogo
    }

    const ccEmails = [...new Set([user.email, brand.email].filter(Boolean))]
    try {
      await sendEmail({
        to: client.email,
        cc: ccEmails.length ? ccEmails : undefined,
        fromName: 'Consulter votre devis',
        subject: `Consulter votre devis${devis.objet ? ' — ' + devis.objet : ' ' + devis.numero}${company ? ' · ' + company : ''}`,
        html: emailDevis({ clientName, company, brand, devis, fmtEurFn: fmtEur, publicUrl, logoSrc }),
        attachments,
      })
    } catch (e) {
      console.error('[send email]', e?.message)
      return res.status(502).json({ error: "Échec de l'envoi email. Vérifiez la configuration GMAIL ou réessayez." })
    }

    await admin.from('devis').update({ statut: 'envoye', sent_to_client_at: new Date().toISOString() }).eq('id', devis.id)
    await admin.from('devis_audit_log').insert({ devis_id: devis.id, event: 'sent', from_party: 'artisan', meta: { to: client.email } })
    notifyTg('devis_sent', { numero: devis.numero, objet: devis.objet, montant_ht: devis.montant_ht, to: client.email, company })

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

      // Notification client systématique : qu'il y ait un message libre
      // de l'artisan ou pas, le client doit savoir que sa demande a été
      // refusée pour pouvoir rebondir (renégocier, accepter le devis
      // initial, contacter directement).
      const { data: client } = await admin.from('clients')
        .select('email, nom, prenom, raison_sociale').eq('id', devis.client_id).maybeSingle()
      if (client?.email) {
        const { data: profile } = await admin.from('profiles')
          .select('company_name, brand_data').eq('id', devis.owner_id).maybeSingle()
        const brand     = (() => { const r = profile?.brand_data; if (!r) return {}; if (typeof r === 'string') { try { return JSON.parse(r) } catch { return {} } } return r })()
        const company   = profile?.company_name || brand.companyName || ''
        const cName     = (`${client.prenom || ''} ${client.nom || ''}`).trim() || client.raison_sociale || ''
        const publicUrl = `${process.env.VITE_PUBLIC_URL || 'https://zenbat.vercel.app'}/d/${token}`
        sendEmail({
          to: client.email,
          fromName: company ? `${company}` : 'Réponse devis',
          subject: `Votre demande de modification du devis ${devis.numero}${devis.objet ? ' — ' + devis.objet : ''}`,
          html: emailRefusalToClient({ devis, clientName: cName, company, brand, message: artisan_message?.trim() || null, publicUrl }),
        }).catch(e => console.error('[refuse email]', e?.message))
      }
      return res.status(200).json({ ok: true })
    }

    return res.status(400).json({ error: 'response invalide' })
  }

  // ── request_otp ────────────────────────────────────────────────────────
  if (action === 'request_otp') {
    const rl = rateLimit(req, { windowMs: 15 * 60_000, max: 10, prefix: 'otp' })
    if (!rl.ok) return sendRateLimited(res, rl.retryAfterSec)

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
      console.error('[otp email]', e?.message)
      return res.status(502).json({ error: 'Échec envoi du code. Vérifiez votre adresse email ou réessayez.' })
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

    if (hashStr(code.trim()) !== sess.otp_hash) {
      await admin.from('devis_otp_sessions').update({ attempts: sess.attempts + 1 }).eq('id', session_id)
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
    .select('id, numero, objet, statut, owner_id, client_id, montant_ht, signed_at, signed_by, lignes:lignes_devis(*)')
    .eq('public_token', token).maybeSingle()
  if (!devis) return res.status(404).json({ error: 'Devis introuvable' })
  // send_signed_pdf est exempt : il n'a de sens qu'après acceptation.
  if (action !== 'send_signed_pdf' && ['accepte', 'refuse', 'remplace'].includes(devis.statut))
    return res.status(400).json({ error: 'Ce devis est déjà clôturé' })

  const ip = req.headers['x-forwarded-for'] || null

  // ── send_signed_pdf : email le PDF signé à l'artisan + au client ───────
  // Appelé par DevisPublicPage juste après acceptation. Le PDF est généré
  // côté navigateur (via src/lib/pdfBuilder.js) avec la signature manuscrite
  // déjà incorporée — l'API ne fait que router le base64 vers les emails.
  // Idempotence : si un événement 'signed_pdf_sent' existe déjà pour ce
  // devis, on renvoie ok sans re-envoyer (protection contre les doubles
  // clics ou les re-tentatives accidentelles).
  if (action === 'send_signed_pdf') {
    if (devis.statut !== 'accepte') return res.status(400).json({ error: 'Le devis doit être accepté avant envoi du PDF' })

    const { pdf_base64 } = body
    if (!pdf_base64 || typeof pdf_base64 !== 'string') return res.status(400).json({ error: 'PDF manquant' })
    // Limite ~5 MB en base64 (≈3.75 MB binaire) — borne raisonnable pour
    // un devis, évite qu'on accepte des payloads abusifs.
    if (pdf_base64.length > 5 * 1024 * 1024) return res.status(413).json({ error: 'PDF trop volumineux' })

    const { count: alreadySent } = await admin.from('devis_audit_log')
      .select('id', { count: 'exact', head: true })
      .eq('devis_id', devis.id).eq('event', 'signed_pdf_sent')
    if (alreadySent && alreadySent > 0) return res.status(200).json({ ok: true, alreadySent: true })

    const { data: client } = await admin.from('clients')
      .select('raison_sociale, nom, prenom, email').eq('id', devis.client_id).maybeSingle()
    const { data: profile } = await admin.from('profiles')
      .select('company_name, brand_data').eq('id', devis.owner_id).maybeSingle()
    const { data: ownerData } = await admin.auth.admin.getUserById(devis.owner_id)
    const brand = (() => { const r = profile?.brand_data; if (!r) return {}; if (typeof r === 'string') { try { return JSON.parse(r) } catch { return {} } } return r })()
    const company      = profile?.company_name || brand.companyName || ''
    const artisanEmail = brand.email || ownerData?.user?.email || null
    const clientName   = (`${client?.prenom || ''} ${client?.nom || ''}`).trim() || client?.raison_sociale || ''
    const filename     = `devis-${devis.numero}-signe.pdf`

    const attachments = [{ filename, content: pdf_base64, encoding: 'base64', contentType: 'application/pdf' }]

    const emailHtml = (greeting, intro) => `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:520px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden">
    <div style="background:#22c55e;padding:24px;text-align:center">
      <div style="font-size:30px;color:#fff">&#10003;</div>
      <div style="color:#fff;font-size:18px;font-weight:700;margin-top:8px">Devis signé</div>
    </div>
    <div style="padding:32px">
      <p style="color:#1A1612;font-size:14px;margin:0 0 16px">${greeting}</p>
      <p style="color:#6B6358;font-size:14px;line-height:1.6;margin:0 0 16px">${intro}</p>
      <p style="color:#6B6358;font-size:14px;line-height:1.6;margin:0">Vous trouverez le PDF signé en pièce jointe de cet email.</p>
    </div>
  </div></body></html>`

    const errors = []
    if (client?.email) {
      try {
        await sendEmail({
          to: client.email,
          fromName: company || 'Devis signé',
          subject: `Votre devis ${devis.numero} signé`,
          html: emailHtml(
            `Bonjour ${clientName || ''},`,
            `Votre signature électronique du devis <strong>${devis.numero}</strong>${devis.objet ? ` (${devis.objet})` : ''} a bien été enregistrée.`,
          ),
          attachments,
        })
      } catch (e) { errors.push(`client: ${e?.message || 'erreur'}`) }
    }
    if (artisanEmail) {
      try {
        await sendEmail({
          to: artisanEmail,
          fromName: 'Zenbat',
          subject: `Devis ${devis.numero} signé par ${clientName || 'le client'}`,
          html: emailHtml(
            `Bonjour,`,
            `Le devis <strong>${devis.numero}</strong>${devis.objet ? ` (${devis.objet})` : ''} a été signé électroniquement par <strong>${clientName || 'le client'}</strong>${client?.email ? ` (${client.email})` : ''}.`,
          ),
          attachments,
        })
      } catch (e) { errors.push(`artisan: ${e?.message || 'erreur'}`) }
    }

    await admin.from('devis_audit_log').insert({
      devis_id: devis.id, event: 'signed_pdf_sent', from_party: 'system',
      meta: { to_client: !!client?.email, to_artisan: !!artisanEmail, errors: errors.length ? errors : null, ip },
    })
    return res.status(200).json({ ok: true, sent: { client: !!client?.email && !errors.find(e => e.startsWith('client')), artisan: !!artisanEmail && !errors.find(e => e.startsWith('artisan')) }, errors: errors.length ? errors : undefined })
  }

  // ── accept ─────────────────────────────────────────────────────────────
  if (action === 'accept') {
    const { client_name } = body
    if (!client_name?.trim()) return res.status(400).json({ error: 'Votre nom est requis pour accepter' })

    const clean      = client_name.trim()
    const acceptedAt = new Date().toISOString()
    // Champs miroir vers signed_by/signed_at utilisés par pdfBuilder pour
    // afficher la signature manuscrite. Fallback si la migration 0007 n'a
    // pas été appliquée (colonne signed_by absente) : on retente sans.
    const fullPatch = {
      statut:             'accepte',
      client_name:        clean,
      client_accepted_at: acceptedAt,
      signed_by:          clean,
      signed_at:          acceptedAt,
    }
    let { error: ue } = await admin.from('devis').update(fullPatch).eq('id', devis.id)
    if (ue?.code === '42703') {
      const { signed_by, ...safe } = fullPatch
      ;({ error: ue } = await admin.from('devis').update(safe).eq('id', devis.id))
    }
    // Une erreur d'UPDATE non-42703 (RLS, CHECK constraint, réseau) ne doit
    // pas être avalée : sinon le client voit « accepté » alors que le statut
    // DB n'a pas bougé. On échoue explicitement pour qu'il puisse réessayer.
    if (ue) {
      console.error('[devis-public/accept] UPDATE devis échoué:', ue.message || ue)
      return res.status(500).json({ error: "L'acceptation n'a pas pu être enregistrée, réessayez." })
    }
    await admin.from('devis_negotiations').update({ status: 'superseded' }).eq('devis_id', devis.id).eq('status', 'pending')
    await admin.from('devis_audit_log').insert({ devis_id: devis.id, event: 'accepted', from_party: 'client', meta: { client_name: clean, ip } })
    notifyTg('devis_accepted', { numero: devis.numero, objet: devis.objet, montant_ht: devis.montant_ht, client_name: clean })
    return res.status(200).json({ ok: true, signed_at: acceptedAt, signed_by: clean })
  }

  // ── refuse ─────────────────────────────────────────────────────────────
  if (action === 'refuse') {
    const { reason } = body
    if (!reason?.trim()) return res.status(400).json({ error: 'La raison du refus est requise' })

    const { error: re } = await admin.from('devis').update({ statut: 'refuse', client_refused_at: new Date().toISOString(), client_refusal_reason: reason.trim() }).eq('id', devis.id)
    if (re) {
      console.error('[devis-public/refuse] UPDATE devis échoué:', re.message || re)
      return res.status(500).json({ error: "Le refus n'a pas pu être enregistré, réessayez." })
    }
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
    const ouvrages   = (devis.lignes || []).filter(l => l.type_ligne === 'ouvrage')
    const oldTotal   = Math.round(ouvrages.reduce((s, l) => s + (l.quantite || 0) * (l.prix_unitaire || 0), 0) * 100) / 100
    const newTotal   = Math.round(ouvrages
      .filter(l => !removedIds.includes(l.id))
      .reduce((s, l) => {
        const qc  = qtyChanges.find(c => c.ligne_id === l.id)
        const qty = qc ? Number(qc.new_qty) : (l.quantite || 0)
        return s + qty * (l.prix_unitaire || 0)
      }, 0) * 100) / 100

    const { count: roundCount } = await admin.from('devis_negotiations')
      .select('id', { count: 'exact', head: true }).eq('devis_id', devis.id)

    await admin.from('devis_negotiations').insert({
      devis_id: devis.id, round: (roundCount || 0) + 1, from_party: 'client',
      message: message?.trim() || null,
      line_changes: changes.length ? changes : null,
      budget_target: budget_target ? Number(budget_target) : null,
    })
    // L'UPDATE peut échouer silencieusement si la migration 0047 n'est pas
    // appliquée (CHECK constraint sur statut). On log explicitement pour
    // éviter qu'un futur ajout d'enum se retrouve à nouveau silencieux.
    const { error: stUpdErr } = await admin.from('devis').update({ statut: 'en_negociation' }).eq('id', devis.id)
    if (stUpdErr) console.error('[negotiate] devis status update failed:', stUpdErr.code, stUpdErr.message, '— migration 0047 manquante ?')
    await admin.from('devis_audit_log').insert({ devis_id: devis.id, event: 'negotiation_sent', from_party: 'client', meta: { round: (roundCount || 0) + 1, new_total: newTotal, ip } })
    notifyTg('devis_negotiation', { numero: devis.numero, objet: devis.objet, new_total: newTotal, message: message?.trim() || null, changes_count: changes.length })

    // Email artisan — fire-and-forget : la négo est déjà enregistrée en
    // DB, l'email est une notification best-effort (ne bloque pas la
    // réponse client). Pattern identique à artisan_respond.
    const { data: profile } = await admin.from('profiles')
      .select('company_name, brand_data').eq('id', devis.owner_id).maybeSingle()
    let authEmail = null
    try {
      const { data: ownerData } = await admin.auth.admin.getUserById(devis.owner_id)
      authEmail = ownerData?.user?.email || null
    } catch { /* auth admin indisponible (tests, perm) — fallback brand.email */ }
    const { data: client }    = await admin.from('clients')
      .select('email, nom, prenom, raison_sociale').eq('id', devis.client_id).maybeSingle()
    const brand        = (() => { const r = profile?.brand_data; if (!r) return {}; if (typeof r === 'string') { try { return JSON.parse(r) } catch { return {} } } return r })()
    const company      = profile?.company_name || brand.companyName || ''
    const artisanEmail = brand.email || authEmail
    if (artisanEmail) {
      const clientName = (`${client?.prenom || ''} ${client?.nom || ''}`).trim() || client?.raison_sociale || ''
      const lignesMap  = new Map(ouvrages.map(l => [l.id, l]))
      const appUrl     = `${process.env.ZENBAT_APP_URL || process.env.VITE_PUBLIC_URL || 'https://zenbat.vercel.app'}/?tab=devis`
      sendEmail({
        to: artisanEmail,
        fromName: 'Zenbat',
        subject: `Demande de modification — devis ${devis.numero}${devis.objet ? ' · ' + devis.objet : ''}`,
        html: emailNegotiationArtisan({
          company, devis, clientName, clientEmail: client?.email || null,
          changes, lignesMap, budgetTarget: budget_target ? Number(budget_target) : null,
          message: message?.trim() || null, newTotal, oldTotal, appUrl,
        }),
      }).catch(e => console.error('[negotiate email]', e?.message))
    }

    return res.status(200).json({ ok: true, newTotal })
  }

  return res.status(400).json({ error: 'action invalide' })
}
