// Résumés d'abonnement / de facture Stripe pour le panel admin
// (admin-stats.js ?type=stripe_health, admin-user-detail.js).
//
// Les dates de période ont migré de l'abonnement vers ses items dans les
// versions récentes de l'API Stripe (2025-03 « basil ») : on lit les deux.

const iso = (s) => (s ? new Date(s * 1000).toISOString() : null)
const eur = (cents) => (typeof cents === 'number' ? cents / 100 : null)

const LIVE = new Set(['active', 'trialing', 'past_due', 'unpaid', 'incomplete'])

export function subSummary(sub) {
  const item          = sub.items?.data?.[0]
  const recurring     = item?.price?.recurring
  const interval      = recurring?.interval || null
  const intervalCount = recurring?.interval_count || 1
  const periodStart   = sub.current_period_start ?? item?.current_period_start ?? null
  const periodEnd     = sub.current_period_end   ?? item?.current_period_end   ?? null

  // Pro 6 mois (api/stripe.js) : 57 € tous les 6 mois, annulation posée dès
  // la souscription — l'accès s'arrête à la fin de la période.
  const biannual = sub.metadata?.plan === 'biannual' || (interval === 'month' && intervalCount === 6)
  const plan = biannual ? 'biannual'
    : (sub.metadata?.plan === 'monthly' || (interval === 'month' && intervalCount === 1)) ? 'monthly'
    : null

  const months = interval === 'year' ? 12 * intervalCount : interval === 'month' ? intervalCount : null
  const amount = eur(item?.price?.unit_amount)
  const live   = LIVE.has(sub.status)
  const endsAt = sub.cancel_at ?? (sub.cancel_at_period_end ? periodEnd : null)

  return {
    id:                   sub.id,
    status:               sub.status,
    plan,
    amount_eur:           amount,
    monthly_eur:          amount != null && months ? Math.round((amount / months) * 100) / 100 : null,
    interval,
    interval_count:       intervalCount,
    started_at:           iso(sub.start_date),
    current_period_start: iso(periodStart),
    current_period_end:   iso(periodEnd),
    cancel_at_period_end: !!sub.cancel_at_period_end,
    // Fin d'accès programmée (abonnement encore actif).
    ends_at:              live && endsAt ? iso(endsAt) : null,
    // Prochain prélèvement (abonnement actif sans fin programmée).
    renews_at:            live && !endsAt ? iso(periodEnd) : null,
    canceled_at:          iso(sub.canceled_at),
    ended_at:             iso(sub.ended_at),
  }
}

export function invoiceSummary(inv) {
  return {
    id:                 inv.id,
    number:             inv.number || null,
    status:             inv.status,
    total_eur:          eur(inv.total),
    amount_paid_eur:    eur(inv.amount_paid),
    currency:           inv.currency || 'eur',
    created_at:         iso(inv.created),
    hosted_invoice_url: inv.hosted_invoice_url || null,
    invoice_pdf:        inv.invoice_pdf || null,
  }
}
