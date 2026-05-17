// CRM de prospection admin — CRUD prospects + envoi email personnalisé + recherche Google Places
// Admin-only. Routage par method + action dans le body/query.
//
// GET  ?action=list                        → liste tous les prospects
// GET  ?action=get&id=xxx                  → prospect + historique emails
// GET  ?action=search_places&q=xxx         → recherche Google Places
// GET  ?action=place_details&place_id=xxx  → détails d'un lieu (tel, site, url Maps)
// POST {action:'create', ...}              → créer un prospect
// POST {action:'update', id, ...}          → modifier un prospect
// POST {action:'delete', id}               → supprimer un prospect
// POST {action:'send_email', ...}          → envoyer + logger

import { cors }         from './_cors.js'
import { authenticate } from './_withAuth.js'
import { sendEmail }    from './_email.js'

const GOOGLE_TYPES_TO_SECTEUR = {
  plumber: 'Plomberie', electrician: 'Électricité', painter: 'Peinture',
  general_contractor: 'Maçonnerie', roofing_contractor: 'Toiture',
  carpenter: 'Menuiserie', locksmith: 'Serrurerie', flooring_contractor: 'Carrelage',
  insulation_contractor: 'Isolation', heating_contractor: 'Chauffage',
}

function extractCity(address = '') {
  // "12 Rue X, 76600 Le Havre, France" → "Le Havre"
  const m = address.match(/\d{5}\s+([^,]+)/)
  return m ? m[1].trim() : ''
}

function googleTypesToSecteur(types = []) {
  for (const t of types) {
    if (GOOGLE_TYPES_TO_SECTEUR[t]) return GOOGLE_TYPES_TO_SECTEUR[t]
  }
  return ''
}

async function fetchGoogle(url) {
  const r = await fetch(url)
  if (!r.ok) throw new Error(`Google Places HTTP ${r.status}`)
  const d = await r.json()
  if (d.status !== 'OK' && d.status !== 'ZERO_RESULTS')
    throw new Error(`Google Places: ${d.status} — ${d.error_message || ''}`)
  return d
}

export default async function handler(req, res) {
  cors(req, res, { methods: 'GET, POST, OPTIONS' })
  if (req.method === 'OPTIONS') return res.status(204).end()

  const auth = await authenticate(req, res, { adminOnly: true })
  if (!auth) return
  const { admin } = auth

  const key = process.env.GOOGLE_PLACES_API_KEY

  try {
    if (req.method === 'GET') {
      const action = (req.query.action || 'list').toString()

      if (action === 'list') {
        const { data, error } = await admin
          .from('prospects')
          .select('id, nom, entreprise, email, telephone, ville, secteur, statut, notes, google_business_url, created_at, updated_at')
          .order('created_at', { ascending: false })
        if (error) throw error
        return res.status(200).json({ prospects: data })
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

      if (action === 'search_places') {
        if (!key) return res.status(503).json({ error: 'GOOGLE_PLACES_API_KEY non configurée sur Vercel' })
        const q = (req.query.q || '').toString().trim()
        if (!q) return res.status(400).json({ error: 'q requis' })
        const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(q)}&language=fr&key=${key}`
        const data = await fetchGoogle(url)
        const results = (data.results || []).slice(0, 20).map(p => ({
          place_id:   p.place_id,
          nom:        p.name,
          adresse:    p.formatted_address,
          ville:      extractCity(p.formatted_address),
          secteur:    googleTypesToSecteur(p.types || []),
          rating:     p.rating,
          nb_avis:    p.user_ratings_total,
          maps_url:   `https://www.google.com/maps/place/?q=place_id:${p.place_id}`,
        }))
        return res.status(200).json({ results })
      }

      if (action === 'place_details') {
        if (!key) return res.status(503).json({ error: 'GOOGLE_PLACES_API_KEY non configurée sur Vercel' })
        const place_id = (req.query.place_id || '').toString().trim()
        if (!place_id) return res.status(400).json({ error: 'place_id requis' })
        const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(place_id)}&fields=name,formatted_phone_number,website,url,types,formatted_address&language=fr&key=${key}`
        const data = await fetchGoogle(url)
        const r = data.result || {}
        return res.status(200).json({
          telephone: r.formatted_phone_number || '',
          website:   r.website || '',
          maps_url:  r.url || `https://www.google.com/maps/place/?q=place_id:${place_id}`,
          secteur:   googleTypesToSecteur(r.types || []),
        })
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

        await scrape(base)
        if (found.size === 0) await Promise.all([
          scrape(base + '/contact'),
          scrape(base + '/nous-contacter'),
          scrape(base + '/contactez-nous'),
          scrape(base + '/a-propos'),
        ])

        return res.status(200).json({ emails: [...found] })
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

      return res.status(400).json({ error: 'action inconnue' })
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (e) {
    console.error('[crm]', e)
    return res.status(500).json({ error: e?.message || 'Erreur serveur' })
  }
}
