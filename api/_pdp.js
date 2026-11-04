// Super PDP (plateforme agréée DGFiP) — étape 1 : connexion du compte de
// l'artisan et réception de ses factures fournisseurs.
//
// Chaque artisan relie SON compte Super PDP (OAuth 2.1 « authorization code »
// + PKCE) : Zenbat agit au nom de son SIREN, sans jamais voir son mot de passe.
// Les jetons sont chiffrés (AES-256-GCM, clé PDP_TOKEN_KEY) dans pdp_accounts
// (migration 0065), table fermée au navigateur. Le refresh token tourne à
// chaque usage : le nouveau est enregistré aussitôt (token_version).
//
// Routage depuis api/facturx.js (pas de slot Vercel en plus) :
//   GET  ?route=pdp_callback (rewrite /api/superpdp/callback) → retour OAuth
//   POST { action: 'pdp_status' | 'pdp_connect' | 'pdp_disconnect'
//          | 'pdp_inbox' | 'pdp_download' | 'pdp_event' }
//
// Spec : client PHP bluerock/superpdp-php-client (endpoints v1.beta,
// /oauth2/authorize, /oauth2/token). Les champs de en_invoice sont lus avec
// des repli (format exact à confirmer en bac à sable).

import { randomBytes, createHash, createCipheriv, createDecipheriv } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { logServerError } from './_serverLog.js'

const TIMEOUT_MS = 25_000
const STATE_TTL_MS = 15 * 60_000

export const pdpBase = () => (process.env.PDP_API_BASE || 'https://api.superpdp.tech').replace(/\/$/, '')

export function pdpConfigured() {
  return !!(process.env.PDP_CLIENT_ID && process.env.PDP_CLIENT_SECRET && process.env.PDP_TOKEN_KEY)
}

function appUrl() {
  const origins = (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean)
  if (origins.length) return origins[0].replace(/\/$/, '')
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  return 'http://localhost:5173'
}

// À déclarer tel quel dans l'application OAuth côté Super PDP.
export const redirectUri = () => process.env.PDP_REDIRECT_URI || `${appUrl()}/api/superpdp/callback`

export class PdpError extends Error {
  constructor(status, code, message, detail) {
    super(message || code)
    this.status = status
    this.code = code
    this.detail = detail
  }
}

// ─── Chiffrement des jetons ─────────────────────────────────────────────
function tokenKey() {
  const k = Buffer.from(process.env.PDP_TOKEN_KEY || '', 'base64')
  if (k.length !== 32) throw new PdpError(500, 'config', 'PDP_TOKEN_KEY doit faire 32 octets encodés en base64')
  return k
}

export function seal(plain) {
  const iv = randomBytes(12)
  const c = createCipheriv('aes-256-gcm', tokenKey(), iv)
  const enc = Buffer.concat([c.update(String(plain), 'utf8'), c.final()])
  return ['v1', iv.toString('base64'), c.getAuthTag().toString('base64'), enc.toString('base64')].join(':')
}

export function unseal(sealed) {
  const [v, iv, tag, enc] = String(sealed || '').split(':')
  if (v !== 'v1' || !iv || !tag || !enc) throw new PdpError(500, 'config', 'Jeton chiffré illisible')
  const d = createDecipheriv('aes-256-gcm', tokenKey(), Buffer.from(iv, 'base64'))
  d.setAuthTag(Buffer.from(tag, 'base64'))
  return Buffer.concat([d.update(Buffer.from(enc, 'base64')), d.final()]).toString('utf8')
}

// ─── OAuth ──────────────────────────────────────────────────────────────
const b64url = (buf) => buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

export function newPkce() {
  const verifier = b64url(randomBytes(32))
  const challenge = b64url(createHash('sha256').update(verifier).digest())
  return { verifier, challenge }
}

export function authorizeUrl({ state, challenge }) {
  const u = new URL(`${pdpBase()}/oauth2/authorize`)
  u.search = new URLSearchParams({
    response_type:         'code',
    client_id:             process.env.PDP_CLIENT_ID || '',
    redirect_uri:          redirectUri(),
    state,
    code_challenge:        challenge,
    code_challenge_method: 'S256',
  }).toString()
  return u.toString()
}

