// Liste des factures (système « Bordereau ») : registre tracé, filtres en
// onglets, statut en petit tampon, montant TTC.
import { useState } from "react";
import { STATUT_FACTURE } from "../lib/constants.js";
import { fmt } from "../lib/utils.js";
import { ZB } from "../lib/theme.js";
import Badge from "./ui/Badge.jsx";
import { LIST_CSS, ListHeader, FilterTabs, Sheet, EmptyRow, LoadingRows, LoadErrorRow, RowMenu, RegisterRow, btnPrimary, ProTag, PlusIcon } from "./ui/Register.jsx";

const TYPE_LABEL = { acompte: "acompte", solde: "solde", avoir: "avoir" };

// loaded / loadError / onRetry : état du chargement de la liste (useInvoices).
export default function InvoicesList({ invoices, clients, goInvoice, onCreateEmpty, onDelete, isFreemium = false, onPaywall = () => {}, loaded = true, loadError = null, onRetry }) {
  const [filtre, setFiltre] = useState("tous");
  const filtered = filtre === "tous" ? invoices : invoices.filter(i => i.statut === filtre);
  const options = ["tous", "brouillon", "envoyee", "payee", "rejetee"].map(s => ({
    value: s, label: s === "tous" ? "Toutes" : STATUT_FACTURE[s].label,
  }));

  return (
    <div className="zb-list" style={{ maxWidth: 960, margin: "0 auto", padding: "16px 12px 24px", fontFamily: ZB.font, color: ZB.ink }}>
      <style>{LIST_CSS}</style>
      <ListHeader count={loaded ? `${invoices.length} facture${invoices.length > 1 ? "s" : ""}` : ""}>
        {isFreemium ? (
          <button type="button" style={btnPrimary} onClick={onPaywall}>{PlusIcon} Nouvelle facture <ProTag/></button>
        ) : (
          <button type="button" className="zb-primary" style={btnPrimary} onClick={onCreateEmpty}>{PlusIcon} Nouvelle facture</button>
        )}
      </ListHeader>

      <FilterTabs label="Filtrer par statut" options={options} value={filtre} onChange={setFiltre}/>

      <Sheet>
        {!loaded && (loadError
          ? <LoadErrorRow message="Impossible de charger tes factures." onRetry={onRetry}/>
          : <LoadingRows label="Chargement de tes factures…"/>)}
        {loaded && filtered.length === 0 && (
          <EmptyRow>
            {invoices.length === 0
              ? "Aucune facture pour l'instant. Elles se créent depuis un devis signé (bouton « Facturer »), ou à partir de zéro."
              : "Aucune facture avec ce statut."}
          </EmptyRow>
        )}
        {loaded && filtered.map((i, idx) => {
          const cl = clients.find(c => c.id === i.client_id);
          const name = cl?.raison_sociale || `${cl?.prenom || ""} ${cl?.nom || ""}`.trim() || "Sans client";
          const type = TYPE_LABEL[i.invoice_type];
          return (
            <RegisterRow key={i.id} last={idx === filtered.length - 1}
              onOpen={() => goInvoice(i.id)} openLabel={`Ouvrir la facture ${i.numero || ""}`}
              title={<span style={{ fontVariantNumeric: "tabular-nums" }}>{i.numero || "Facture brouillon"}{type && <span style={{ fontWeight: 500, color: ZB.ink2 }}> · {type}</span>}</span>}
              sub={<>{name}{i.objet && ` · ${i.objet}`}</>}
              amount={fmt(i.montant_ttc)}
              status={<Badge s={i.statut} kind="facture"/>}
              menu={<RowMenu label={`Actions pour la facture ${i.numero || ""}`} items={[
                i.statut === "brouillon" && onDelete && { key: "del", label: "Supprimer le brouillon", danger: true, confirmLabel: "Appuie encore pour supprimer", onClick: () => onDelete(i.id) },
              ]}/>}/>
          );
        })}
      </Sheet>
    </div>
  );
}
