// CRM de prospection admin — CRUD prospects + envoi email personnalisé
// Admin-only. Routage par method + action dans le body/query.
//
// GET  ?action=list                        → liste tous les prospects
// GET  ?action=get&id=xxx                  → prospect + historique emails
// GET  ?action=scrape_email&url=xxx        → trouve un email sur un site web
// GET  ?action=list_queue                  → liste la file d'envoi
// POST {action:'create', ...}              → créer un prospect
// POST {action:'update', id, ...}          → modifier un prospect
// POST {action:'delete', id}               → supprimer un prospect
// POST {action:'send_email', ...}          → envoyer + logger
// POST {action:'schedule_bulk', emails:[]} → programmer des envois en file
// POST {action:'cancel_scheduled', id}     → annuler un envoi programmé
// POST {action:'cancel_all_pending'}       → annuler tous les envois en attente
// POST {action:'process_queue'}            → traiter la file (appelé par pg_cron, auth CRON_SECRET)

import { cors }            from './_cors.js'
import { authenticate }    from './_withAuth.js'
import { sendEmail }       from './_email.js'
import { assertPublicHost } from './_ssrf.js'
import { createClient }    from '@supabase/supabase-js'

async function processQueue(res) {
  const admin = createClient(
    process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
  const now = new Date().toISOString()
  const { data: rows, error } = await admin
    .from('scheduled_prospect_emails')
    .select('id, prospect_id, sujet, corps, corps_html, prospects!inner(nom, email, statut)')
    .eq('status', 'pending')
    .lte('send_at', now)
    .order('send_at', { ascending: true })
    .limit(1)
  if (error) throw error

  const results = []
  for (const row of rows || []) {
    const prospect = row.prospects
    const sentAt   = new Date().toISOString()
    if (!prospect?.email) {
      await admin.from('scheduled_prospect_emails')
        .update({ status: 'error', error_msg: 'Prospect sans email', sent_at: sentAt })
        .eq('id', row.id)
      results.push({ id: row.id, status: 'error' })
      continue
    }
    try {
      await sendEmail({
        to:       prospect.email,
        subject:  row.sujet,
        html:     row.corps_html || row.corps.replace(/\n/g, '<br>'),
        fromName: process.env.CRM_FROM_NAME || 'Zenbat',
      })
      await Promise.all([
        admin.from('scheduled_prospect_emails')
          .update({ status: 'sent', sent_at: sentAt }).eq('id', row.id),
        admin.from('prospect_emails')
          .insert({ prospect_id: row.prospect_id, sujet: row.sujet, corps: row.corps }),
        ...(prospect.statut === 'a_contacter' ? [
          admin.from('prospects')
            .update({ statut: 'contacte', updated_at: sentAt }).eq('id', row.prospect_id),
        ] : []),
      ])
      results.push({ id: row.id, status: 'sent' })
    } catch (e) {
      await admin.from('scheduled_prospect_emails')
        .update({ status: 'error', error_msg: e.message, sent_at: sentAt }).eq('id', row.id)
      results.push({ id: row.id, status: 'error', reason: e.message })
    }
  }
  return res.status(200).json({ processed: results.length, results })
}

export default async function handler(req, res) {
  cors(req, res, { methods: 'GET, POST, OPTIONS' })
  if (req.method === 'OPTIONS') return res.status(204).end()

  // Traitement cron — auth par CRON_SECRET (pg_cron, pas de JWT Supabase)
  if (req.method === 'POST' && req.body?.action === 'process_queue') {
    const cronSecret = process.env.CRON_SECRET
    const provided   = (req.headers.authorization || '').replace('Bearer ', '')
    if (!cronSecret || provided !== cronSecret) {
      return res.status(401).json({ error: 'Non autorisé' })
    }
    try { return await processQueue(res) }
    catch (e) { return res.status(500).json({ error: e?.message || 'Erreur serveur' }) }
  }

  const auth = await authenticate(req, res, { adminOnly: true })
  if (!auth) return
  const { admin } = auth

  try {
    if (req.method === 'GET') {
      const action = (req.query.action || 'list').toString()

      if (action === 'list') {
        // Récupère en parallèle la liste des prospects ET les prospect_id
        // ayant déjà des emails envoyés. Sert au dedup côté front pour
        // préférer garder le contact qui a un historique d'échanges quand
        // deux doublons sont détectés.
        const [{ data, error }, { data: emails }] = await Promise.all([
          admin
            .from('prospects')
            .select('id, nom, entreprise, email, telephone, ville, secteur, statut, notes, google_business_url, created_at, updated_at')
            .order('created_at', { ascending: false }),
          admin.from('prospect_emails').select('prospect_id'),
        ])
        if (error) throw error
        const withEmails = new Set((emails || []).map(e => e.prospect_id))
        const enriched = (data || []).map(p => ({ ...p, has_emails: withEmails.has(p.id) }))
        return res.status(200).json({ prospects: enriched })
      }

      if (action === 'get') {
        const id = req.query.id?.toString()
        if (!id) return res.status(400).json({ error: 'id requis' })
        const [{ data: p, error: pe }, { data: emails, error: ee }] = await Promise.all([
          admin.from('prospects').select('*').eq('id', id).single(),
          admin.from('prospect_emails').select('*').eq('prospect_id', id).order('sent_at', { ascending: false }),
        ])
        if (pe) throw pe
        if (ee) throw ee
        return res.status(200).json({ prospect: p, emails: emails || [] })
      }

      if (action === 'scrape_email') {
        const rawUrl = (req.query.url || '').toString().trim()
        if (!rawUrl) return res.status(400).json({ error: 'url requise' })

        const EMAIL_RE = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g
        const IGNORE   = ['png','jpg','jpeg','gif','svg','woff','css','js','example','sentry','wix','wordpress','schema','google','w3.org']
        const found    = new Set()

        const scrape = async (pageUrl) => {
          try {
            const ac = new AbortController()
            const t  = setTimeout(() => ac.abort(), 6000)
            const r  = await fetch(pageUrl, {
              signal: ac.signal,
              headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Zenbat/1.0 contact-finder)' }
            })
            clearTimeout(t)
            if (!r.ok) return
            if (!(r.headers.get('content-type') || '').includes('text')) return
            const html = await r.text()
            const decoded = html
              .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
              .replace(/&amp;/g, '&')
              .replace(/\[at\]/gi, '@').replace(/\(at\)/gi, '@')
              .replace(/\[dot\]/gi, '.').replace(/\(dot\)/gi, '.')
            ;(decoded.match(EMAIL_RE) || []).forEach(e => {
              const low = e.toLowerCase()
              if (!IGNORE.some(x => low.includes(x)) && low.includes('.')) found.add(low)
            })
          } catch {}
        }

        let base = rawUrl
        if (!base.startsWith('http')) base = 'https://' + base
        base = base.replace(/\/$/, '')

        // Protection SSRF : refuse les hôtes internes ou résolvant vers une
        // IP privée (metadata cloud, localhost, RFC1918…). Toutes les
        // sous-pages scrapées partagent le même hôte que `base`.
        let host
        try { host = new URL(base).hostname }
        catch { return res.status(400).json({ error: 'URL invalide' }) }
        try { await assertPublicHost(host) }
        catch { return res.status(400).json({ error: 'Domaine non autorisé' }) }

        await scrape(base)
        if (found.size === 0) await Promise.all([
          scrape(base + '/contact'),
          scrape(base + '/nous-contacter'),
          scrape(base + '/contactez-nous'),
          scrape(base + '/a-propos'),
        ])

        return res.status(200).json({ emails: [...found] })
      }

      if (action === 'list_queue') {
        const { data, error } = await admin
          .from('scheduled_prospect_emails')
          .select('id, sujet, send_at, status, error_msg, sent_at, prospect_id, prospects(nom, email)')
          .order('send_at', { ascending: true })
          .limit(500)
        if (error) throw error
        const queue = (data || []).map(x => ({
          id: x.id, sujet: x.sujet, send_at: x.send_at, status: x.status,
          error_msg: x.error_msg, sent_at: x.sent_at, prospect_id: x.prospect_id,
          prospect_nom: x.prospects?.nom, prospect_email: x.prospects?.email,
        }))
        return res.status(200).json({ queue })
      }

      return res.status(400).json({ error: 'action inconnue' })
    }

    if (req.method === 'POST') {
      const body   = req.body || {}
      const action = (body.action || '').toString()

      if (action === 'create') {
        const { nom, entreprise, email, telephone, ville, secteur, statut, notes, google_business_url } = body
        if (!nom?.trim() || !email?.trim()) return res.status(400).json({ error: 'nom et email requis' })
        const { data, error } = await admin
          .from('prospects')
          .insert({ nom: nom.trim(), entreprise, email: email.trim(), telephone, ville, secteur,
                    statut: statut || 'a_contacter', notes, google_business_url: google_business_url || null })
          .select()
          .single()
        if (error) throw error
        return res.status(201).json({ prospect: data })
      }

      if (action === 'update') {
        const { id, nom, entreprise, email, telephone, ville, secteur, statut, notes, google_business_url } = body
        if (!id) return res.status(400).json({ error: 'id requis' })
        const updates = { updated_at: new Date().toISOString() }
        if (nom                 !== undefined) updates.nom                 = nom?.trim() || null
        if (entreprise          !== undefined) updates.entreprise          = entreprise || null
        if (email               !== undefined) updates.email               = email?.trim() || null
        if (telephone           !== undefined) updates.telephone           = telephone || null
        if (ville               !== undefined) updates.ville               = ville || null
        if (secteur             !== undefined) updates.secteur             = secteur || null
        if (statut              !== undefined) updates.statut              = statut
        if (notes               !== undefined) updates.notes               = notes || null
        if (google_business_url !== undefined) updates.google_business_url = google_business_url || null
        const { data, error } = await admin
          .from('prospects')
          .update(updates)
          .eq('id', id)
          .select()
          .single()
        if (error) throw error
        return res.status(200).json({ prospect: data })
      }

      if (action === 'delete') {
        const { id } = body
        if (!id) return res.status(400).json({ error: 'id requis' })
        const { error } = await admin.from('prospects').delete().eq('id', id)
        if (error) throw error
        return res.status(200).json({ ok: true })
      }

      if (action === 'send_email') {
        const { id, sujet, corps, corps_html } = body
        if (!id || !sujet?.trim() || !corps?.trim())
          return res.status(400).json({ error: 'id, sujet et corps requis' })

        const { data: prospect, error: pe } = await admin
          .from('prospects')
          .select('nom, email, entreprise, ville, secteur, statut')
          .eq('id', id)
          .single()
        if (pe) throw pe

        // Utilise le HTML complet généré côté client si dispo, sinon fallback texte basique
        const html = corps_html || corps.replace(/\n/g, '<br>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')

        await sendEmail({
          to:      prospect.email,
          subject: sujet.trim(),
          html,
          fromName: process.env.CRM_FROM_NAME || 'Zenbat',
        })

        // Logger l'envoi
        await admin.from('prospect_emails').insert({
          prospect_id: id,
          sujet:       sujet.trim(),
          corps:       corps.trim(),
        })

        // Passer le statut à "contacte" si encore à "a_contacter"
        if (prospect.statut === 'a_contacter') {
          await admin.from('prospects').update({ statut: 'contacte', updated_at: new Date().toISOString() }).eq('id', id)
        }

        return res.status(200).json({ ok: true })
      }

      if (action === 'schedule_bulk') {
        const { emails } = body
        if (!Array.isArray(emails) || emails.length === 0)
          return res.status(400).json({ error: 'emails[] requis' })
        const rows = emails.map(e => ({
          prospect_id: e.id,
          sujet:       e.sujet?.trim(),
          corps:       e.corps?.trim(),
          corps_html:  e.corps_html || null,
          send_at:     e.send_at,
          status:      'pending',
        }))
        const { data, error } = await admin
          .from('scheduled_prospect_emails')
          .insert(rows)
          .select('id')
        if (error) throw error
        return res.status(200).json({ scheduled: data.length })
      }

      if (action === 'cancel_scheduled') {
        const { id } = body
        if (!id) return res.status(400).json({ error: 'id requis' })
        const { error } = await admin
          .from('scheduled_prospect_emails')
          .update({ status: 'cancelled' })
          .eq('id', id)
          .eq('status', 'pending')
        if (error) throw error
        return res.status(200).json({ ok: true })
      }

      if (action === 'cancel_all_pending') {
        const { error } = await admin
          .from('scheduled_prospect_emails')
          .update({ status: 'cancelled' })
          .eq('status', 'pending')
        if (error) throw error
        return res.status(200).json({ ok: true })
      }

      return res.status(400).json({ error: 'action inconnue' })
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (e) {
    console.error('[crm]', e)
    return res.status(500).json({ error: e?.message || 'Erreur serveur' })
  }
}
