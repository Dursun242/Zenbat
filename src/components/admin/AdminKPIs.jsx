import { useState } from "react";
import { fmtEur, pct, SC } from "../../lib/admin/format.js";

function Card({ label, value, sub, color = "#1A1612", small = false }) {
  return (
    <div style={{ background: "white", borderRadius: 14, padding: "14px 16px", boxShadow: "0 1px 4px rgba(0,0,0,.06)" }}>
      <div style={{ fontSize: 10, color: "#9A8E82", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: small ? 13 : 22, fontWeight: 800, color, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: "#cbd5e1", marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

// Hero KPI : carte plus grande, pour les 4 indicateurs critiques affichés
// systématiquement en haut du panel (pas cachables). Les chiffres utilisent
// la police Inter standard (lining numerals) — pas Syne, qui rend les
// digits en old-style figures et donne un effet italique/manuscrit.
function HeroCard({ label, value, sub, color = "#1A1612", accent = "#C97B5C" }) {
  return (
    <div style={{ background: "white", borderRadius: 14, padding: "16px 18px", boxShadow: "0 1px 4px rgba(0,0,0,.06)", borderTop: `3px solid ${accent}` }}>
      <div style={{ fontSize: 10, color: "#9A8E82", marginBottom: 6, letterSpacing: "0.5px", textTransform: "uppercase", fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 800, color, lineHeight: 1, letterSpacing: "-0.5px", fontVariantNumeric: "tabular-nums lining-nums" }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: "#9A8E82", marginTop: 6 }}>{sub}</div>}
    </div>
  );
}

export default function AdminKPIs({ stats }) {
  const [showDetails, setShowDetails] = useState(false);

  return (
    <>
      {/* 4 KPIs héros — toujours visibles, info essentielle au quotidien */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
        <HeroCard
          label="MRR" value={fmtEur(stats.users.mrr)}
          sub={`${stats.users.pro} Pro × 19 €`}
          color="#22c55e" accent="#22c55e" />
        <HeroCard
          label="Inscrits" value={stats.users.total.toLocaleString("fr-FR")}
          sub={`+${stats.users.newThisMonth} ce mois`}
          accent="#C97B5C" />
        <HeroCard
          label="Tendance 7j"
          value={stats.devis.trendDevis !== null ? `${stats.devis.trendDevis > 0 ? "+" : ""}${stats.devis.trendDevis}%` : "—"}
          sub={`${stats.devis.devisLast7} devis cette sem.`}
          color={stats.devis.trendDevis > 0 ? "#22c55e" : stats.devis.trendDevis < 0 ? "#ef4444" : "#6B6358"}
          accent={stats.devis.trendDevis > 0 ? "#22c55e" : stats.devis.trendDevis < 0 ? "#ef4444" : "#9A8E82"} />
        <HeroCard
          label="Conversion"
          value={`${stats.devis.txConversion}%`}
          sub={`${stats.devis.byStatut.accepte} acceptés / ${stats.devis.total}`}
          color="#0ea5e9" accent="#0ea5e9" />
      </div>

      {/* Lien "Voir tous les détails" pour révéler le reste des cartes + funnel + répartition */}
      <button
        onClick={() => setShowDetails(s => !s)}
        style={{
          width: "100%",
          background: "white",
          border: "1px solid #E8E2D8",
          borderRadius: 10,
          padding: "10px 14px",
          fontSize: 12,
          fontWeight: 600,
          color: "#6B6358",
          cursor: "pointer",
          marginBottom: 16,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
          fontFamily: "inherit",
        }}>
        {showDetails ? "Masquer les détails" : "Voir tous les détails"}
        <span style={{ display: "inline-block", transform: showDetails ? "rotate(180deg)" : "none", transition: "transform .15s", fontSize: 10 }}>▾</span>
      </button>

      {showDetails && (
        <>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#9A8E82", letterSpacing: "0.5px", textTransform: "uppercase", marginBottom: 8 }}>Revenus & Croissance</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
            <Card label="CA signé HT"        value={fmtEur(stats.devis.caAccepte)}   sub={`${stats.devis.byStatut.accepte} devis acceptés`}      color="#0ea5e9" small />
            <Card label="CA en cours HT"     value={fmtEur(stats.devis.caEnCours)}   sub="envoyés + signature"                                   color="#f59e0b" small />
            <Card label="Valeur moy. devis"  value={fmtEur(stats.devis.avgDevisValue)} sub="sur devis acceptés"                                  color="#7c3aed" small />
            <Card label="Inscrits mois-1"    value={stats.users.newLastMonth.toLocaleString("fr-FR")} sub="mois précédent" small />
          </div>

          <div style={{ fontSize: 10, fontWeight: 700, color: "#9A8E82", letterSpacing: "0.5px", textTransform: "uppercase", marginBottom: 8 }}>Utilisateurs</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
            <Card label="Abonnés Pro"         value={stats.users.pro.toLocaleString("fr-FR")}         sub={`${pct(stats.users.pro, stats.users.total)}% de conversion`} color="#22c55e" />
            <Card label="Actifs (≥1 devis)"   value={stats.users.activeUsers.toLocaleString("fr-FR")} sub={`${pct(stats.users.activeUsers, stats.users.total)}% des inscrits`} color="#0ea5e9" />
            <Card label="Freemium au plafond" value={(stats.users.freemiumAtCap ?? 0).toLocaleString("fr-FR")} sub="≥5 devis cette semaine — à relancer" color="#f59e0b" />
            <Card label="Appels IA total"     value={stats.users.totalAiUsed.toLocaleString("fr-FR")} sub={`moy. ${stats.users.total ? Math.round(stats.users.totalAiUsed / stats.users.total) : 0} / user`} color="#7c3aed" />
          </div>

          {/* Entonnoir */}
          <div style={{ background: "white", borderRadius: 14, padding: 16, marginBottom: 16, boxShadow: "0 1px 4px rgba(0,0,0,.06)" }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: "#1A1612", marginBottom: 14 }}>Entonnoir de conversion</div>
            {[
              { label: "Inscrits",            n: stats.funnel.inscrits,     color: "#0ea5e9" },
              { label: "Ont créé un devis",   n: stats.funnel.avecDevis,    color: "#7c3aed" },
              { label: "Ont envoyé un devis", n: stats.funnel.devisEnvoye,  color: "#f59e0b" },
              { label: "Devis accepté",       n: stats.funnel.devisAccepte, color: "#22c55e" },
            ].map((step, i, arr) => {
              const base = arr[0].n || 1;
              const w    = Math.round((step.n / base) * 100);
              return (
                <div key={step.label} style={{ marginBottom: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                    <span style={{ fontSize: 12, color: "#3D3028" }}>{step.label}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: step.color }}>{step.n} <span style={{ color: "#cbd5e1", fontWeight: 400 }}>({w}%)</span></span>
                  </div>
                  <div style={{ height: 8, background: "#F0EBE3", borderRadius: 4, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${w}%`, background: step.color, borderRadius: 4, minWidth: step.n > 0 ? 6 : 0, transition: "width .4s" }}/>
                  </div>
                  {i < arr.length - 1 && (
                    <div style={{ textAlign: "right", fontSize: 9, color: "#9A8E82", marginTop: 2 }}>
                      ↓ {arr[i + 1].n > 0 ? `${pct(arr[i + 1].n, step.n)}% passent à l'étape suivante` : "aucun"}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Statuts devis */}
          <div style={{ background: "white", borderRadius: 14, padding: 16, marginBottom: 16, boxShadow: "0 1px 4px rgba(0,0,0,.06)" }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: "#1A1612", marginBottom: 12 }}>Répartition des devis par statut</div>
            {Object.entries(stats.devis.byStatut).map(([s, n]) => (
              <div key={s} style={{ marginBottom: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                  <span style={{ fontSize: 12, color: "#3D3028" }}>{{ brouillon: "Brouillon", envoye: "Envoyé", en_signature: "En signature", accepte: "Accepté", refuse: "Refusé" }[s]}</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: SC[s] }}>{n} ({pct(n, stats.devis.total)}%)</span>
                </div>
                <div style={{ height: 6, background: "#F0EBE3", borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${pct(n, stats.devis.total)}%`, background: SC[s], borderRadius: 3, minWidth: n > 0 ? 4 : 0 }}/>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}
