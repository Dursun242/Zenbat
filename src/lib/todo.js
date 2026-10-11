// Liste « À faire » de l'accueil : ce que l'artisan doit faire maintenant,
// du plus urgent au moins urgent. Fonction pure (testée dans todo.test.js).
//
// Priorités :
//   1. un client demande des modifications sur un devis
//   2. une facture émise a dépassé son échéance
//   3. un devis envoyé depuis plus de 7 jours, sans réponse : relancer
//   4. un devis signé sans facture : facturer
//   5. une facture émise en attente de paiement
//   6. un brouillon à terminer et envoyer
//   7. le profil de l'entreprise incomplet (mentions obligatoires)
import { brandCompleteness } from "./brandCompleteness.js";

const DAY = 86400000;
const WAITING = ["envoye", "en_signature"];

export function clientLabel(c) {
  return c?.raison_sociale || `${c?.prenom || ""} ${c?.nom || ""}`.trim() || "ton client";
}

const daysSince = (date, now) => (date ? Math.floor((now - new Date(date).getTime()) / DAY) : null);

export function todoItems({ devis = [], invoices = [], clients = [], brand = {}, now = Date.now() }) {
  const byId = new Map(clients.map(c => [c.id, c]));
  const items = [];
  // Une seule version par dossier : on ignore les versions remplacées.
  const live = devis.filter(d => d.statut !== "remplace");

  for (const d of live) {
    const cl = byId.get(d.client_id);
    if (d.statut === "en_negociation") {
      items.push({ key: `neg-${d.id}`, rank: 1, kind: "devis", id: d.id,
        title: `${clientLabel(cl)} demande des modifications`, sub: d.objet || d.numero, amount: d.montant_ht, amountLabel: "HT" });
    } else if (WAITING.includes(d.statut)) {
      const days = daysSince(d.sent_to_client_at, now);
      if (days != null && days > 7) {
        items.push({ key: `rel-${d.id}`, rank: 3, kind: "devis", id: d.id, sort: -days,
          title: `Relancer ${clientLabel(cl)}`, sub: `${d.objet || d.numero} · envoyé il y a ${days} jours`, amount: d.montant_ht, amountLabel: "HT" });
      }
    } else if (d.statut === "accepte") {
      const invoiced = invoices.some(i => i.devis_id && i.devis_id === d.id && i.statut !== "annulee");
      if (!invoiced) {
        items.push({ key: `fac-${d.id}`, rank: 4, kind: "devis", id: d.id,
          title: `Facturer ${clientLabel(cl)}`, sub: `${d.objet || d.numero} · devis signé`, amount: d.montant_ht, amountLabel: "HT" });
      }
    } else if (d.statut === "brouillon" && (d.lignes?.length || Number(d.montant_ht) > 0)) {
      items.push({ key: `brl-${d.id}`, rank: 6, kind: "devis", id: d.id,
        title: `Terminer et envoyer : ${d.objet || d.numero || "devis"}`, sub: cl ? clientLabel(cl) : "Client à choisir", amount: d.montant_ht, amountLabel: "HT" });
    }
  }

  for (const i of invoices) {
    if (i.statut !== "envoyee") continue;
    const cl = byId.get(i.client_id);
    const late = i.date_echeance ? daysSince(i.date_echeance, now) : null;
    if (late != null && late > 0) {
      items.push({ key: `ret-${i.id}`, rank: 2, kind: "facture", id: i.id, sort: -late,
        title: `Paiement en retard : ${clientLabel(cl)}`, sub: `${i.numero} · échéance dépassée de ${late} jour${late > 1 ? "s" : ""}`, amount: i.montant_ttc, amountLabel: "TTC" });
    } else {
      items.push({ key: `pay-${i.id}`, rank: 5, kind: "facture", id: i.id,
        title: `Paiement attendu : ${clientLabel(cl)}`, sub: i.numero, amount: i.montant_ttc, amountLabel: "TTC" });
    }
  }

  const { missingCritical } = brandCompleteness(brand);
  if (missingCritical.length > 0) {
    const names = missingCritical.slice(0, 3).map(f => f.label).join(", ");
    items.push({ key: "profil", rank: 7, kind: "profil",
      title: "Compléter ton profil",
      sub: `${names}${missingCritical.length > 3 ? "…" : ""} : obligatoire sur un devis` });
  }

  return items.sort((a, b) => a.rank - b.rank || (a.sort || 0) - (b.sort || 0));
}

// Montants en cours, pour le récapitulatif de l'accueil.
export function ledger({ devis = [], invoices = [] }) {
  const sum = (arr, k) => Math.round(arr.reduce((s, x) => s + (Number(x[k]) || 0), 0) * 100) / 100;
  const live = devis.filter(d => d.statut !== "remplace");
  return {
    enAttente: sum(live.filter(d => [...WAITING, "en_negociation"].includes(d.statut)), "montant_ht"),
    // Signé et pas encore facturé : une fois facturé, le montant passe dans « à encaisser ».
    signe:     sum(live.filter(d => d.statut === "accepte" && !invoices.some(i => i.devis_id && i.devis_id === d.id && i.statut !== "annulee")), "montant_ht"),
    aEncaisser: sum(invoices.filter(i => i.statut === "envoyee"), "montant_ttc"),
  };
}
