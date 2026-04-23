import { useState, useEffect } from "react";
import { fmt } from "../lib/utils.js";
import { I } from "./ui/icons.jsx";
import Badge from "./ui/Badge.jsx";
import LignesEditor from "./LignesEditor.jsx";
import PDFViewer from "./PDFViewer.jsx";

export default function DevisDetail({ d, cl, onBack, brand, onChange, onConvertToInvoice, loading, autoOpenPDF, onAutoOpenPDFConsumed }) {
  const [showPDF,       setShowPDF]       = useState(false);
  const [sending,       setSending]       = useState(false);
  const [signUrl,       setSignUrl]       = useState(d?.odoo_sign_url || null);
  const [log,           setLog]           = useState([]);
  const [showLog,       setShowLog]       = useState(false);
  const [odooRendering, setOdooRendering] = useState(false);

  // Ouvre automatiquement le PDF quand on arrive depuis l'Agent IA après save
  useEffect(() => {
    if (autoOpenPDF) {
      setShowPDF(true);
      onAutoOpenPDFConsumed?.();
    }
  }, [autoOpenPDF, onAutoOpenPDFConsumed]);

  if (loading) return <LoadingSkeleton/>;

  const lignes = d.lignes || [];
  const ht = lignes.filter(l => l.type_ligne === "ouvrage")
    .reduce((s, l) => s + (l.quantite || 0) * (l.prix_unitaire || 0), 0);
  const ac = brand.color || "#22c55e";

  const updateLignes = (newLignes) => {
    const newHt = newLignes.filter(l => l.type_ligne === "ouvrage")
      .reduce((s, l) => s + (l.quantite || 0) * (l.prix_unitaire || 0), 0);
    onChange({ ...d, lignes: newLignes, montant_ht: newHt }, true);
  };

  const addLog = msg => setLog(l => [...l, { t: new Date().toLocaleTimeString("fr-FR"), msg }]);

  const signerEmail = cl?.email || "";
  const signerName  = cl?.raison_sociale?.trim() || `${cl?.prenom || ""} ${cl?.nom || ""}`.trim() || "";

  const sendOdoo = async () => {
    if (sending) return;
    if (!signerEmail) {
      alert("Le contact de ce devis n'a pas d'email — impossible d'envoyer la signature.");
      return;
    }
    setSending(true); setLog([]); setShowLog(true);
    addLog("Préparation du PDF…");
    setOdooRendering(true);
  };

  const onPdfPageReady = async (pageEl) => {
    try {
      const { renderElementToPdf } = await import("../lib/pdf.js");
      const { base64 } = await renderElementToPdf(pageEl, { filename: `${d.numero}.pdf` });
      addLog("✓ PDF généré");
      addLog("Envoi vers Odoo Sign…");
      const res = await fetch("/api/odoo-sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pdf_base64:   base64,
          filename:     `${d.numero}.pdf`,
          reference:    d.numero,
          signer_email: signerEmail,
          signer_name:  signerName || signerEmail,
          signer_phone: cl?.telephone || "",
          company_name:  brand.companyName || "",
          company_email: brand.email || "",
          company_phone: brand.phone || "",
          subject: `${brand.companyName ? brand.companyName + " — " : ""}Votre devis ${d.numero}`,
          message: `Bonjour ${signerName || ""},\n\nVotre devis ${d.numero}${d.objet ? ` (${d.objet})` : ""} est prêt. Vous pouvez le consulter et le signer en ligne.\n\n${brand.companyName || "Notre entreprise"} reste à votre disposition pour toute question${brand.phone ? ` au ${brand.phone}` : ""}${brand.email ? ` ou par mail à ${brand.email}` : ""}.\n\nCordialement,\n${brand.companyName || ""}`,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.detail || data?.error || "Erreur Odoo");
      addLog("✓ Demande de signature créée");
      addLog(`🎉 Email envoyé à ${signerEmail}`);
      setSignUrl(data.sign_url);
      onChange({ ...d, statut: "en_signature", odoo_sign_url: data.sign_url, odoo_sign_id: String(data.request_id || "") }, false);
    } catch (err) {
      addLog(`❌ ${err.message || err}`);
    } finally {
      setOdooRendering(false);
      setSending(false);
    }
  };

  const lotsResume = lignes.filter(l => l.type_ligne === "ouvrage").reduce((a, l) => {
    a[l.lot || "Divers"] = (a[l.lot || "Divers"] || 0) + (l.quantite || 0) * (l.prix_unitaire || 0);
    return a;
  }, {});

  return (
    <>
      {showPDF && (
        <PDFViewer d={d} cl={cl} brand={brand} onClose={() => setShowPDF(false)}
          onSendOdoo={!["accepte", "refuse"].includes(d.statut) ? sendOdoo : undefined}
          sending={sending}
          sent={!!signUrl || d.statut === "en_signature"}/>
      )}
      {odooRendering && (
        <PDFViewer d={d} cl={cl} brand={brand} hidden onPageReady={onPdfPageReady}/>
      )}

      <div style={{ minHeight: "100%", background: "#f8fafc" }} className="fu">
        {/* En-tête */}
        <div style={{ background: "white", borderBottom: "1px solid #f1f5f9", padding: "13px 18px" }}>
          <button onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", color: "#64748b", fontSize: 13, marginBottom: 12, cursor: "pointer" }}>
            {I.back} Retour
          </button>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontSize: 10, color: "#94a3b8", fontFamily: "monospace", marginBottom: 3 }}>{d.numero}</div>
              <div style={{ fontSize: 17, fontWeight: 700, color: "#0f172a", lineHeight: 1.3 }}>{d.objet}</div>
              <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
                {cl?.raison_sociale || `${cl?.prenom || ""} ${cl?.nom || ""}`.trim() || "—"} · {d.ville_chantier}
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: "#0f172a" }}>{fmt(ht)}</div>
              <div style={{ fontSize: 10, color: "#94a3b8", marginBottom: 5 }}>HT</div>
              <Badge s={d.statut}/>
            </div>
          </div>
        </div>

        <div style={{ padding: 18 }}>
          {/* Bouton PDF */}
          <button onClick={() => setShowPDF(true)}
            style={{ width: "100%", background: `linear-gradient(135deg,${ac}ee,${ac})`, color: "white", border: "none", borderRadius: 16, padding: 16, fontSize: 14, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", gap: 10, cursor: "pointer", boxShadow: `0 6px 20px ${ac}44`, marginBottom: 12 }}>
            {I.pdf} Voir le PDF du devis
          </button>

          {/* Conversion en facture (visible dès qu'il y a au moins une ligne) */}
          {onConvertToInvoice && lignes.length > 0 && (
            <button onClick={onConvertToInvoice}
              style={{ width: "100%", background: "white", color: "#0f172a", border: "1.5px solid #0f172a", borderRadius: 14, padding: 13, fontSize: 13, fontWeight: 700, cursor: "pointer", marginBottom: 12, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              📄 Convertir en facture électronique
            </button>
          )}

          {/* Éditeur de lignes */}
          <LignesEditor lignes={lignes} onChange={updateLignes} ac={ac} vatRegime={brand?.vatRegime}/>

          {/* Récapitulatif lots */}
          {Object.keys(lotsResume).length > 0 && (
            <div style={{ background: "white", borderRadius: 14, border: "1px solid #f1f5f9", overflow: "hidden", marginBottom: 12 }}>
              <div style={{ padding: "12px 16px", borderBottom: "1px solid #f8fafc", fontWeight: 600, fontSize: 13, color: "#0f172a" }}>Récapitulatif par lot</div>
              {Object.entries(lotsResume).map(([lot, mt]) => (
                <div key={lot} style={{ padding: "10px 16px", borderBottom: "1px solid #f8fafc", display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 12, color: "#374151" }}>{lot}</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "#0f172a" }}>{fmt(mt)}</span>
                </div>
              ))}
              <div style={{ padding: "12px 16px", background: "#f8fafc", display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontWeight: 700, fontSize: 13, color: "#0f172a" }}>Total HT</span>
                <span style={{ fontWeight: 700, fontSize: 14, color: ac }}>{fmt(ht)}</span>
              </div>
            </div>
          )}

          {/* Actions statut */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {signUrl && (
              <div style={{ background: "#faf5ff", border: "1px solid #e9d5ff", borderRadius: 12, padding: "12px 14px" }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: "#7c3aed", marginBottom: 5, display: "flex", alignItems: "center", gap: 5 }}>
                  {I.odoo} Lien de signature Odoo actif
                </div>
                <div style={{ fontSize: 10, color: "#6b21a8", fontFamily: "monospace", wordBreak: "break-all" }}>{signUrl}</div>
              </div>
            )}
            {d.statut === "en_signature" && (
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => onChange({ ...d, statut: "accepte", signed_at: new Date().toISOString(), signed_by: signerName || signerEmail || "" })}
                  style={{ flex: 1, background: "#ecfdf5", color: "#065f46", border: "1px solid #a7f3d0", borderRadius: 12, padding: 10, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                  ✓ Accepté
                </button>
                <button onClick={() => onChange({ ...d, statut: "refuse" })}
                  style={{ flex: 1, background: "#fef2f2", color: "#991b1b", border: "1px solid #fecaca", borderRadius: 12, padding: 10, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                  ✗ Refusé
                </button>
              </div>
            )}
          </div>

          {/* Log Odoo Sign */}
          {showLog && log.length > 0 && (
            <div style={{ background: "#0f172a", borderRadius: 14, padding: 14, marginTop: 14 }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: "#475569", marginBottom: 8, fontFamily: "monospace" }}>LOG ODOO SIGN</div>
              {log.map((l, i) => (
                <div key={i} style={{ fontFamily: "monospace", fontSize: 11, marginBottom: 3, display: "flex", gap: 8, color: l.msg.startsWith("✓") || l.msg.startsWith("🎉") ? "#4ade80" : l.msg.startsWith("❌") ? "#f87171" : "#94a3b8" }}>
                  <span style={{ color: "#475569" }}>{l.t}</span><span>{l.msg}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </>
  );
}

function LoadingSkeleton() {
  return (
    <div style={{ padding: 18, animation: "fadeUp .2s ease both" }}>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.45}}`}</style>
      <div style={{ height: 16, width: 80, background: "#e2e8f0", borderRadius: 8, marginBottom: 20, animation: "pulse 1.5s ease infinite" }}/>
      {[200, 140, 160, 120].map((w, i) => (
        <div key={i} style={{ height: i === 0 ? 28 : 14, width: `${w}px`, background: "#e2e8f0", borderRadius: 8, marginBottom: i === 0 ? 8 : 14, animation: "pulse 1.5s ease infinite" }}/>
      ))}
      <div style={{ height: 44, background: "#e2e8f0", borderRadius: 12, marginTop: 24, animation: "pulse 1.5s ease infinite" }}/>
    </div>
  );
}
