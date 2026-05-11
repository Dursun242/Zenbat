import { cors } from './_cors.js'
import { sendEmail } from './_email.js'
import { rateLimit, sendRateLimited } from './_rateLimit.js'

const EMAIL_RE = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/

export default async function handler(req, res) {
  cors(req, res, { methods: 'POST, OPTIONS', auth: false })
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const rl = rateLimit(req, { windowMs: 60 * 60_000, max: 5, prefix: 'contact' })
  if (!rl.ok) return sendRateLimited(res, rl.retryAfterSec)

  const { name, email, message, website } = req.body ?? {}

  // Honeypot : un humain laisse ce champ vide, un bot le remplit
  if (website) return res.status(200).json({ ok: true })

  const nameStr    = typeof name    === 'string' ? name.trim()    : ''
  const emailStr   = typeof email   === 'string' ? email.trim()   : ''
  const messageStr = typeof message === 'string' ? message.trim() : ''

  if (!nameStr || nameStr.length > 100)
    return res.status(400).json({ error: 'Nom invalide' })
  if (!emailStr || emailStr.length > 254 || !EMAIL_RE.test(emailStr))
    return res.status(400).json({ error: 'Email invalide' })
  if (!messageStr || messageStr.length > 2000)
    return res.status(400).json({ error: 'Message invalide' })

  const adminEmail = process.env.ADMIN_EMAIL
  if (!adminEmail) return res.status(500).json({ error: 'Configuration serveur manquante' })

  await sendEmail({
    to:      adminEmail,
    subject: `📬 Nouveau message de contact — ${nameStr}`,
    html: `
      <div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto">
        <h2 style="color:#C97B5C">Nouveau message de contact</h2>
        <table style="width:100%;border-collapse:collapse">
          <tr>
            <td style="padding:8px 0;font-weight:600;color:#555;width:100px">Nom</td>
            <td style="padding:8px 0;color:#222">${nameStr.replace(/</g, '&lt;')}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;font-weight:600;color:#555">Email</td>
            <td style="padding:8px 0;color:#222">
              <a href="mailto:${emailStr.replace(/</g, '&lt;')}">${emailStr.replace(/</g, '&lt;')}</a>
            </td>
          </tr>
        </table>
        <div style="margin-top:16px;padding:16px;background:#FAF7F2;border-radius:8px;border-left:3px solid #C97B5C">
          <p style="margin:0;white-space:pre-wrap;color:#333;line-height:1.6">${messageStr.replace(/</g, '&lt;')}</p>
        </div>
        <p style="margin-top:20px;font-size:12px;color:#999">Envoyé depuis le formulaire de contact Zenbat</p>
      </div>
    `,
  })

  return res.status(200).json({ ok: true })
}
