import { useState, useEffect } from "react";
import { fmt } from "../lib/utils.js";
import { I } from "./ui/icons.jsx";
import Badge from "./ui/Badge.jsx";
import LignesEditor from "./LignesEditor.jsx";
import PDFViewer from "./PDFViewer.jsx";
import ClientPickerModal from "./app/ClientPickerModal.jsx";

export default function DevisDetail({ d, cl, clients = [], onBack, brand, onChange, onConvertToInvoice, onCreateAcompte, onDuplicate, onCreateIndice, groupVersions = [], goDevis, loading, autoOpenPDF, onAutoOpenPDFConsumed }) {
  const [showPDF,        setShowPDF]        = useState(false);
  const [sending,        setSending]        = useState(false);
  const [signUrl,        setSignUrl]        = useState(d?.odoo_sign_url || null);
  const [log,            setLog]            = useState([]);
  const [showLog,        setShowLog]        = useState(false);
  const [acompteModal,   setAcompteModal]   = useState(false);
  const [acomptePct,     setAcomptePct]     = useState(30);
  const [acompteLoading, setAcompteLoading] = useState(false);
  const [clientPicker,   setClientPicker]   = useState(false);

  // Ouvre automatiquement le PDF quand on arrive depuis l'Agent IA après save
  useEffect(() => {
    if (autoOpenPDF) {
      setShowPDF(true);
      onAutoOpenPDFConsumed?.();
    }
  }, [autoOpenPDF, onAutoOpenPDFConsumed]);

  if (loading) return <LoadingSkeleton/>;

  const isRemplace = d.statut === "remplace";
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
    try {
      const { renderDataToPdf } = await import("../lib/pdf.js");
      const { base64 } = await renderDataToPdf(d, cl, brand, "devis", { filename: `${d.numero}.pdf` });
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
      setSending(false);
    }
  };

  const lotsResume = lignes.filter(l => l.type_ligne === "ouvrage").reduce((a, l) => {
    a[l.lot || "Divers"] = (a[l.lot || "Divers"] || 0) + (l.quantite || 0) * (l.prix_unitaire || 0);
    return a;
  }, {});

  const franchise  = brand?.vatRegime === "franchise";
  const tvaRate    = franchise ? 0 : (lignes.find(l => l.type_ligne === "ouvrage")?.tva_rate ?? 20);
  const acompteHT  = Math.round(ht * acomptePct) / 100;
  const acompteTTC = Math.round(acompteHT * (1 + tvaRate / 100) * 100) / 100;
  const canAcompte = onCreateAcompte && ht > 0 && ["envoye","en_signature","accepte"].includes(d.statut);

  const handleAcompte = async () => {
    if (!acompteHT || acompteLoading) return;
    setAcompteLoading(true);
    try {
      await onCreateAcompte(d.id, acompteHT, tvaRate);
      setAcompteModal(false);
    } finally {
      setAcompteLoading(false);
    }
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
        <PDFViewer d={d} cl={cl} brand={brand} onClose={() => setShowPDF(false)}
          onSendOdoo={!["accepte", "refuse"].includes(d.statut) ? sendOdoo : undefined}
          sending={sending}
          sent={!!signUrl || d.statut === "en_signature"}/>
      )}

      {acompteModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", zIndex: 200, display: "flex", alignItems: "flex-end", justifyContent: "center" }}
          onClick={e => { if (e.target === e.currentTarget) setAcompteModal(false); }}>
          <div style={{ background: "white", borderRadius: "20px 20px 0 0", padding: 24, width: "100%", maxWidth: 480 }}>
            <div style={{ fontWeight: 700, fontSize: 16, color: "#0f172a", marginBottom: 4 }}>Facture d'acompte</div>
            <div style={{ fontSize: 12, color: "#64748b", marginBottom: 20 }}>Devis {d.numero} · Total HT {fmt(ht)}</div>

            <label style={{ fontSize: 11, fontWeight: 600, color: "#64748b", display: "block", marginBottom: 8 }}>POURCENTAGE DE L'ACOMPTE</label>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
              <input type="range" min={1} max={100} value={acomptePct}
                onChange={e => setAcomptePct(Number(e.target.value))}
                style={{ flex: 1, accentColor: ac }}/>
              <div style={{ display: "flex", alignItems: "center", gap: 4, border: "1px solid #e2e8f0", borderRadius: 10, padding: "6px 10px" }}>
                <input type="number" min={1} max={100} value={acomptePct}
                  onChange={e => setAcomptePct(Math.min(100, Math.max(1, Number(e.target.value))))}
                  style={{ width: 48, border: "none", outline: "none", fontSize: 15, fontWeight: 700, textAlign: "right", fontFamily: "inherit", color: "#0f172a" }}/>
                <span style={{ color: "#64748b", fontSize: 14 }}>%</span>
              </div>
            </div>

            <div style={{ background: "#f8fafc", borderRadius: 14, padding: "14px 16px", marginBottom: 20 }}>
              {franchise ? (
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 13, color: "#64748b" }}>Montant (TVA non applicable)</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: ac }}>{fmt(acompteHT)}</span>
                </div>
              ) : (
                <>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <span style={{ fontSize: 13, color: "#64748b" }}>Montant HT</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>{fmt(acompteHT)}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 13, color: "#64748b" }}>Montant TTC ({tvaRate}%)</span>
                    <span style={{ fontSize: 14, fontWeight: 700, color: ac }}>{fmt(acompteTTC)}</span>
                  </div>
                </>
              )}
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setAcompteModal(false)}
                style={{ flex: 1, background: "#f1f5f9", border: "none", borderRadius: 14, padding: 14, fontSize: 14, fontWeight: 600, cursor: "pointer", color: "#64748b" }}>
                Annuler
              </button>
              <button onClick={handleAcompte} disabled={acompteLoading}
                style={{ flex: 2, background: acompteLoading ? "#94a3b8" : ac, border: "none", borderRadius: 14, padding: 14, fontSize: 14, fontWeight: 700, cursor: acompteLoading ? "not-allowed" : "pointer", color: "white" }}>
                {acompteLoading ? "Création…" : `Créer l'acompte (${fmt(acompteTTC)} TTC)`}
              </button>
            </div>
          </div>
        </div>
      )}
      {clientPicker && (
        <ClientPickerModal
          clients={clients}
          current={cl}
          onSelect={c => onChange({ ...d, client_id: c?.id ?? null })}
          onClose={() => setClientPicker(false)}/>
      )}
      <div className="detail-shell" style={{ minHeight: "100%", background: "#f8fafc", display: "flex", flexDirection: "column" }}>
        <div className="detail-row" style={{ flex: 1, display: "flex" }}>
          <div className="detail-editor fu" style={{ flex: 1, minWidth: 0 }}>
        {/* En-tête */}
        <div style={{ background: "white", borderBottom: "1px solid #f1f5f9", padding: "13px 18px" }}>
          <button onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", color: "#64748b", fontSize: 13, marginBottom: 12, cursor: "pointer" }}>
            {I.back} Retour
          </button>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div style={{ fontSize: 10, color: "#94a3b8", fontFamily: "monospace" }}>{d.numero}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 18, fontWeight: 700, color: "#0f172a" }}>{fmt(ht)}</span>
              <span style={{ fontSize: 10, color: "#94a3b8" }}>HT</span>
              <Badge s={d.statut}/>
            </div>
          </div>

          {/* Navigation entre versions du dossier */}
          {groupVersions.length > 1 && (
            <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
              {groupVersions.map(v => {
                const isCurrent = v.id === d.id;
                return (
                  <button key={v.id} onClick={() => !isCurrent && goDevis(v.id)}
                    style={{ padding: "4px 10px", borderRadius: 20, border: "none", fontSize: 11, fontWeight: 700,
                      cursor: isCurrent ? "default" : "pointer",
                      background: isCurrent ? (brand.color || "#22c55e") : "#f1f5f9",
                      color: isCurrent ? "white" : "#64748b",
                      boxShadow: isCurrent ? `0 2px 8px ${brand.color || "#22c55e"}44` : "none" }}>
                    {v.indice || "Initial"}
                  </button>
                );
              })}
            </div>
          )}

          {/* Bannière version remplacée */}
          {isRemplace && (
            <div style={{ background: "#f5f3ff", border: "1px solid #e9d5ff", borderRadius: 10,
              padding: "8px 12px", marginBottom: 10, fontSize: 11, color: "#6b21a8",
              display: "flex", alignItems: "center", gap: 8 }}>
              <span>🔒</span>
              <span><strong>Version remplacée</strong> — consultation uniquement. Créez un nouvel indice pour modifier.</span>
            </div>
          )}

          {/* Client */}
          <button onClick={() => !isRemplace && setClientPicker(true)} disabled={isRemplace}
            style={{ width: "100%", display: "flex", alignItems: "center", gap: 8,
              background: isRemplace ? "#f1f5f9" : "#f8fafc",
              border: "1px solid #e2e8f0", borderRadius: 10, padding: "7px 10px", marginBottom: 8,
              cursor: isRemplace ? "not-allowed" : "pointer", textAlign: "left" }}>
            <span style={{ fontSize: 16 }}>👤</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {cl ? (cl.raison_sociale || `${cl.prenom || ""} ${cl.nom || ""}`.trim()) : <span style={{ color: "#94a3b8", fontStyle: "italic" }}>Sans client</span>}
              </div>
              {cl?.email && <div style={{ fontSize: 11, color: "#94a3b8" }}>{cl.email}</div>}
            </div>
            <span style={{ fontSize: 11, color: "#94a3b8", flexShrink: 0 }}>Changer ›</span>
          </button>

          <label style={{ display: "block", fontSize: 10, color: "#94a3b8", fontWeight: 600, marginBottom: 2 }}>OBJET</label>
          <input
            value={d.objet || ""}
            onChange={e => !isRemplace && onChange({ ...d, objet: e.target.value })}
            readOnly={isRemplace}
            placeholder="Objet du devis"
            style={{ fontSize: 15, fontWeight: 700, color: isRemplace ? "#94a3b8" : "#0f172a", border: "1px solid #e2e8f0", borderRadius: 8, background: isRemplace ? "#f1f5f9" : "#f8fafc", outline: "none", width: "100%", padding: "7px 10px", fontFamily: "inherit", marginBottom: 8, boxSizing: "border-box", cursor: isRemplace ? "not-allowed" : "text" }}
          />
          <label style={{ display: "block", fontSize: 10, color: "#94a3b8", fontWeight: 600, marginBottom: 2 }}>CHANTIER</label>
          <input
            value={d.ville_chantier || ""}
            onChange={e => !isRemplace && onChange({ ...d, ville_chantier: e.target.value })}
            readOnly={isRemplace}
            placeholder="Ville / chantier"
            style={{ fontSize: 13, color: isRemplace ? "#94a3b8" : "#64748b", border: "1px solid #e2e8f0", borderRadius: 8, background: isRemplace ? "#f1f5f9" : "#f8fafc", outline: "none", width: "100%", padding: "7px 10px", fontFamily: "inherit", boxSizing: "border-box", cursor: isRemplace ? "not-allowed" : "text" }}
          />
        </div>

        <div style={{ padding: 18 }}>
          {/* Bouton PDF */}
          <button className="detail-pdf-btn" onClick={() => setShowPDF(true)}
            style={{ width: "100%", background: `linear-gradient(135deg,${ac}ee,${ac})`, color: "white", border: "none", borderRadius: 16, padding: 16, fontSize: 14, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", gap: 10, cursor: "pointer", boxShadow: `0 6px 20px ${ac}44`, marginBottom: 12 }}>
            {I.pdf} Voir le PDF du devis
          </button>

          {/* Nouvel indice */}
          {onCreateIndice && d.statut !== "accepte" && (
            <button onClick={onCreateIndice}
              style={{ width: "100%", background: "#f5f3ff", color: "#6b21a8", border: "1.5px solid #e9d5ff", borderRadius: 14, padding: 13, fontSize: 13, fontWeight: 700, cursor: "pointer", marginBottom: 12, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              ✦ Créer un nouvel indice
            </button>
          )}

          {/* Dupliquer */}
          {onDuplicate && (
            <button onClick={onDuplicate}
              style={{ width: "100%", background: "white", color: "#64748b", border: "1.5px solid #e2e8f0", borderRadius: 14, padding: 13, fontSize: 13, fontWeight: 600, cursor: "pointer", marginBottom: 12, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              📋 Dupliquer ce devis
            </button>
          )}

          {/* Conversion en facture (visible dès qu'il y a au moins une ligne) */}
          {onConvertToInvoice && lignes.length > 0 && (
            <button onClick={onConvertToInvoice}
              style={{ width: "100%", background: "white", color: "#0f172a", border: "1.5px solid #0f172a", borderRadius: 14, padding: 13, fontSize: 13, fontWeight: 700, cursor: "pointer", marginBottom: 12, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              📄 Convertir en facture électronique
            </button>
          )}

          {/* Acompte (visible si devis envoyé / en signature / accepté) */}
          {canAcompte && (
            <button onClick={() => setAcompteModal(true)}
              style={{ width: "100%", background: "#fff7ed", color: "#c2410c", border: "1.5px solid #fed7aa", borderRadius: 14, padding: 13, fontSize: 13, fontWeight: 700, cursor: "pointer", marginBottom: 12, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              💰 Créer une facture d'acompte
            </button>
          )}

          {/* Éditeur de lignes (lecture seule si remplacé) */}
          <LignesEditor lignes={lignes} onChange={isRemplace ? undefined : updateLignes} ac={ac} vatRegime={brand?.vatRegime} readOnly={isRemplace}/>

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
          </div>{/* end detail-editor */}

          {/* Aperçu PDF live — desktop uniquement */}
          <div className="detail-preview" style={{ display: "none", background: "#dde1e7" }}>
            <PDFViewer d={d} cl={cl} brand={brand} inline/>
          </div>

        </div>{/* end detail-row */}
      </div>{/* end detail-shell */}
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
