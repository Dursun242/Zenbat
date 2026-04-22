import { useState } from "react";
import { fmt } from "../lib/utils.js";
import { b2b } from "../lib/api.js";
import Badge from "./ui/Badge.jsx";
import LignesEditor from "./LignesEditor.jsx";
import PDFViewer from "./PDFViewer.jsx";

export default function InvoiceDetail({ invoice, client, brand, onBack, onChange, onDelete }) {
  const [showPDF, setShowPDF] = useState(false);
  const [sending, setSending] = useState(false);
  const [error,   setError]   = useState(null);
  const ac = brand.color || "#22c55e";

  const lignes = invoice.lignes || [];
  const ouvrages = lignes.filter(l => l.type_ligne === "ouvrage");
  const ht   = ouvrages.reduce((s, l) => s + (Number(l.quantite) || 0) * (Number(l.prix_unitaire) || 0), 0);
  const tva  = ouvrages.reduce((s, l) => s + (Number(l.quantite) || 0) * (Number(l.prix_unitaire) || 0) * (Number(l.tva_rate) || 0) / 100, 0);
  const ttc  = ht + tva;
  const retenue = Number(invoice.retenue_garantie_eur) || 0;
  const netAPayer = ttc - retenue;

  const updateLignes = (newLignes) => {
    onChange({
      ...invoice,
      lignes: newLignes,
      montant_ht:  newLignes.filter(l => l.type_ligne === "ouvrage").reduce((s, l) => s + (Number(l.quantite) || 0) * (Number(l.prix_unitaire) || 0), 0),
    }, true);
  };

  const handleSend = async () => {
    if (invoice.locked) return;
    if (!confirm("Envoyer cette facture à la DGFiP via B2Brouter ? Cette action est irréversible — la facture sera verrouillée.")) return;
    setSending(true); setError(null);
    try {
      // S'assure qu'un compte B2Brouter existe
      await b2b.ensureAccount({
        siren: (brand.siret || "").slice(0, 9),
        name:  brand.companyName,
        email: brand.email,
        address: brand.address,
        city: brand.city?.replace(/^\d+\s*/, ""),
        postal_code: (brand.city || "").match(/\d{5}/)?.[0],
      });
      const result = await b2b.sendInvoice(invoice.id);
      onChange({
        ...invoice,
        locked: true,
        statut: "envoyee",
        b2brouter_invoice_id: result.b2brouter_id,
      }, false);
    } catch (e) {
      setError(e.message || "Erreur B2Brouter");
    } finally {
      setSending(false);
    }
  };

  // Adapte la facture au format attendu par PDFViewer (qui parle "devis")
  const asDevisShape = {
    ...invoice,
    lignes,
    montant_ht: ht,
    tva_rate: 20,
  };

  return (
    <div style={{ background: "#f8fafc", minHeight: "100%" }}>
      {showPDF && (
        <PDFViewer d={asDevisShape} cl={client} brand={brand} onClose={() => setShowPDF(false)} kind="facture"/>
      )}

      <div style={{ background: "white", borderBottom: "1px solid #f1f5f9", padding: "14px 16px", display: "flex", alignItems: "center", gap: 10 }}>
        <button onClick={onBack} style={{ background: "none", border: "none", color: "#64748b", fontSize: 20, cursor: "pointer" }}>←</button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#0f172a" }}>{invoice.numero}</div>
          <div style={{ fontSize: 11, color: "#94a3b8" }}>{invoice.objet || "—"}</div>
        </div>
        <Badge s={invoice.statut} kind="facture"/>
      </div>

      <div style={{ padding: 16 }}>
        {invoice.locked && (
          <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 12, padding: "10px 12px", marginBottom: 14, fontSize: 12, color: "#92400e" }}>
            🔒 Facture verrouillée — envoyée à la DGFiP le {invoice.b2brouter_last_event ? new Date(invoice.b2brouter_last_event).toLocaleDateString("fr-FR") : "—"}.
            {invoice.b2brouter_status && ` Statut brut : ${invoice.b2brouter_status}.`}
          </div>
        )}

        <button onClick={() => setShowPDF(true)}
          style={{ width: "100%", background: `linear-gradient(135deg,${ac}ee,${ac})`, color: "white", border: "none", borderRadius: 16, padding: 16, fontSize: 14, fontWeight: 700, cursor: "pointer", boxShadow: `0 6px 20px ${ac}44`, marginBottom: 12 }}>
          Voir le PDF de la facture
        </button>

        <LignesEditor lignes={lignes} onChange={updateLignes} ac={ac} vatRegime={brand.vatRegime}/>

        <div style={{ background: "white", borderRadius: 14, border: "1px solid #f1f5f9", padding: 14, marginBottom: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#64748b", marginBottom: 6 }}>
            <span>Total HT</span><span style={{ color: "#0f172a", fontWeight: 600 }}>{fmt(ht)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#64748b", marginBottom: 6 }}>
            <span>TVA</span><span style={{ color: "#0f172a", fontWeight: 600 }}>{fmt(tva)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, paddingTop: 6, borderTop: "1px solid #f1f5f9", marginTop: 6 }}>
            <span style={{ fontWeight: 700, color: "#0f172a" }}>Total TTC</span>
            <span style={{ fontWeight: 700, color: ac }}>{fmt(ttc)}</span>
          </div>
          {retenue > 0 && (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#b45309", marginTop: 6 }}>
                <span>Retenue de garantie {invoice.retenue_garantie_pct}%</span>
                <span>−{fmt(retenue)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, paddingTop: 6, borderTop: "1px solid #f1f5f9", marginTop: 6 }}>
                <span style={{ fontWeight: 700, color: "#0f172a" }}>Net à payer</span>
                <span style={{ fontWeight: 700, color: "#0f172a" }}>{fmt(netAPayer)}</span>
              </div>
            </>
          )}
        </div>

        {!invoice.locked && (
          <div style={{ background: "white", borderRadius: 14, border: "1px solid #f1f5f9", padding: 14, marginBottom: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#0f172a", marginBottom: 10 }}>Spécificités BTP</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <div style={{ fontSize: 10, color: "#64748b", marginBottom: 4 }}>Type d'opération</div>
                <select value={invoice.operation_type || "service"}
                  onChange={e => onChange({ ...invoice, operation_type: e.target.value }, false)}
                  style={{ width: "100%", border: "1px solid #e5e7eb", borderRadius: 8, padding: "7px 8px", fontSize: 12, background: "white" }}>
                  <option value="service">Prestation de service</option>
                  <option value="vente">Vente de biens</option>
                  <option value="mixte">Mixte</option>
                </select>
              </div>
              <div>
                <div style={{ fontSize: 10, color: "#64748b", marginBottom: 4 }}>Retenue garantie (%)</div>
                <input type="number" min="0" max="5" step="0.5"
                  value={invoice.retenue_garantie_pct || 0}
                  onChange={e => {
                    const pct = Number(e.target.value) || 0;
                    onChange({ ...invoice, retenue_garantie_pct: pct, retenue_garantie_eur: Math.round(ttc * pct) / 100 }, false);
                  }}
                  style={{ width: "100%", border: "1px solid #e5e7eb", borderRadius: 8, padding: "7px 8px", fontSize: 12 }}/>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#991b1b", padding: "10px 12px", borderRadius: 10, fontSize: 12, marginBottom: 12 }}>
            ❌ {error}
          </div>
        )}

        <div style={{ display: "flex", gap: 10 }}>
          {!invoice.locked && (
            <>
              <button onClick={onDelete}
                style={{ background: "white", border: "1px solid #fecaca", color: "#b91c1c", borderRadius: 12, padding: "12px 16px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                Supprimer
              </button>
              <button onClick={handleSend} disabled={sending || !lignes.length}
                style={{ flex: 1, background: sending || !lignes.length ? "#cbd5e1" : "#0f172a", color: "white", border: "none", borderRadius: 12, padding: "12px 16px", fontSize: 13, fontWeight: 700, cursor: sending || !lignes.length ? "not-allowed" : "pointer" }}>
                {sending ? "Envoi à la DGFiP…" : "📨 Envoyer via B2Brouter (DGFiP)"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
