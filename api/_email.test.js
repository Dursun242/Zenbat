// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const { sendMailMock, createTransportMock } = vi.hoisted(() => {
  const sendMailMock = vi.fn(async () => ({ messageId: 'm1' }))
  return { sendMailMock, createTransportMock: vi.fn(() => ({ sendMail: sendMailMock })) }
})
vi.mock('nodemailer', () => ({ createTransport: createTransportMock }))

import { sendEmail, escapeHtml, safeColor, safeImageSrc } from './_email.js'

const ENV = ['GMAIL_USER', 'GMAIL_APP_PASSWORD', 'GMAIL_APP_PASWORD', 'RESEND_API_KEY', 'RESEND_FROM']
let snap, fetchMock

beforeEach(() => {
  snap = Object.fromEntries(ENV.map(k => [k, process.env[k]]))
  for (const k of ENV) delete process.env[k]
  fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ id: 'r1' }) }))
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => {
  for (const k of ENV) {
    if (snap[k] === undefined) delete process.env[k]
    else process.env[k] = snap[k]
  }
  vi.unstubAllGlobals()
  vi.useRealTimers()
  vi.clearAllMocks()
})

const ATTACHMENTS = [
  { filename: 'facture.pdf', content: 'JVBERi0=', contentType: 'application/pdf' },
  { filename: 'logo.png', content: 'iVBORw0=', contentType: 'image/png', cid: 'logo@zenbat' },
]
const resendPayload = () => JSON.parse(fetchMock.mock.calls[0][1].body)

