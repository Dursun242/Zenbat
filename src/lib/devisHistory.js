// Construit un contexte condensé de l'historique des devis pour l'Agent IA.
// Objectif : donner à l'IA les tarifs habituels, lots récurrents et style
// de l'entreprise sans exploser la fenêtre de tokens.

const MAX_DEVIS        = 60
const TOP_OUVRAGES     = 25
const TOP_LOTS         = 10
const RECENT_DEVIS     = 6
const MIN_OCCURRENCES  = 1

const median = (arr) => {
  if (!arr.length) return 0
  const sorted = [...arr].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

const normalize = (s) => (s || "").trim().toLowerCase().replace(/\s+/g, " ")
const fmtEur   = (n) => n >= 100 ? Math.round(n) : Math.round(n * 100) / 100

export function buildDevisHistorySummary(devis) {
  if (!Array.isArray(devis) || !devis.length) return null

  // Ne garde que les devis réels avec au moins une ligne "ouvrage"
  const withLines = devis
    .filter(d => Array.isArray(d.lignes) && d.lignes.some(l => l.type_ligne === "ouvrage"))
    .slice(0, MAX_DEVIS)

  if (!withLines.length) return null

  // ── Stats globales ────────────────────────────────────────
  const total    = withLines.length
  const accepted = withLines.filter(d => d.statut === "accepte")
  const caAccept = accepted.reduce((s, d) => s + Number(d.montant_ht || 0), 0)
  const avgValue = accepted.length ? Math.round(caAccept / accepted.length) : 0
  const dates    = withLines.map(d => d.date_emission || d.created_at).filter(Boolean).sort()
  const dateFrom = dates[0]?.slice(0, 7)
  const dateTo   = dates[dates.length - 1]?.slice(0, 7)

  // ── Agrégation des ouvrages par désignation ───────────────
  const ouvrageAgg = new Map()
  for (const d of withLines) {
    for (const l of d.lignes) {
      if (l.type_ligne !== "ouvrage") continue
      const key = normalize(l.designation)
      if (!key) continue
      if (!ouvrageAgg.has(key)) {
        ouvrageAgg.set(key, {
          label: l.designation.trim(),
          unite: l.unite || "",
          prices: [],
          count: 0,
          lots: new Set(),
        })
      }
      const a = ouvrageAgg.get(key)
      a.count++
      if (l.prix_unitaire != null) a.prices.push(Number(l.prix_unitaire))
      if (l.lot) a.lots.add(l.lot)
      // Unité : garde la plus fréquente (ici la première non-vide)
      if (!a.unite && l.unite) a.unite = l.unite
    }
  }

  // ── Agrégation des lots ───────────────────────────────────
  const lotAgg = new Map()
  for (const d of withLines) {
    const seen = new Set()
    for (const l of d.lignes) {
      const lot = (l.lot || (l.type_ligne === "lot" ? l.designation : "")).trim()
      if (!lot) continue
      const key = normalize(lot)
      if (seen.has(key)) continue
      seen.add(key)
      lotAgg.set(key, { label: lot, count: (lotAgg.get(key)?.count || 0) + 1 })
    }
  }

  // ── Sélection top ──────────────────────────────────────────
  const topOuvrages = [...ouvrageAgg.values()]
    .filter(o => o.count >= MIN_OCCURRENCES)
    .sort((a, b) => b.count - a.count || b.prices.length - a.prices.length)
    .slice(0, TOP_OUVRAGES)
    .map(o => ({
      label:       o.label,
      unite:       o.unite,
      medianPrice: median(o.prices),
      count:       o.count,
    }))

  const topLots = [...lotAgg.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, TOP_LOTS)

  // ── Dernières réalisations (pour contexte qualitatif) ────
  const recentDevis = [...withLines]
    .sort((a, b) => new Date(b.date_emission || b.created_at || 0) - new Date(a.date_emission || a.created_at || 0))
    .slice(0, RECENT_DEVIS)
    .map(d => ({
      objet:    d.objet || "Devis",
      ville:    d.ville_chantier || "",
      statut:   d.statut,
      montant:  Math.round(Number(d.montant_ht || 0)),
    }))

  return {
    total, accepted: accepted.length, avgValue, dateFrom, dateTo,
    topOuvrages, topLots, recentDevis,
  }
}

// Formatte le résumé pour l'injecter dans le system prompt de Claude.
export function formatHistoryPrompt(summary) {
  if (!summary || summary.total < 1) return ""

  const lines = [
    "",
    "═══════════════════════════════════════════════════════════",
    "HISTORIQUE DE L'ENTREPRISE — RÉFÉRENCES INTERNES",
    "═══════════════════════════════════════════════════════════",
    `L'entreprise a produit ${summary.total} devis${summary.dateFrom ? ` entre ${summary.dateFrom} et ${summary.dateTo}` : ""}.`,
    summary.accepted > 0
      ? `${summary.accepted} devis accepté(s) — valeur moyenne signée : ${summary.avgValue} € HT.`
      : "",
  ].filter(Boolean)

  if (summary.topOuvrages.length) {
    lines.push("", "TARIFS HABITUELS (prix unitaires médians pratiqués par l'entreprise) :")
    for (const o of summary.topOuvrages) {
      const unit = o.unite ? ` / ${o.unite}` : ""
      const freq = o.count > 1 ? ` · ${o.count}× utilisé` : ""
      lines.push(`- ${o.label}${unit} : ${fmtEur(o.medianPrice)} €${freq}`)
    }
  }

  if (summary.topLots.length) {
    lines.push("", "LOTS / CHAPITRES FRÉQUENTS :")
    lines.push(summary.topLots.map(l => `${l.label} (${l.count}×)`).join(" · "))
  }

  if (summary.recentDevis.length) {
    lines.push("", "RÉALISATIONS RÉCENTES :")
    for (const r of summary.recentDevis) {
      const st = r.statut === "accepte" ? " ✓ signé" : r.statut === "refuse" ? " (refusé)" : ""
      const v  = r.ville ? `, ${r.ville}` : ""
      lines.push(`- ${r.objet}${v} — ${r.montant} € HT${st}`)
    }
  }

  lines.push(
    "",
    "RÈGLE D'USAGE :",
    "- Utilise ces tarifs médians comme référence pour rester cohérent avec les prix pratiqués par l'entreprise.",
    "- Si la demande actuelle correspond à une prestation déjà facturée, reprends le prix médian sauf indication contraire de l'utilisateur.",
    "- Réutilise les libellés et catégories existants pour harmoniser le style des devis.",
    "═══════════════════════════════════════════════════════════",
  )

  const MAX_HISTORY_CHARS = 5_000;
  const raw = lines.join("\n");
  if (raw.length <= MAX_HISTORY_CHARS) return raw;
  const cut = raw.lastIndexOf("\n", MAX_HISTORY_CHARS);
  return (cut > 0 ? raw.slice(0, cut) : raw.slice(0, MAX_HISTORY_CHARS)) + "\n[…historique tronqué]";
}
