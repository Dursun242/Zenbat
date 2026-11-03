import { describe, it, expect } from "vitest"
import { subSummary, invoiceSummary } from "./_stripeBilling.js"

const T = (d) => Math.floor(new Date(d).getTime() / 1000)

function sub(over = {}, price = { unit_amount: 1900, recurring: { interval: "month", interval_count: 1 } }) {
  return {
    id: "sub_1", status: "active", metadata: {},
    start_date: T("2026-05-01"), cancel_at_period_end: false, cancel_at: null,
    items: { data: [{ price, current_period_start: T("2026-10-01"), current_period_end: T("2026-11-01") }] },
    ...over,
  }
}

describe("subSummary", () => {
  it("mensuel actif : prochain prélèvement, pas de fin", () => {
    const s = subSummary(sub())
    expect(s.plan).toBe("monthly")
    expect(s.monthly_eur).toBe(19)
    expect(s.renews_at).toBe("2026-11-01T00:00:00.000Z")
    expect(s.ends_at).toBeNull()
  })

  it("6 mois : fin d'accès à la fin de période, 9,50 €/mois", () => {
    const s = subSummary(sub(
      { metadata: { plan: "biannual" }, cancel_at_period_end: true },
      { unit_amount: 5700, recurring: { interval: "month", interval_count: 6 } },
    ))
    expect(s.plan).toBe("biannual")
    expect(s.monthly_eur).toBe(9.5)
    expect(s.ends_at).toBe("2026-11-01T00:00:00.000Z")
    expect(s.renews_at).toBeNull()
  })

  it("lit les dates de période sur l'abonnement (anciennes versions d'API)", () => {
    const s = subSummary(sub({ current_period_end: T("2027-01-15") }))
    expect(s.current_period_end).toBe("2027-01-15T00:00:00.000Z")
  })

  it("cancel_at explicite prime sur la fin de période", () => {
    const s = subSummary(sub({ cancel_at: T("2026-12-24") }))
    expect(s.ends_at).toBe("2026-12-24T00:00:00.000Z")
  })

  it("abonnement terminé : ni fin programmée ni renouvellement", () => {
    const s = subSummary(sub({ status: "canceled", ended_at: T("2026-09-01"), cancel_at_period_end: true }))
    expect(s.ends_at).toBeNull()
    expect(s.renews_at).toBeNull()
    expect(s.ended_at).toBe("2026-09-01T00:00:00.000Z")
  })
})

describe("invoiceSummary", () => {
  it("garde le numéro, le montant et les liens PDF / page Stripe", () => {
    const i = invoiceSummary({
      id: "in_1", number: "ABC-0001", status: "paid", total: 5700, amount_paid: 5700,
      currency: "eur", created: T("2026-05-01"),
      hosted_invoice_url: "https://invoice.stripe.com/i/x", invoice_pdf: "https://pay.stripe.com/invoice/x/pdf",
    })
    expect(i).toMatchObject({ number: "ABC-0001", total_eur: 57, invoice_pdf: "https://pay.stripe.com/invoice/x/pdf" })
  })
})
