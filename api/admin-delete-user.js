import { cors } from "./_cors.js"
import { authenticate, notifyTelegram } from "./_withAuth.js"

export default async function handler(req, res) {
  cors(req, res, { methods: "POST, OPTIONS" })
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const auth = await authenticate(req, res, { adminOnly: true })
    if (!auth) return
    const { user, admin } = auth

    // Validation payload
    const { userId, confirmEmail, mode = 'delete' } = req.body || {}
    if (!userId || typeof userId !== 'string')
      return res.status(400).json({ error: 'userId manquant ou invalide' })
    if (mode !== 'delete' && mode !== 'reset_data')
      return res.status(400).json({ error: 'mode invalide (delete | reset_data)' })
    if (mode === 'delete' && userId === user.id)
      return res.status(400).json({ error: 'Un administrateur ne peut pas supprimer son propre compte' })

    // Récupère la cible pour double-vérification par email
    const { data: targetData, error: targetErr } = await admin.auth.admin.getUserById(userId)
    if (targetErr || !targetData?.user)
      return res.status(404).json({ error: 'Utilisateur introuvable' })
    const target = targetData.user

    if (confirmEmail && target.email && confirmEmail.trim().toLowerCase() !== target.email.toLowerCase())
      return res.status(400).json({ error: "L'email de confirmation ne correspond pas" })

    // ── Mode reset_data : on supprime devis + factures, on garde le compte ──
    if (mode === 'reset_data') {
      // Compte avant pour log/retour
      const [{ count: devisCount }, { count: invoicesCount }] = await Promise.all([
        admin.from('devis').select('id', { count: 'exact', head: true }).eq('owner_id', userId),
        admin.from('invoices').select('id', { count: 'exact', head: true }).eq('owner_id', userId),
      ])

      // Cascade : lignes_devis et lignes_invoices ont ON DELETE CASCADE
      // donc supprimer le parent suffit. On purge dans l'ordre invoices → devis
      // car invoices.devis_id pointe vers devis (en SET NULL, mais on évite le bruit).
      const { error: invErr } = await admin.from('invoices').delete().eq('owner_id', userId)
      if (invErr) return res.status(500).json({ error: `Échec suppression factures : ${invErr.message}` })
      const { error: devErr } = await admin.from('devis').delete().eq('owner_id', userId)
      if (devErr) return res.status(500).json({ error: `Échec suppression devis : ${devErr.message}` })

      // Best-effort : nettoyage des PDF stockés
      try {
        const { data: files } = await admin.storage.from('devis-pdfs').list(userId, { limit: 1000 })
        if (files?.length) {
          await admin.storage.from('devis-pdfs').remove(files.map(f => `${userId}/${f.name}`))
        }
      } catch (e) {
        console.warn('[admin-delete-user] storage cleanup (reset):', e?.message)
      }

      await notifyTelegram('raw', {
        text: `🧹 Données reset par admin · ${target.email || userId} · ${devisCount ?? 0} devis + ${invoicesCount ?? 0} factures supprimés`,
      })

      return res.status(200).json({
        ok: true,
        mode: 'reset_data',
        deleted: { devis: devisCount ?? 0, invoices: invoicesCount ?? 0 },
        user: { id: userId, email: target.email },
      })
    }

    // ── Mode delete : suppression complète du compte ────────────────────────

    // Purge ciblée des tables qui référencent auth.users sans ON DELETE CASCADE
    // (ia_* / activity_log ont on delete set null, mais on veut effacer
    // aussi leur contenu pour une vraie suppression RGPD — SET NULL laisserait
    // les messages de l'utilisateur visibles côté admin après suppression).
    const purgeTables = [
      'ia_conversations',
      'ia_error_logs',
      'ia_negative_logs',
      'activity_log',
    ]
    for (const t of purgeTables) {
      try {
        await admin.from(t).delete().eq('owner_id', userId)
      } catch (e) {
        console.warn(`[admin-delete-user] purge ${t}:`, e?.message)
      }
    }

    // Nettoyage des PDF dans le bucket (best-effort, non bloquant)
    try {
      const { data: files } = await admin.storage.from('devis-pdfs').list(userId, { limit: 1000 })
      if (files?.length) {
        const paths = files.map(f => `${userId}/${f.name}`)
        await admin.storage.from('devis-pdfs').remove(paths)
      }
    } catch (e) {
      console.warn('[admin-delete-user] storage cleanup:', e?.message)
    }

    // Récupère le plan avant suppression pour la notif Telegram
    const { data: planRow } = await admin.from('profiles').select('plan').eq('id', userId).maybeSingle()

    // Suppression du compte — cascade sur profiles → clients, devis, lignes_devis
    const { error: delErr } = await admin.auth.admin.deleteUser(userId)
    if (delErr) {
      console.error('[admin-delete-user] deleteUser failed:', delErr)
      return res.status(500).json({
        error: delErr.message || 'Échec suppression compte auth',
        code:  delErr.code || delErr.status || null,
      })
    }

    await notifyTelegram('account_deleted', {
      email: target.email || null,
      plan:  planRow?.plan || null,
      by:    'admin',
    })

    return res.status(200).json({
      ok: true,
      deleted: { id: userId, email: target.email },
    })
  } catch (err) {
    // Filet de sécurité : toute exception non gérée remonte un message
    // exploitable côté client au lieu d'un 500 muet.
    console.error('[admin-delete-user] unhandled:', err)
    return res.status(500).json({
      error: err?.message || String(err) || 'Erreur interne inconnue',
      stack: process.env.VERCEL_ENV === 'production' ? undefined : (err?.stack || null),
    })
  }
}
