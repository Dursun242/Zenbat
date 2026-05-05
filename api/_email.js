// Helper email partagé : Gmail SMTP en priorité (si GMAIL_USER + GMAIL_APP_PASSWORD),
// fallback Resend HTTP (si RESEND_API_KEY).
//
// Usage :
//   await sendEmail({ to, subject, html, cc?, fromName?, attachments? })
//
// Format attachments (uniforme pour les deux providers) :
//   [{ filename: 'foo.csv', content: '<base64-string>' }]
// Le helper convertit pour chaque provider (nodemailer = encoding:'base64',
// Resend HTTP = base64 brut).

const DEFAULT_FROM_NAME = 'Zenbat'

export async function sendEmail({ to, subject, html, cc, fromName, attachments }) {
  const gmailUser = process.env.GMAIL_USER
  const gmailPass = process.env.GMAIL_APP_PASSWORD || process.env.GMAIL_APP_PASWORD
  const displayName = fromName || DEFAULT_FROM_NAME

  if (gmailUser && gmailPass) {
    const { createTransport } = await import('nodemailer')
    const transporter = createTransport({
      host: 'smtp.gmail.com', port: 587, secure: false,
      auth: { user: gmailUser, pass: gmailPass },
    })
    const nodeAttachments = (attachments || []).map(a => ({
      filename: a.filename,
      content:  a.content,
      encoding: 'base64',
      ...(a.contentType ? { contentType: a.contentType } : {}),
    }))
    await transporter.sendMail({
      from: `${displayName} <${gmailUser}>`,
      to, subject, html,
      ...(cc ? { cc: Array.isArray(cc) ? cc.join(',') : cc } : {}),
      ...(nodeAttachments.length ? { attachments: nodeAttachments } : {}),
    })
    return { provider: 'gmail' }
  }

  const key = process.env.RESEND_API_KEY
  if (!key) throw new Error('Aucun service email configuré (GMAIL_USER+GMAIL_APP_PASSWORD ou RESEND_API_KEY)')

  const payload = {
    from:    process.env.RESEND_FROM || `${displayName} <onboarding@resend.dev>`,
    to, subject, html,
  }
  if (cc) payload.cc = Array.isArray(cc) ? cc : [cc]
  if (attachments?.length) {
    payload.attachments = attachments.map(a => ({
      filename: a.filename,
      content:  a.content, // base64
    }))
  }

  const res = await fetch('https://api.resend.com/emails', {
    method:  'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body:    JSON.stringify(payload),
  })
  if (!res.ok) {
    const e = await res.json().catch(() => ({}))
    throw new Error(e.message || `Resend ${res.status}`)
  }
  return { provider: 'resend' }
}
