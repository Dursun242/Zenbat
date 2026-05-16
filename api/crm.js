// CRM de prospection admin — CRUD prospects + envoi email personnalisé
// Admin-only. Routage par method + action dans le body/query.
//
// GET  ?action=list              → liste tous les prospects
// GET  ?action=get&id=xxx        → prospect + historique emails
// POST {action:'create', ...}    → créer un prospect
// POST {action:'update', id, ...}→ modifier un prospect
// POST {action:'delete', id}     → supprimer un prospect
// POST {action:'send_email', id, sujet, corps} → envoyer + logger

import { cors }         from './_cors.js'
import { authenticate } from './_withAuth.js'
import { sendEmail }    from './_email.js'

export default async function handler(req, res) {
  cors(req, res, { methods: 'GET, POST, OPTIONS' })
  if (req.method === 'OPTIONS') return res.status(204).end()

  const auth = await authenticate(req, res, { adminOnly: true })
  if (!auth) return
  const { admin } = auth

  try {
    if (req.method === 'GET') {
      const action = (req.query.action || 'list').toString()

      if (action === 'list') {
        const { data, error } = await admin
          .from('prospects')
          .select('id, nom, entreprise, email, telephone, ville, secteur, statut, notes, created_at, updated_at')
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

      return res.status(400).json({ error: 'action inconnue' })
    }

    if (req.method === 'POST') {
      const body   = req.body || {}
      const action = (body.action || '').toString()

      if (action === 'create') {
        const { nom, entreprise, email, telephone, ville, secteur, statut, notes } = body
        if (!nom?.trim() || !email?.trim()) return res.status(400).json({ error: 'nom et email requis' })
        const { data, error } = await admin
          .from('prospects')
          .insert({ nom: nom.trim(), entreprise, email: email.trim(), telephone, ville, secteur,
                    statut: statut || 'a_contacter', notes })
          .select()
          .single()
        if (error) throw error
        return res.status(201).json({ prospect: data })
      }

      if (action === 'update') {
        const { id, nom, entreprise, email, telephone, ville, secteur, statut, notes } = body
        if (!id) return res.status(400).json({ error: 'id requis' })
        const updates = { updated_at: new Date().toISOString() }
        if (nom         !== undefined) updates.nom         = nom?.trim() || null
        if (entreprise  !== undefined) updates.entreprise  = entreprise || null
        if (email       !== undefined) updates.email       = email?.trim() || null
        if (telephone   !== undefined) updates.telephone   = telephone || null
        if (ville       !== undefined) updates.ville       = ville || null
        if (secteur     !== undefined) updates.secteur     = secteur || null
        if (statut      !== undefined) updates.statut      = statut
        if (notes       !== undefined) updates.notes       = notes || null
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
