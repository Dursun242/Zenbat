// Liste des devis (système « Bordereau ») : registre tracé, filtres en
// onglets, statut en petit tampon, versions (indices) d'un même dossier
// regroupées sous la version active.
import { useState } from "react";
import { STATUT } from "../lib/constants.js";
import { fmt } from "../lib/utils.js";
import { ZB } from "../lib/theme.js";
import Badge from "./ui/Badge.jsx";
import { LIST_CSS, ListHeader, FilterTabs, Sheet, EmptyRow, RowMenu, RegisterRow, ChevronIcon } from "./ui/Register.jsx";

function clientName(c) {
  return c?.raison_sociale || `${c?.prenom || ""} ${c?.nom || ""}`.trim() || "Sans client";
}

// « envoyé il y a X j » sur un devis en attente de réponse ; au-delà de
// 7 jours, on conseille de relancer.
function sentSince(sentAt, statut) {
  if (!sentAt || !["envoye", "en_signature", "en_negociation"].includes(statut)) return null;
  const days = Math.floor((Date.now() - new Date(sentAt).getTime()) / 86400000);
  if (days < 0) return null;
  const label = days === 0 ? "envoyé aujourd'hui" : days === 1 ? "envoyé hier" : `envoyé il y a ${days} j`;
  return days > 7
    ? <span style={{ color: ZB.accent, fontWeight: 600 }}>{label} · à relancer</span>
    : <span>{label}</span>;
}

function rowMenu(d, { onDuplicate, duplicatingIds, onDelete }) {
  return (
    <RowMenu label={`Actions pour ${d.objet || d.numero}`} items={[
      onDuplicate && { key: "dup", label: duplicatingIds.has(d.id) ? "Duplication…" : "Dupliquer", disabled: duplicatingIds.has(d.id), onClick: () => onDuplicate(d.id) },
      d.statut === "brouillon" && onDelete && { key: "del", label: "Supprimer le brouillon", danger: true, confirmLabel: "Appuie encore pour supprimer", onClick: () => onDelete(d.id) },
    ]}/>
  );
}

function DevisRow({ d, cl, goDevis, last, ctx }) {
  const since = sentSince(d.sent_to_client_at, d.statut);
  return (
    <RegisterRow last={last} onOpen={() => goDevis(d.id)} openLabel={`Ouvrir le devis ${d.objet || d.numero}`}
      title={d.objet || d.numero || "Devis sans objet"}
      sub={<>{clientName(cl)}{since && <> · {since}</>}</>}
      amount={fmt(d.montant_ht)}
      status={<Badge s={d.statut} short/>}
      menu={rowMenu(d, ctx)}/>
  );
}

// Dossier à plusieurs versions : la version active en tête, les autres
// dépliables dessous.
function DossierRows({ versions, cl, goDevis, last, ctx }) {
  const [open, setOpen] = useState(false);
  const active = versions.find(v => v.statut !== "remplace") || versions[versions.length - 1];
  const others = versions.filter(v => v.id !== active.id)
    .sort((a, b) => (!b.indice ? 1 : !a.indice ? -1 : b.indice.localeCompare(a.indice)));
  const since = sentSince(active.sent_to_client_at, active.statut);
  return (
    <div style={{ borderBottom: last && !open ? "none" : `1px solid ${ZB.ruleSoft}` }}>
      <RegisterRow last onOpen={() => goDevis(active.id)} openLabel={`Ouvrir le devis ${active.objet || active.numero}`}
        title={<>{active.objet || active.numero}<span style={{ fontWeight: 500, color: ZB.ink2 }}> · indice {active.indice || "initial"}</span></>}
        sub={<>{clientName(cl)}{since && <> · {since}</>}</>}
        amount={fmt(active.montant_ht)}
        status={<Badge s={active.statut} short/>}
        menu={rowMenu(active, ctx)}/>
      <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open}
        style={{ display: "flex", alignItems: "center", gap: 6, minHeight: 40, padding: "0 16px 6px", background: "none", border: "none",
          fontFamily: "inherit", fontSize: 14, fontWeight: 600, color: ZB.accent, cursor: "pointer" }}>
        <span style={{ display: "inline-flex", transform: open ? "rotate(180deg)" : "none", transition: "transform .2s" }}>{ChevronIcon}</span>
        {open ? "Masquer" : "Voir"} les {others.length} autre{others.length > 1 ? "s" : ""} version{others.length > 1 ? "s" : ""}
      </button>
      {open && others.map((v, i) => (
        <div key={v.id} style={{ background: ZB.paper }}>
          <RegisterRow indent last={i === others.length - 1} onOpen={() => goDevis(v.id)} openLabel={`Ouvrir la version ${v.indice || "initiale"}`}
            title={<span style={{ fontWeight: 500 }}>Indice {v.indice || "initial"} · {v.numero}</span>}
            sub={null}
            amount={<span style={{ fontWeight: 500, color: ZB.ink2 }}>{fmt(v.montant_ht)}</span>}
            status={<Badge s={v.statut} short/>}
            menu={rowMenu(v, ctx)}/>
        </div>
      ))}
    </div>
  );
}