async function http(method, url, { headers = {}, body, binary = false } = {}) {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  let res
  try {
    res = await fetch(url, { method, headers, body, signal: ctrl.signal })
  } catch (e) {
    throw new PdpError(502, 'unreachable', 'Super PDP ne répond pas', e?.message)
  } finally {
    clearTimeout(t)
  }
  if (binary && res.ok) {
    return { status: res.status, buffer: Buffer.from(await res.arrayBuffer()), contentType: res.headers.get('content-type') || '' }
  }
  const text = await res.text()
  let data = null
  try { data = text ? JSON.parse(text) : null } catch { data = { raw: text.slice(0, 300) } }
  if (!res.ok) {
    const msg = data?.error_description || data?.error?.message || data?.message || (typeof data?.error === 'string' ? data.error : null)
    throw new PdpError(res.status, 'pdp_http', msg || `Super PDP HTTP ${res.status}`, data)
  }
  return { status: res.status, data }
}

async function tokenRequest(params) {
  const { data } = await http('POST', `${pdpBase()}/oauth2/token`, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: new URLSearchParams({
      client_id:     process.env.PDP_CLIENT_ID || '',
      client_secret: process.env.PDP_CLIENT_SECRET || '',
      ...params,
    }).toString(),
  })
  if (!data?.access_token) throw new PdpError(502, 'pdp_http', 'Réponse OAuth Super PDP sans access_token')
  return data
}

const expiresAt = (tok) => new Date(Date.now() + (Number(tok.expires_in) || 3600) * 1000).toISOString()

// Jeton d'accès valide de l'artisan, rafraîchi si besoin (rotation du refresh
// token : le nouveau est enregistré aussitôt, l'ancien ne marche plus).
export async function accessTokenFor(admin, userId) {
  const read = () => admin.from('pdp_accounts')
    .select('access_token_enc, refresh_token_enc, token_expires_at, token_version')
    .eq('user_id', userId).maybeSingle()
  const fresh = (a) => a?.access_token_enc && new Date(a.token_expires_at).getTime() > Date.now() + 60_000

  const { data: acc } = await read()
  if (!acc) throw new PdpError(409, 'not_connected', 'Compte Super PDP non connecté')
  if (fresh(acc)) return unseal(acc.access_token_enc)

  let tok
  try {
    tok = await tokenRequest({ grant_type: 'refresh_token', refresh_token: unseal(acc.refresh_token_enc) })
  } catch (e) {
    // Une autre requête a pu tourner le refresh token juste avant nous.
    const { data: again } = await read()
    if (again && again.token_version !== acc.token_version && fresh(again)) return unseal(again.access_token_enc)
    if (e.status === 400 || e.status === 401) throw new PdpError(401, 'reconnect', 'Connexion Super PDP expirée : reconnecte ton compte')
    throw e
  }
  await admin.from('pdp_accounts').update({
    access_token_enc:  seal(tok.access_token),
    refresh_token_enc: tok.refresh_token ? seal(tok.refresh_token) : acc.refresh_token_enc,
    token_expires_at:  expiresAt(tok),
    token_version:     acc.token_version + 1,
    updated_at:        new Date().toISOString(),
  }).eq('user_id', userId).eq('token_version', acc.token_version)
  return tok.access_token
}

async function api(token, method, path, { query, json, binary } = {}) {
  const u = new URL(`${pdpBase()}${path}`)
  if (query) for (const [k, v] of Object.entries(query)) {
    if (v == null) continue
    for (const item of [].concat(v)) u.searchParams.append(k, item)
  }
  const headers = { Authorization: `Bearer ${token}`, Accept: binary ? '*/*' : 'application/json' }
  if (json) headers['Content-Type'] = 'application/json'
  return http(method, u.toString(), { headers, body: json ? JSON.stringify(json) : undefined, binary })
}

