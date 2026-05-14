import { cors } from './_cors.js'
import { sendEmail } from './_email.js'
import { rateLimit, sendRateLimited } from './_rateLimit.js'

const EMAIL_RE = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/
// Téléphone FR : 0X XX XX XX XX, +33 X XX XX XX XX, séparateurs souples (espace, tiret, point)
const PHONE_FR_RE = /^(?:\+33[\s.-]?|0)[1-9](?:[\s.-]?\d{2}){4}$/

export default async function handler(req, res) {
  cors(req, res, { methods: 'POST, OPTIONS', auth: false })
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const rl = rateLimit(req, { windowMs: 60 * 60_000, max: 5, prefix: 'contact' })
  if (!rl.ok) return sendRateLimited(res, rl.retryAfterSec)

  const { name, email, message, website, phone, type, slot } = req.body ?? {}

  // Honeypot : un humain laisse ce champ vide, un bot le remplit
  if (website) return res.status(200).json({ ok: true })

  const nameStr    = typeof name    === 'string' ? name.trim()    : ''
  const emailStr   = typeof email   === 'string' ? email.trim()   : ''
  const messageStr = typeof message === 'string' ? message.trim() : ''
  const phoneStr   = typeof phone   === 'string' ? phone.trim()   : ''
  const slotStr    = typeof slot    === 'string' ? slot.trim()    : ''
  const isCallback = type === 'callback'

  if (!nameStr || nameStr.length > 100)
    return res.status(400).json({ error: 'Nom invalide' })

  if (isCallback) {
    // Rappel téléphone : phone obligatoire, email optionnel.
    if (!phoneStr || phoneStr.length > 30 || !PHONE_FR_RE.test(phoneStr))
      return res.status(400).json({ error: 'Numéro de téléphone invalide' })
    if (emailStr && (emailStr.length > 254 || !EMAIL_RE.test(emailStr)))
      return res.status(400).json({ error: 'Email invalide' })
  } else {
    // Contact classique : email + message obligatoires.
    if (!emailStr || emailStr.length > 254 || !EMAIL_RE.test(emailStr))
      return res.status(400).json({ error: 'Email invalide' })
    if (!messageStr || messageStr.length > 2000)
      return res.status(400).json({ error: 'Message invalide' })
  }

  const adminEmail = process.env.ADMIN_EMAIL
  if (!adminEmail) return res.status(500).json({ error: 'Configuration serveur manquante' })

  const esc = s => String(s).replace(/</g, '&lt;')

  const subject = isCallback
    ? `📞 Demande de rappel démo — ${nameStr}`
    : `📬 Nouveau message de contact — ${nameStr}`

  const rows = [
    ['Nom', esc(nameStr)],
    isCallback && phoneStr ? ['Téléphone', `<a href="tel:${esc(phoneStr.replace(/\s+/g, ''))}">${esc(phoneStr)}</a>`] : null,
    emailStr ? ['Email', `<a href="mailto:${esc(emailStr)}">${esc(emailStr)}</a>`] : null,
    isCallback && slotStr ? ['Créneau préféré', esc(slotStr)] : null,
  ].filter(Boolean)

  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto">
      <h2 style="color:#C97B5C">${isCallback ? 'Demande de rappel pour démo Zenbat' : 'Nouveau message de contact'}</h2>
      <table style="width:100%;border-collapse:collapse">
        ${rows.map(([k, v]) => `
          <tr>
            <td style="padding:8px 0;font-weight:600;color:#555;width:140px">${k}</td>
            <td style="padding:8px 0;color:#222">${v}</td>
          </tr>
        `).join('')}
      </table>
      ${(!isCallback || messageStr) ? `
        <div style="margin-top:16px;padding:16px;background:#FAF7F2;border-radius:8px;border-left:3px solid #C97B5C">
          <p style="margin:0;white-space:pre-wrap;color:#333;line-height:1.6">${esc(messageStr || 'Demande de démo — pas de message libre.')}</p>
        </div>
      ` : ''}
      <p style="margin-top:20px;font-size:12px;color:#999">${isCallback ? 'Demande de rappel envoyée depuis la landing Zenbat' : 'Envoyé depuis le formulaire de contact Zenbat'}</p>
    </div>
  `

  await sendEmail({ to: adminEmail, subject, html })

  return res.status(200).json({ ok: true })
}
