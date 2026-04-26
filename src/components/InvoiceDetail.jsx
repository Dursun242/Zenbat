import { useState } from "react";
import { fmt } from "../lib/utils.js";
import Badge from "./ui/Badge.jsx";
import LignesEditor from "./LignesEditor.jsx";
import PDFViewer from "./PDFViewer.jsx";
import ClientPickerModal from "./app/ClientPickerModal.jsx";
import { getToken } from "../lib/getToken.js";

export default function InvoiceDetail({ invoice, client, clients = [], brand, invoices, onBack, onChange, onCreateAvoir, onDelete }) {
  const [showPDF,      setShowPDF]      = useState(false);
  const [exporting,    setExporting]    = useState(false);
  const [exportMsg,    setExportMsg]    = useState(null);
  const [clientPicker, setClientPicker] = useState(false);
  const ac = brand.color || "#22c55e";

  const lignes = invoice.lignes || [];
  const ouvrages = lignes.filter(l => l.type_ligne === "ouvrage");
  const franchise = brand.vatRegime === "franchise";
  const ht   = ouvrages.reduce((s, l) => s + (Number(l.quantite) || 0) * (Number(l.prix_unitaire) || 0), 0);
  const tva  = ouvrages.reduce((s, l) => s + (Number(l.quantite) || 0) * (Number(l.prix_unitaire) || 0) * Number(l.tva_rate ?? (franchise ? 0 : 20)) / 100, 0);
  const ttc  = ht + tva;
  const retenue = Number(invoice.retenue_garantie_eur) || 0;
  const netAPayer = ttc - retenue;
  // Conformité fiscale : une facture émise est immuable (CGI art. 289).
  // Le verrou est posé côté serveur par le trigger autolock_invoice_on_emission().
  const isLocked = !!invoice.locked || invoice.statut !== "brouillon";
  const isAvoir  = !!invoice.avoir_of_invoice_id;
  const sourceInvoice = isAvoir && Array.isArray(invoices)
    ? invoices.find(x => x.id === invoice.avoir_of_invoice_id)
    : null;

  const updateLignes = (newLignes) => {
    if (isLocked) return;
    onChange({
      ...invoice,
      lignes: newLignes,
      montant_ht:  newLignes.filter(l => l.type_ligne === "ouvrage").reduce((s, l) => s + (Number(l.quantite) || 0) * (Number(l.prix_unitaire) || 0), 0),
    }, true);
  };

  const handleFacturX = async () => {
    if (!lignes.length) { setExportMsg("Ajoutez au moins une ligne avant d'exporter."); return; }
    setExporting(true); setExportMsg(null);
    try {
      const [{ renderDataToPdf }, { downloadBlob }] = await Promise.all([
        import("../lib/pdf.js"),
        import("../lib/facturx.js"),
      ]);
      const { base64 } = await renderDataToPdf(asDevisShape, client, brand, "facture", { filename: `${invoice.numero}.pdf` });

      // Appelle le serveur pour l'assemblage PDF/A-3 (OutputIntent, XMP, XML embed)
      // Si la facture est un avoir, on transmet les infos de la facture d'origine
      // pour que l'XML Factur-X émette TypeCode=381 + InvoiceReferencedDocument.
      const sourcePayload = isAvoir && sourceInvoice
        ? { numero: sourceInvoice.numero, date_emission: sourceInvoice.date_emission }
        : undefined;

      const token = await getToken();
      const res = await fetch("/api/facturx", {
        method:  "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { "Authorization": `Bearer ${token}` } : {}),
        },
        body:    JSON.stringify({
          pdf_base64: base64,
          invoice:    { ...invoice, lignes },
          client,
          brand,
          sourceInvoice: sourcePayload,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);

      const pdfBytes = Uint8Array.from(atob(data.pdf_base64), c => c.charCodeAt(0));
      const blob     = new Blob([pdfBytes], { type: "application/pdf" });
      downloadBlob(blob, `${invoice.numero}-facturx.pdf`);

      // Conformité : la génération Factur-X est l'émission de la facture.
      // On bascule statut → 'envoyee' ; le trigger Postgres pose locked=true.
      if (invoice.statut === "brouillon") {
        try {
          onChange({ ...invoice, statut: "envoyee", locked: true }, false);
        } catch (lockErr) {
          console.warn("[facturx/lock]", lockErr);
        }
      }

      setExportMsg(
        (data.icc_applied
          ? "✓ Factur-X EN 16931 / PDF-A3 téléchargé avec profil sRGB. Conformité PPF/PDP 2026 maximale."
          : "✓ Factur-X EN 16931 téléchargé. Pour la conformité PDF/A-3 stricte, ajoutez public/icc/sRGB.icc — voir public/icc/README.md.")
        + (isAvoir
            ? " Avoir verrouillé (immuable)."
            : " La facture est maintenant verrouillée (immuable).")
      );
    } catch (err) {
      console.error("[facturx]", err);
      setExportMsg("❌ Erreur génération Factur-X : " + (err.message || err));
    } finally {
      setExporting(false);
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
    <>
      <style>{`
        @media (min-width:1024px){
          .detail-shell{height:100%;min-height:unset !important;overflow:hidden}
          .detail-row{height:100%}
          .detail-editor{overflow-y:auto}
          .detail-preview{display:flex !important;flex-direction:column;width:46%;flex-shrink:0;border-left:1px solid #e2e8f0;overflow-y:auto}
          .detail-pdf-btn{display:none !important}
        }
      `}</style>
      {showPDF && (
        <PDFViewer d={asDevisShape} cl={client} brand={brand} onClose={() => setShowPDF(false)} kind="facture" noDownload={invoice.statut === "brouillon"}/>
      )}
      {clientPicker && (
        <ClientPickerModal
          clients={clients}
          current={client}
          onSelect={c => onChange({ ...invoice, client_id: c?.id ?? null })}
          onClose={() => setClientPicker(false)}/>
      )}
      <div className="detail-shell" style={{ background: "#f8fafc", minHeight: "100%", display: "flex", flexDirection: "column" }}>
        <div className="detail-row" style={{ flex: 1, display: "flex" }}>
          <div className="detail-editor" style={{ flex: 1, minWidth: 0 }}>

      <div style={{ background: "white", borderBottom: "1px solid #f1f5f9", padding: "14px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
          <button onClick={onBack} style={{ background: "none", border: "none", color: "#64748b", fontSize: 20, cursor: "pointer", flexShrink: 0 }}>←</button>
          <div style={{ fontSize: 11, color: "#94a3b8", fontFamily: "monospace", flex: 1 }}>{invoice.numero}</div>
          {invoice.invoice_type === "acompte" && (
            <span style={{ fontSize: 9, fontWeight: 700, color: "#c2410c", background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 6, padding: "2px 6px" }}>ACOMPTE</span>
          )}
          <Badge s={invoice.statut} kind="facture"/>
        </div>
        {isAvoir && (
          <div style={{ background: "#eef2ff", border: "1px solid #c7d2fe", color: "#3730a3", padding: "8px 10px", borderRadius: 10, fontSize: 11, marginBottom: 8, display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 14 }}>↩</span>
            <span>
              <strong>Facture d'avoir</strong> — rectifie la facture {sourceInvoice ? <strong>{sourceInvoice.numero}</strong> : "d'origine"}.
            </span>
          </div>
        )}
        {invoice.invoice_type === "acompte" && (
          <div style={{ background: "#fff7ed", border: "1px solid #fed7aa", color: "#c2410c", padding: "8px 10px", borderRadius: 10, fontSize: 11, marginBottom: 8, display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 14 }}>💰</span>
            <span><strong>Facture d'acompte</strong> — sera déduite de la facture finale.</span>
          </div>
        )}
        {isLocked && !isAvoir && (
          <div style={{ background: "#fef3c7", border: "1px solid #fde68a", color: "#92400e", padding: "8px 10px", borderRadius: 10, fontSize: 11, marginBottom: 8, display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 14 }}>🔒</span>
            <span><strong>Facture verrouillée</strong> — émise et immuable (CGI art. 289). Pour corriger, créez une facture d'avoir.</span>
          </div>
        )}
        {isLocked && isAvoir && (
          <div style={{ background: "#fef3c7", border: "1px solid #fde68a", color: "#92400e", padding: "8px 10px", borderRadius: 10, fontSize: 11, marginBottom: 8, display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 14 }}>🔒</span>
            <span><strong>Avoir verrouillé</strong> — émis et immuable.</span>
          </div>
        )}
        {/* Client */}
        <button onClick={() => !isLocked && setClientPicker(true)} disabled={isLocked}
          style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, background: isLocked ? "#f1f5f9" : "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: "7px 10px", marginBottom: 8, cursor: isLocked ? "not-allowed" : "pointer", textAlign: "left" }}>
          <span style={{ fontSize: 16 }}>👤</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: isLocked ? "#94a3b8" : "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {client ? (client.raison_sociale || `${client.prenom || ""} ${client.nom || ""}`.trim()) : <span style={{ color: "#94a3b8", fontStyle: "italic" }}>Sans client</span>}
            </div>
            {client?.email && <div style={{ fontSize: 11, color: "#94a3b8" }}>{client.email}</div>}
          </div>
          {!isLocked && <span style={{ fontSize: 11, color: "#94a3b8", flexShrink: 0 }}>Changer ›</span>}
        </button>

        <label style={{ display: "block", fontSize: 10, color: "#94a3b8", fontWeight: 600, marginBottom: 2 }}>OBJET</label>
        <input
          value={invoice.objet || ""}
          onChange={e => onChange({ ...invoice, objet: e.target.value })}
          disabled={isLocked}
          placeholder="Objet de la facture"
          style={{ fontSize: 14, fontWeight: 700, color: isLocked ? "#94a3b8" : "#0f172a", border: "1px solid #e2e8f0", borderRadius: 8, background: isLocked ? "#f1f5f9" : "#f8fafc", outline: "none", width: "100%", padding: "7px 10px", fontFamily: "inherit", marginBottom: 8, boxSizing: "border-box", cursor: isLocked ? "not-allowed" : "text" }}
        />
        <label style={{ display: "block", fontSize: 10, color: "#94a3b8", fontWeight: 600, marginBottom: 2 }}>CHANTIER</label>
        <input
          value={invoice.ville_chantier || ""}
          onChange={e => onChange({ ...invoice, ville_chantier: e.target.value })}
          disabled={isLocked}
          placeholder="Ville / chantier"
          style={{ fontSize: 13, color: "#64748b", border: "1px solid #e2e8f0", borderRadius: 8, background: isLocked ? "#f1f5f9" : "#f8fafc", outline: "none", width: "100%", padding: "7px 10px", fontFamily: "inherit", boxSizing: "border-box", cursor: isLocked ? "not-allowed" : "text" }}
        />
      </div>

      <div style={{ padding: 16 }}>
        <button className="detail-pdf-btn" onClick={() => setShowPDF(true)}
          style={{ width: "100%", background: `linear-gradient(135deg,${ac}ee,${ac})`, color: "white", border: "none", borderRadius: 16, padding: 16, fontSize: 14, fontWeight: 700, cursor: "pointer", boxShadow: `0 6px 20px ${ac}44`, marginBottom: 12 }}>
          {invoice.statut === "brouillon" ? "👁 Aperçu brouillon" : "Voir le PDF de la facture"}
        </button>

        {/* Actions principales — sous l'aperçu */}
        <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
          {!isLocked ? (
            <button onClick={onDelete}
              style={{ background: "white", border: "1px solid #fecaca", color: "#b91c1c", borderRadius: 12, padding: "12px 16px", fontSize: 12, fontWeight: 600, cursor: "pointer", flexShrink: 0 }}>
              Supprimer
            </button>
          ) : (
            <button onClick={onDelete}
              title="Une facture émise ne peut être que masquée (conservée 10 ans en base, art. L102 B LPF)."
              style={{ background: "white", border: "1px solid #e2e8f0", color: "#64748b", borderRadius: 12, padding: "12px 16px", fontSize: 12, fontWeight: 600, cursor: "pointer", flexShrink: 0 }}>
              Masquer
            </button>
          )}
          <button onClick={handleFacturX} disabled={exporting || !lignes.length}
            style={{ flex: 1, background: exporting || !lignes.length ? "#cbd5e1" : "#0f172a", color: "white", border: "none", borderRadius: 12, padding: "12px 16px", fontSize: 13, fontWeight: 700, cursor: exporting || !lignes.length ? "not-allowed" : "pointer", lineHeight: 1.3 }}>
            {exporting
              ? "Génération en cours…"
              : isLocked
                ? "⬇ Re-télécharger Factur-X"
                : "🔒 Émettre la facture définitive"}
          </button>
        </div>
        {!isLocked && (
          <div style={{ fontSize: 11, color: "#b45309", background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 8, padding: "8px 10px", marginBottom: 12, lineHeight: 1.45 }}>
            ⚠ En cliquant sur « Émettre », le PDF + XML Factur-X seront générés et la facture sera <strong>verrouillée définitivement</strong> — plus aucune modification possible (CGI art. 289).
          </div>
        )}
        {exportMsg && (
          <div style={{
            background: exportMsg.startsWith("❌") ? "#fef2f2" : "#ecfdf5",
            border: `1px solid ${exportMsg.startsWith("❌") ? "#fecaca" : "#bbf7d0"}`,
            color: exportMsg.startsWith("❌") ? "#991b1b" : "#065f46",
            padding: "10px 12px", borderRadius: 10, fontSize: 12, marginBottom: 12, lineHeight: 1.4,
          }}>
            {exportMsg}
          </div>
        )}

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

        <div style={{ background: "white", borderRadius: 14, border: "1px solid #f1f5f9", padding: 14, marginBottom: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#0f172a", marginBottom: 10 }}>Spécificités BTP</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <div style={{ fontSize: 10, color: "#64748b", marginBottom: 4 }}>Type d'opération</div>
                <select value={invoice.operation_type || "service"}
                  onChange={e => onChange({ ...invoice, operation_type: e.target.value }, false)}
                  disabled={isLocked}
                  style={{ width: "100%", border: "1px solid #e5e7eb", borderRadius: 8, padding: "7px 8px", fontSize: 12, background: isLocked ? "#f1f5f9" : "white", cursor: isLocked ? "not-allowed" : "pointer" }}>
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
                  disabled={isLocked}
                  style={{ width: "100%", border: "1px solid #e5e7eb", borderRadius: 8, padding: "7px 8px", fontSize: 12, background: isLocked ? "#f1f5f9" : "white", cursor: isLocked ? "not-allowed" : "text" }}/>
              </div>
            </div>
          </div>

        {/* Créer un avoir : uniquement sur facture verrouillée ET qui n'est PAS déjà un avoir */}
        {isLocked && !isAvoir && onCreateAvoir && (
          <div style={{ marginTop: 10 }}>
            <button
              onClick={() => {
                if (!confirm(`Créer une facture d'avoir pour ${invoice.numero} ?\n\nUn nouveau brouillon sera créé avec les mêmes lignes. Vous pourrez ajuster les quantités avant émission.`)) return;
                onCreateAvoir(invoice.id);
              }}
              title="Crée un avoir (facture rectificative) basé sur cette facture"
              style={{ background: "#eef2ff", border: "1px solid #c7d2fe", color: "#4338ca", borderRadius: 12, padding: "12px 16px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
              ↩ Créer un avoir
            </button>
          </div>
        )}
      </div>
          </div>{/* end detail-editor */}

          {/* Aperçu PDF live — desktop uniquement */}
          <div className="detail-preview" style={{ display: "none", background: "#dde1e7" }}>
            <PDFViewer d={asDevisShape} cl={client} brand={brand} inline kind="facture" noDownload={invoice.statut === "brouillon"}/>
          </div>

        </div>{/* end detail-row */}
      </div>{/* end detail-shell */}
    </>
  );
}