// ─── Factures reçues ────────────────────────────────────────────────────
// Statuts du cycle de vie (norme AFNOR XP Z12-012).
export const STATUS_LABELS = {
  'fr:200': 'Déposée',          'fr:201': 'Émise',                'fr:202': 'Reçue par la plateforme',
  'fr:203': 'Mise à disposition', 'fr:204': 'Prise en charge',    'fr:205': 'Approuvée',
  'fr:206': 'Approuvée partiellement', 'fr:207': 'En litige',     'fr:208': 'Suspendue',
  'fr:209': 'Complétée',        'fr:210': 'Refusée',              'fr:211': 'Paiement transmis',
  'fr:212': 'Encaissée',        'fr:213': 'Rejetée',
}

// Statuts que l'acheteur (l'artisan) peut poser sur une facture reçue.
export const BUYER_STATUSES = ['fr:204', 'fr:205', 'fr:207', 'fr:210', 'fr:211']

const first = (...vals) => vals.find(v => v != null && v !== '')
const num = (v) => (v == null || v === '' || Number.isNaN(Number(v)) ? null : Number(v))

export function summarizeInvoice(inv) {
  const en = inv?.en_invoice || {}
  const seller = en.seller || en.seller_party || {}
  const totals = en.totals || en.document_totals || {}
  const events = [...(inv?.events || [])].sort((a, b) =>
    String(a.created_at || '').localeCompare(String(b.created_at || '')) || (a.id || 0) - (b.id || 0))
  const last = events[events.length - 1] || null
  return {
    id:           inv.id,
    created_at:   inv.created_at || null,
    number:       first(en.number, en.invoice_number) || null,
    issue_date:   first(en.issue_date, en.date) || null,
    due_date:     first(en.payment_due_date, en.due_date) || null,
    currency:     first(en.currency_code, 'EUR'),
    seller_name:  first(seller.name, seller.trading_name, seller.legal_name, en.seller_name) || null,
    seller_siren: first(seller.legal_registration_identifier?.value, seller.siren, seller.legal_registration_identifier) || null,
    total_ht:     num(first(totals.total_without_vat, totals.tax_basis_total_amount, totals.line_total_amount)),
    total_ttc:    num(first(totals.amount_due_for_payment, totals.total_with_vat, totals.grand_total_amount)),
    status:       last?.status_code || null,
    status_label: last ? (STATUS_LABELS[last.status_code] || last.status_text || last.status_code) : null,
    status_at:    last?.created_at || null,
  }
}

// ─── Points d'entrée (appelés par api/facturx.js) ────────────────────────
function adminClient() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  return url && key ? createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } }) : null
}

function redirect(res, status) {
  res.statusCode = 302
  res.setHeader('Location', `${appUrl()}/app?pdp=${status}`)
  res.end()
}

// Retour du navigateur après autorisation sur Super PDP (pas de JWT Zenbat :
// l'artisan est identifié par le `state` à usage unique créé par pdp_connect).
export async function handlePdpCallback(req, res, { admin = adminClient() } = {}) {
  const { code, state, error } = req.query || {}
  if (error) return redirect(res, 'denied')
  if (!code || !state || !admin) return redirect(res, 'error')
  try {
    const { data: row } = await admin.from('pdp_oauth_states').delete().eq('state', String(state)).select().maybeSingle()
    if (!row || Date.now() - new Date(row.created_at).getTime() > STATE_TTL_MS) return redirect(res, 'expired')

    const tok = await tokenRequest({
      grant_type: 'authorization_code', code: String(code), redirect_uri: redirectUri(), code_verifier: row.code_verifier,
    })
    const { data: company } = await api(tok.access_token, 'GET', '/v1.beta/companies/me')
    const session = await api(tok.access_token, 'GET', '/v1.beta/oauth2_sessions/me').then(r => r.data).catch(() => null)

    const { error: upErr } = await admin.from('pdp_accounts').upsert({
      user_id:             row.user_id,
      pdp_company_id:      company?.id ?? null,
      siren:               company?.number || null,
      company_name:        company?.formal_name || company?.trade_name || null,
      env:                 company?.env || null,
      verification_status: session?.company_verification_status || null,
      access_token_enc:    seal(tok.access_token),
      refresh_token_enc:   seal(tok.refresh_token || ''),
      token_expires_at:    expiresAt(tok),
      token_version:       0,
      connected_at:        new Date().toISOString(),
      updated_at:          new Date().toISOString(),
    }, { onConflict: 'user_id' })
    if (upErr) throw upErr
    return redirect(res, 'connected')
  } catch (e) {
    console.error('[pdp] callback', e?.status, e?.message, e?.detail)
    await logServerError('pdp-callback', e).catch(() => {})
    return redirect(res, 'error')
  }
}