describe('sendEmail — choix du fournisseur', () => {
  it('sans aucune configuration → erreur explicite, aucun envoi', async () => {
    await expect(sendEmail({ to: 'a@b.fr', subject: 's', html: 'h' }))
      .rejects.toThrow(/Aucun service email configuré/)
    expect(createTransportMock).not.toHaveBeenCalled()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('GMAIL_USER seul (sans mot de passe) et pas de Resend → erreur, Gmail non tenté', async () => {
    process.env.GMAIL_USER = 'zenbat@gmail.com'
    await expect(sendEmail({ to: 'a@b.fr', subject: 's', html: 'h' })).rejects.toThrow(/Aucun service/)
    expect(createTransportMock).not.toHaveBeenCalled()
  })

  it('Gmail et Resend configurés → Gmail prioritaire, Resend non appelé', async () => {
    process.env.GMAIL_USER = 'zenbat@gmail.com'
    process.env.GMAIL_APP_PASSWORD = 'pass'
    process.env.RESEND_API_KEY = 're_x'
    await expect(sendEmail({ to: 'a@b.fr', subject: 's', html: 'h' })).resolves.toEqual({ provider: 'gmail' })
    expect(createTransportMock).toHaveBeenCalledWith({
      host: 'smtp.gmail.com', port: 587, secure: false,
      auth: { user: 'zenbat@gmail.com', pass: 'pass' },
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('variable mal orthographiée GMAIL_APP_PASWORD acceptée en secours', async () => {
    process.env.GMAIL_USER = 'zenbat@gmail.com'
    process.env.GMAIL_APP_PASWORD = 'typo'
    await expect(sendEmail({ to: 'a@b.fr', subject: 's', html: 'h' })).resolves.toEqual({ provider: 'gmail' })
    expect(createTransportMock.mock.calls[0][0].auth.pass).toBe('typo')
  })

  it('Resend seul → envoi HTTP avec la clé', async () => {
    process.env.RESEND_API_KEY = 're_x'
    await expect(sendEmail({ to: 'a@b.fr', subject: 's', html: 'h' })).resolves.toEqual({ provider: 'resend' })
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://api.resend.com/emails')
    expect(init.method).toBe('POST')
    expect(init.headers.Authorization).toBe('Bearer re_x')
    expect(init.signal).toBeInstanceOf(AbortSignal)
  })
})

describe('sendEmail — Gmail (nodemailer)', () => {
  beforeEach(() => {
    process.env.GMAIL_USER = 'zenbat@gmail.com'
    process.env.GMAIL_APP_PASSWORD = 'pass'
  })

  it('pièces jointes en base64 avec type et cid, cc liste jointe, replyTo, nom d’expéditeur', async () => {
    await sendEmail({
      to: 'client@x.fr', subject: 'Facture', html: '<img src="cid:logo@zenbat">',
      cc: ['a@x.fr', 'b@x.fr'], replyTo: 'artisan@x.fr', fromName: 'ACME', attachments: ATTACHMENTS,
    })
    expect(sendMailMock).toHaveBeenCalledWith({
      from: 'ACME <zenbat@gmail.com>',
      to: 'client@x.fr', subject: 'Facture', html: '<img src="cid:logo@zenbat">',
      cc: 'a@x.fr,b@x.fr',
      replyTo: 'artisan@x.fr',
      attachments: [
        { filename: 'facture.pdf', content: 'JVBERi0=', encoding: 'base64', contentType: 'application/pdf' },
        { filename: 'logo.png', content: 'iVBORw0=', encoding: 'base64', contentType: 'image/png', cid: 'logo@zenbat' },
      ],
    })
  })

  it('champs optionnels absents → non transmis, expéditeur par défaut Zenbat', async () => {
    await sendEmail({ to: 'client@x.fr', subject: 's', html: 'h' })
    const mail = sendMailMock.mock.calls[0][0]
    expect(mail.from).toBe('Zenbat <zenbat@gmail.com>')
    expect(mail).not.toHaveProperty('cc')
    expect(mail).not.toHaveProperty('replyTo')
    expect(mail).not.toHaveProperty('attachments')
  })

  it('erreur SMTP → propagée telle quelle', async () => {
    sendMailMock.mockRejectedValueOnce(new Error('535 Invalid login'))
    await expect(sendEmail({ to: 'a@b.fr', subject: 's', html: 'h' })).rejects.toThrow('535 Invalid login')
  })
})

describe('sendEmail — Resend (HTTP)', () => {
  beforeEach(() => { process.env.RESEND_API_KEY = 're_x' })

  it('pièces jointes avec content_id, cc et reply_to en tableaux', async () => {
    await sendEmail({
      to: 'client@x.fr', subject: 'Facture', html: 'h',
      cc: 'a@x.fr', replyTo: 'artisan@x.fr', fromName: 'ACME', attachments: ATTACHMENTS,
    })
    expect(resendPayload()).toEqual({
      from: 'ACME <onboarding@resend.dev>',
      to: 'client@x.fr', subject: 'Facture', html: 'h',
      cc: ['a@x.fr'],
      reply_to: ['artisan@x.fr'],
      attachments: [
        { filename: 'facture.pdf', content: 'JVBERi0=' },
        { filename: 'logo.png', content: 'iVBORw0=', content_id: 'logo@zenbat' },
      ],
    })
  })

  it('RESEND_FROM prioritaire sur le nom d’expéditeur', async () => {
    process.env.RESEND_FROM = 'Zenbat <factures@zenbat.fr>'
    await sendEmail({ to: 'a@b.fr', subject: 's', html: 'h', fromName: 'ACME' })
    expect(resendPayload().from).toBe('Zenbat <factures@zenbat.fr>')
  })

  it('réponse en erreur → message de Resend remonté', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 422, json: async () => ({ message: 'Invalid `to` field' }) })
    await expect(sendEmail({ to: 'x', subject: 's', html: 'h' })).rejects.toThrow('Invalid `to` field')
  })

  it('réponse en erreur sans corps JSON → statut HTTP dans le message', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 503, json: async () => { throw new Error('not json') } })
    await expect(sendEmail({ to: 'a@b.fr', subject: 's', html: 'h' })).rejects.toThrow('Resend 503')
  })

  it('Resend muet plus de 8 s → abandon avec un message clair', async () => {
    vi.useFakeTimers()
    fetchMock.mockImplementationOnce((_url, { signal }) => new Promise((_res, rej) => {
      signal.addEventListener('abort', () => rej(Object.assign(new Error('aborted'), { name: 'AbortError' })))
    }))
    const p = sendEmail({ to: 'a@b.fr', subject: 's', html: 'h' })
    const assertion = expect(p).rejects.toThrow(/Resend timeout \(8s\)/)
    await vi.advanceTimersByTimeAsync(8000)
    await assertion
  })

  it('erreur réseau → propagée', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('fetch failed'))
    await expect(sendEmail({ to: 'a@b.fr', subject: 's', html: 'h' })).rejects.toThrow('fetch failed')
  })
})

describe('assainissement du HTML des emails', () => {
  it('escapeHtml', () => {
    expect(escapeHtml(`<a href="x">'&'</a>`)).toBe('&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;')
    expect(escapeHtml(null)).toBe('')
  })
  it('safeColor : hexadécimal seulement', () => {
    expect(safeColor(' #A4461F ')).toBe('#A4461F')
    expect(safeColor('red"><script>')).toBe('#22c55e')
    expect(safeColor('#abc', '#000')).toBe('#abc')
  })
  it('safeImageSrc : cid ou http(s), jamais javascript:/data:', () => {
    expect(safeImageSrc('cid:logo@zenbat')).toBe('cid:logo@zenbat')
    expect(safeImageSrc('javascript:alert(1)')).toBeNull()
    expect(safeImageSrc('data:image/png;base64,AAA')).toBeNull()
    expect(safeImageSrc('https://x.fr/a.png?a=1&b="2"')).toBe('https://x.fr/a.png?a=1&amp;b=%222%22')
  })
})