export default function DevisList({ devis, clients, goDevis, setTab, onDelete, onDuplicate }) {
  const [filtre, setFiltre] = useState("tous");
  // Devis en cours de duplication : empêche un double appui de créer deux copies.
  const [duplicatingIds, setDuplicatingIds] = useState(() => new Set());
  const wrappedDuplicate = onDuplicate ? async (id) => {
    if (duplicatingIds.has(id)) return;
    setDuplicatingIds(prev => { const n = new Set(prev); n.add(id); return n; });
    try { await onDuplicate(id); }
    finally { setDuplicatingIds(prev => { const n = new Set(prev); n.delete(id); return n; }); }
  } : null;
  const ctx = { onDuplicate: wrappedDuplicate, duplicatingIds, onDelete };

  // Groupement des versions : root_devis_id ou enfants.
  const childRoots = new Set(devis.filter(d => d.root_devis_id).map(d => d.root_devis_id));
  const items = [];
  const seen = new Set();
  for (const d of devis) {
    if (seen.has(d.id) || d.root_devis_id) continue;
    if (childRoots.has(d.id)) {
      const versions = [d, ...devis.filter(x => x.root_devis_id === d.id)]
        .sort((a, b) => !a.indice ? -1 : !b.indice ? 1 : a.indice.localeCompare(b.indice));
      versions.forEach(v => seen.add(v.id));
      items.push({ type: "group", versions });
    } else {
      seen.add(d.id);
      items.push({ type: "single", d });
    }
  }
  const statutOf = item => item.type === "single" ? item.d.statut : (item.versions.find(v => v.statut !== "remplace") || item.versions[0]).statut;
  const filtered = filtre === "tous" ? items : items.filter(item => statutOf(item) === filtre);
  const negociationCount = items.filter(item => statutOf(item) === "en_negociation").length;

  const options = ["tous", "brouillon", "envoye", "en_signature", "en_negociation", "accepte", "refuse"].map(s => ({
    value: s,
    label: s === "tous" ? "Tous" : (STATUT[s].short || STATUT[s].label),
    count: s === "en_negociation" ? negociationCount : 0,
  }));

  return (
    <div className="zb-list" style={{ maxWidth: 960, margin: "0 auto", padding: "16px 12px 24px", fontFamily: ZB.font, color: ZB.ink }}>
      <style>{LIST_CSS}</style>
      <ListHeader count={`${items.length} devis`}/>

      {negociationCount > 0 && filtre !== "en_negociation" && (
        <button type="button" onClick={() => setFiltre("en_negociation")}
          style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", minHeight: 48, marginBottom: 12, padding: "10px 14px",
            background: ZB.accentSoft, border: "none", borderRadius: 8, textAlign: "left", fontFamily: "inherit", cursor: "pointer" }}>
          <span style={{ flex: 1, fontSize: 15, color: ZB.ink }}>
            {negociationCount === 1 ? "Un client demande des modifications" : `${negociationCount} clients demandent des modifications`} : à toi de répondre.
          </span>
          <span style={{ fontSize: 15, fontWeight: 700, color: ZB.accent, flexShrink: 0 }}>Voir</span>
        </button>
      )}

      <FilterTabs label="Filtrer par statut" options={options} value={filtre} onChange={setFiltre}/>

      <Sheet>
        {filtered.length === 0 && (
          <EmptyRow>
            {items.length === 0
              ? "Aucun devis pour l'instant. Dicte ton premier devis avec le bouton Agent IA."
              : "Aucun devis avec ce statut."}
          </EmptyRow>
        )}
        {filtered.map((item, i) => {
          const last = i === filtered.length - 1;
          if (item.type === "group") {
            const cl = clients.find(c => c.id === item.versions.find(v => v.client_id)?.client_id);
            return <DossierRows key={item.versions[0].id} versions={item.versions} cl={cl} goDevis={goDevis} last={last} ctx={ctx}/>;
          }
          const cl = clients.find(c => c.id === item.d.client_id);
          return <DevisRow key={item.d.id} d={item.d} cl={cl} goDevis={goDevis} last={last} ctx={ctx}/>;
        })}
      </Sheet>
    </div>
  );
}
