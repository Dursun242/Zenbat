// Quotas journaliers par utilisateur, comptés en base (migration 0059 :
// table daily_quotas + fonctions daily_quota_consume / daily_quota_refund,
// service_role uniquement).
//
// consumeDailyQuota réserve atomiquement une unité : des requêtes parallèles
// ne peuvent pas dépasser la limite. refundDailyQuota la rend quand l'action
// a échoué (IA en erreur, email non parti…).
//
// Si la migration n'est pas appliquée (fonction absente) ou la base ne répond
// pas, on retombe sur `fallback()` quand il est fourni, sinon on laisse passer
// (mieux vaut un quota non appliqué qu'une appli bloquée).

export async function consumeDailyQuota(admin, userId, kind, limit, fallback) {
  try {
    const { data, error } = await admin.rpc('daily_quota_consume', { p_user: userId, p_kind: kind, p_limit: limit })
    if (!error) return { counter: true, allowed: data !== null && data !== undefined }
    console.warn(`[quota/${kind}] daily_quota_consume indisponible (migration 0059 ?) :`, error.code, error.message)
  } catch (e) {
    console.warn(`[quota/${kind}] daily_quota_consume :`, e?.message || e)
  }
  if (fallback) return { counter: false, allowed: await fallback() }
  return { counter: false, allowed: true }
}

export function refundDailyQuota(admin, userId, kind, reservation) {
  if (!reservation?.counter || !reservation.allowed) return
  Promise.resolve()
    .then(() => admin.rpc('daily_quota_refund', { p_user: userId, p_kind: kind }))
    .catch(() => {})
}

// Emails envoyés par un artisan depuis l'application (devis, facture, export
// comptable) : protège la boîte d'envoi partagée (Gmail ~500 mails/jour) dont
// dépendent les codes OTP et les factures de tous les utilisateurs.
export const EMAIL_DAILY_LIMIT = 60