export async function handlePdpAction(req, res, { user, admin }) {
  const body = req.body || {}
  try {
    switch (body.action) {
      case 'pdp_status': {
        const { data, error } = await admin.from('pdp_accounts')
          .select('siren, company_name, env, verification_status, connected_at')
          .eq('user_id', user.id).maybeSingle()
        if (error?.code === '42P01') return res.status(200).json({ configured: pdpConfigured(), connected: false, migration_missing: true })
        if (error) throw error
        return res.status(200).json({ configured: pdpConfigured(), connected: !!data, account: data || null })
      }

      case 'pdp_connect': {
        if (!pdpConfigured()) throw new PdpError(503, 'not_configured', 'Super PDP n\'est pas encore configuré sur Zenbat')
        const { verifier, challenge } = newPkce()
        const state = b64url(randomBytes(24))
        await admin.from('pdp_oauth_states').delete().eq('user_id', user.id)
        const { error } = await admin.from('pdp_oauth_states').insert({ state, user_id: user.id, code_verifier: verifier })
        if (error) throw error
        return res.status(200).json({ url: authorizeUrl({ state, challenge }) })
      }

      case 'pdp_disconnect': {
        const { error } = await admin.from('pdp_accounts').delete().eq('user_id', user.id)
        if (error) throw error
        return res.status(200).json({ ok: true })
      }

      case 'pdp_inbox': {
        const token = await accessTokenFor(admin, user.id)
        const after = Number.isInteger(body.after) ? body.after : null
        const { data } = await api(token, 'GET', '/v1.beta/invoices', {
          query: { direction: 'in', order: 'desc', limit: 50, starting_after_id: after, 'expand[]': 'en_invoice' },
        })
        const list = Array.isArray(data?.data) ? data.data : []
        return res.status(200).json({ invoices: list.map(summarizeInvoice), has_after: !!data?.has_after })
      }

      case 'pdp_download': {
        const id = Number(body.invoice_id)
        if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'invoice_id invalide' })
        const token = await accessTokenFor(admin, user.id)
        const { buffer, contentType } = await api(token, 'GET', `/v1.beta/invoices/${id}/download`, { binary: true })
        return res.status(200).json({ content_type: contentType, base64: buffer.toString('base64') })
      }

      case 'pdp_event': {
        const id = Number(body.invoice_id)
        if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'invoice_id invalide' })
        if (!BUYER_STATUSES.includes(body.status_code)) return res.status(400).json({ error: 'Statut non autorisé' })
        const token = await accessTokenFor(admin, user.id)
        const { data } = await api(token, 'POST', '/v1.beta/invoice_events', { json: { invoice_id: id, status_code: body.status_code } })
        return res.status(200).json({
          status:       data?.status_code || body.status_code,
          status_label: STATUS_LABELS[data?.status_code || body.status_code],
          status_at:    data?.created_at || new Date().toISOString(),
        })
      }

      default:
        return res.status(400).json({ error: 'Action Super PDP inconnue' })
    }
  } catch (e) {
    // 401 / 403 de Super PDP = accès retiré côté Super PDP : à reconnecter.
    // Renvoyé en 409 pour ne pas être pris pour une session Zenbat expirée.
    const reconnect = e?.code === 'reconnect' || (e?.code === 'pdp_http' && (e.status === 401 || e.status === 403))
    const status = reconnect ? 409
      : e instanceof PdpError ? (e.status >= 400 && e.status < 600 ? e.status : 502) : 500
    if (status >= 500) console.error('[pdp]', body.action, e?.message, e?.detail)
    return res.status(status).json({
      error: reconnect ? 'Connexion Super PDP expirée : reconnecte ton compte' : (e?.message || 'Erreur Super PDP'),
      code:  reconnect ? 'reconnect' : (e?.code || 'error'),
    })
  }
}
