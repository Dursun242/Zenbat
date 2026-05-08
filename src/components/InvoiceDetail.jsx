import { useState } from "react";
import { fmt } from "../lib/utils.js";
import Badge from "./ui/Badge.jsx";
import LignesEditor from "./LignesEditor.jsx";
import PDFViewer from "./PDFViewer.jsx";
import ClientPickerModal from "./app/ClientPickerModal.jsx";
import { getToken } from "../lib/getToken.js";
import { pdp } from "../lib/api.js";

export default function InvoiceDetail({ invoice, client, clients = [], brand, invoices, onBack, onChange, onCreateAvoir, onDelete }) {
  const [showPDF,      setShowPDF]      = useState(false);
  const [exporting,    setExporting]    = useState(false);
  const [exportMsg,    setExportMsg]    = useState(null);
  const [sendingPDP,   setSendingPDP]   = useState(false);
  const [clientPicker, setClientPicker] = useState(false);
  const ac = brand.color || "#22c55e";

  const lignes = invoice.lignes || [];
  const ouvrages = lignes.filter(l => l.type_ligne === "ouvrage");
  const franchise = brand.vatRegime === "franchise";
  const autoLiq   = !!invoice.auto_liquidation_btp;
  const noTva     = franchise || autoLiq;
  const ht   = ouvrages.reduce((s, l) => s + (Number(l.quantite) || 0) * (Number(l.prix_unitaire) || 0), 0);
  const tva  = ouvrages.reduce((s, l) => s + (Number(l.quantite) || 0) * (Number(l.prix_unitaire) || 0) * (noTva ? 0 : Number(l.tva_rate ?? 20)) / 100, 0);
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
      // Double-check sur invoice.locked en plus du statut : la closure peut
      // être stale après les ~5s d'awaits ci-dessus, et un autre flux a pu
      // déjà verrouiller la facture (race entre 2 clics).
      if (invoice.statut === "brouillon" && !invoice.locked) {
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

  // Génère le PDF Factur-X enrichi (mêmes étapes que handleFacturX, sans téléchargement)
  // et l'envoie à Super PDP (PA). En v0, l'envoi part avec le SIREN sandbox partagé Zenbat.
  const handleSendPDP = async () => {
    if (!lignes.length) { setExportMsg("Ajoutez au moins une ligne avant d'envoyer."); return; }
    if (invoice.pdp_invoice_id) { setExportMsg("Cette facture a déjà été transmise à Super PDP."); return; }
    // Champs obligatoires EN 16931 / Peppol côté vendeur :
    //   BT-27 Name        → brand.companyName ou nom/prénom
    //   BT-30 Legal id    → brand.siret (le XML extrait le SIREN à la volée)
    //   BT-34 Electronic  → SIRET / SIREN / email (au moins l'email)
    const sellerSiret = String(brand?.siret || "").replace(/\s+/g, "");
    if (!sellerSiret) {
      setExportMsg("❌ Renseignez votre SIRET dans votre profil avant d'envoyer une facture électronique (Compte → Profil).");
      return;
    }
    if (sellerSiret.length < 9) {
      setExportMsg("❌ SIRET invalide dans votre profil — il doit contenir 14 chiffres.");
      return;
    }
    setSendingPDP(true); setExportMsg(null);
    // Hoist hors du try : ces variables sont référencées dans le catch
    // (block scoping const/let : try et catch sont des blocs séparés).
    let sandboxSiren = "";
    let receiverPeppol = "";
    try {
      // V0 — la sandbox Zenbat sur Super PDP est liée à un SIREN partagé.
      // Super PDP exige sender SIREN == app SIREN, sinon rejet :
      //   "L'entreprise X liée à cette session ne correspond pas au vendeur".
      // On récupère le SIREN de l'app OAuth puis on swap juste pour le XML CII
      // embarqué (le PDF visuel garde le vrai SIRET de l'artisan).
      const companyInfo = await pdp.testConnection();
      sandboxSiren = String(companyInfo?.number || "").replace(/\D/g, "");
      if (!sandboxSiren) {
        throw new Error("Identité Super PDP introuvable (vérifie les credentials Vercel).");
      }
      // Reconstruit un SIRET 14 chiffres à partir du SIREN sandbox (NIC par défaut 00024).
      const sandboxSiret = (sandboxSiren + "00024").slice(0, 14).padStart(14, "0");
      const pdpBrand = {
        ...brand,
        siret: sandboxSiret,
        // Évite l'incohérence TVA/SIREN en sandbox
        tva: "",
      };
      // Super PDP exige que le receiver soit enrôlé dans l'annuaire Peppol-sandbox.
      // L'annuaire utilise le scheme 0225 avec un identifiant non-SIRET
      // (ex "315143296_6591"), pas un SIRET classique.
      // → on récupère l'adresse Peppol complète via l'env Vercel
      // PDP_SANDBOX_RECEIVER_PEPPOL exposée par test_connection.
      receiverPeppol = String(companyInfo?.sandbox_receiver_peppol || "").trim();
      if (!receiverPeppol) {
        throw new Error(
          "PDP_SANDBOX_RECEIVER_PEPPOL non configuré côté Vercel. " +
          "Va sur ton compte Super PDP → « lignes d'annuaire », copie l'adresse Peppol complète " +
          "(format \"0225:xxxxxxxxx_xxxx\", ligne en status receiver OK) et ajoute-la comme " +
          "variable d'environnement PDP_SANDBOX_RECEIVER_PEPPOL dans Vercel."
        );
      }
      if (!/^\d{4}:.+/.test(receiverPeppol)) {
        throw new Error(
          `Adresse Peppol receiver invalide : "${receiverPeppol}". Format attendu "<scheme>:<id>", ex "0225:315143296_6591".`
        );
      }
      // BT-49 buyer electronic address — override direct dans le XML CII via
      // client.peppolAddress consommé par api/facturx.js. Le siret du client
      // n'est pas swappé car le scheme 0225 n'est pas un SIRET.
      const pdpClient = {
        ...client,
        peppolAddress: receiverPeppol,
      };

      const [{ renderDataToPdf }] = await Promise.all([
        import("../lib/pdf.js"),
      ]);
      // Visual : on garde le brand + client RÉELS pour la cohérence UX du PDF
      const { base64 } = await renderDataToPdf(asDevisShape, client, brand, "facture", { filename: `${invoice.numero}.pdf` });

      const sourcePayload = isAvoir && sourceInvoice
        ? { numero: sourceInvoice.numero, date_emission: sourceInvoice.date_emission }
        : undefined;

      const token = await getToken();
      const fxRes = await fetch("/api/facturx", {
        method:  "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { "Authorization": `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          pdf_base64: base64,
          invoice:    { ...invoice, lignes },
          // XML CII : on injecte le SIRET sandbox pour seller ET buyer
          // afin de matcher l'app OAuth Super PDP et l'annuaire Peppol-sandbox.
          client:     pdpClient,
          brand:      pdpBrand,
          sourceInvoice: sourcePayload,
        }),
      });
      const fxData = await fxRes.json();
      if (!fxRes.ok) throw new Error(fxData?.error || `Factur-X HTTP ${fxRes.status}`);

      const result = await pdp.sendInvoice(invoice.id, fxData.pdf_base64);

      onChange({
        ...invoice,
        statut:         "envoyee",
        locked:         true,
        pdp_invoice_id: result.pdp_invoice_id,
        pdp_status:     "sent",
        pdp_status_raw: "fr:200",
      }, false);

      setExportMsg(`✓ Facture transmise à Super PDP (id ${result.pdp_invoice_id}). En sandbox — émetteur SIREN ${sandboxSiren} (app OAuth) → destinataire ${receiverPeppol} (Peppol-sandbox). Le PDF visuel garde vos vraies infos.`);
    } catch (err) {
      console.error("[superpdp/send]", err, "detail:", err?.detail);
      const raw = String(err.message || err);
      // Pre-check Peppol : message plus parlant que le brut Super PDP
      const friendly = /receiver address does not exist in peppol directory/i.test(raw)
        ? `L'adresse Peppol destinataire (${receiverPeppol || "—"}) n'est pas trouvée dans l'annuaire Peppol-sandbox de Super PDP. Recopie EXACTEMENT l'adresse depuis ton compte Super PDP → "lignes d'annuaire" (la ligne en status receiver OK, format 0225:xxxxxxxxx_xxxx) dans la variable Vercel PDP_SANDBOX_RECEIVER_PEPPOL.`
        : raw;
      // Inclut le détail brut Super PDP pour diagnostic (validation XML, etc.)
      const detailStr = err?.detail
        ? "\n\nDétail Super PDP : " + (typeof err.detail === "string" ? err.detail : JSON.stringify(err.detail).slice(0, 400))
        : "";
      setExportMsg("❌ Échec envoi Super PDP : " + friendly + detailStr);
    } finally {
      setSendingPDP(false);
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
          .detail-preview{display:flex !important;flex-direction:column;width:58%;flex-shrink:0;border-left:1px solid #E8E2D8;overflow-y:auto}
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
      <div className="detail-shell" style={{ background: "#FAF7F2", minHeight: "100%", display: "flex", flexDirection: "column" }}>
        <div className="detail-row" style={{ flex: 1, display: "flex" }}>
          <div className="detail-editor" style={{ flex: 1, minWidth: 0 }}>

      <div style={{ background: "white", borderBottom: "1px solid #F0EBE3", padding: "10px 14px" }}>
        {/* Barre : Retour + actions */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <button onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 5, background: "none", border: "none", color: "#6B6358", fontSize: 13, cursor: "pointer", flexShrink: 0, padding: "4px 0" }}>
            ← Retour
          </button>
          <div style={{ flex: 1 }}/>
          <div style={{ display: "flex", gap: 5 }}>
            {!isLocked ? (
              <button onClick={onDelete}
                style={{ background: "#fef2f2", color: "#b91c1c", border: "1px solid #fecaca", borderRadius: 8, padding: "5px 10px", fontSize: 11, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>
                🗑 Supprimer
              </button>
            ) : (
              <button onClick={onDelete}
                title="Une facture émise ne peut être que masquée (conservée 10 ans en base, art. L102 B LPF)."
                style={{ background: "#FAF7F2", color: "#6B6358", border: "1px solid #E8E2D8", borderRadius: 8, padding: "5px 10px", fontSize: 11, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>
                Masquer
              </button>
            )}
            <button onClick={handleFacturX} disabled={exporting || !lignes.length}
              style={{ background: exporting || !lignes.length ? "#cbd5e1" : "#1A1612", color: "white", border: "none", borderRadius: 8, padding: "5px 10px", fontSize: 11, fontWeight: 700, cursor: exporting || !lignes.length ? "not-allowed" : "pointer", whiteSpace: "nowrap" }}>
              {exporting ? "⏳…" : isLocked ? "⬇ Factur-X" : "🔒 Émettre"}
            </button>
            {!invoice.pdp_invoice_id && (
              <button onClick={handleSendPDP} disabled={sendingPDP || exporting || !lignes.length}
                title="Envoyer la facture à Super PDP (sandbox de test)"
                style={{ background: sendingPDP || !lignes.length ? "#cbd5e1" : "#0e7490", color: "white", border: "none", borderRadius: 8, padding: "5px 10px", fontSize: 11, fontWeight: 700, cursor: sendingPDP || !lignes.length ? "not-allowed" : "pointer", whiteSpace: "nowrap" }}>
                {sendingPDP ? "⏳…" : "📡 PDP test"}
              </button>
            )}
          </div>
        </div>
        {/* Numero + badge */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <div style={{ fontSize: 11, color: "#9A8E82", fontFamily: "monospace", flex: 1 }}>{invoice.numero}</div>
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
        {invoice.pdp_invoice_id && (
          <div style={{ background: "#ecfeff", border: "1px solid #a5f3fc", color: "#0e7490", padding: "8px 10px", borderRadius: 10, fontSize: 11, marginBottom: 8, display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 14 }}>📡</span>
            <span>
              <strong>Transmise à Super PDP</strong> — id <code style={{ fontFamily: "monospace" }}>{invoice.pdp_invoice_id}</code>
              {invoice.pdp_status_raw ? <> · code AFNOR <code style={{ fontFamily: "monospace" }}>{invoice.pdp_status_raw}</code></> : null}
              {" "}(sandbox v0)
            </span>
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
          style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, background: isLocked ? "#F0EBE3" : "#FAF7F2", border: "1px solid #E8E2D8", borderRadius: 10, padding: "7px 10px", marginBottom: 8, cursor: isLocked ? "not-allowed" : "pointer", textAlign: "left" }}>
          <span style={{ fontSize: 16 }}>👤</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: isLocked ? "#9A8E82" : "#1A1612", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {client ? (client.raison_sociale || `${client.prenom || ""} ${client.nom || ""}`.trim()) : <span style={{ color: "#9A8E82", fontStyle: "italic" }}>Sans client</span>}
            </div>
            {client?.email && <div style={{ fontSize: 11, color: "#9A8E82" }}>{client.email}</div>}
          </div>
          {!isLocked && <span style={{ fontSize: 11, color: "#9A8E82", flexShrink: 0 }}>Changer ›</span>}
        </button>

        <label style={{ display: "block", fontSize: 10, color: "#9A8E82", fontWeight: 600, marginBottom: 2 }}>OBJET</label>
        <input
          value={invoice.objet || ""}
          onChange={e => onChange({ ...invoice, objet: e.target.value })}
          disabled={isLocked}
          placeholder="Objet de la facture"
          style={{ fontSize: 14, fontWeight: 700, color: isLocked ? "#9A8E82" : "#1A1612", border: "1px solid #E8E2D8", borderRadius: 8, background: isLocked ? "#F0EBE3" : "#FAF7F2", outline: "none", width: "100%", padding: "7px 10px", fontFamily: "inherit", marginBottom: 8, boxSizing: "border-box", cursor: isLocked ? "not-allowed" : "text" }}
        />
        <label style={{ display: "block", fontSize: 10, color: "#9A8E82", fontWeight: 600, marginBottom: 2 }}>LIEU</label>
        <input
          value={invoice.ville_chantier || ""}
          onChange={e => onChange({ ...invoice, ville_chantier: e.target.value })}
          disabled={isLocked}
          placeholder="Ville / lieu"
          style={{ fontSize: 13, color: "#6B6358", border: "1px solid #E8E2D8", borderRadius: 8, background: isLocked ? "#F0EBE3" : "#FAF7F2", outline: "none", width: "100%", padding: "7px 10px", fontFamily: "inherit", boxSizing: "border-box", cursor: isLocked ? "not-allowed" : "text" }}
        />
      </div>

      <div style={{ padding: 16 }}>
        <button className="detail-pdf-btn" onClick={() => setShowPDF(true)}
          style={{ width: "100%", background: `linear-gradient(135deg,${ac}ee,${ac})`, color: "white", border: "none", borderRadius: 16, padding: 16, fontSize: 14, fontWeight: 700, cursor: "pointer", boxShadow: `0 6px 20px ${ac}44`, marginBottom: 12 }}>
          {invoice.statut === "brouillon" ? "👁 Aperçu brouillon" : "Voir le PDF de la facture"}
        </button>

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

        <div style={{ background: "white", borderRadius: 14, border: "1px solid #F0EBE3", padding: 14, marginBottom: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#6B6358", marginBottom: 6 }}>
            <span>Total HT</span><span style={{ color: "#1A1612", fontWeight: 600 }}>{fmt(ht)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#6B6358", marginBottom: 6 }}>
            <span>TVA</span><span style={{ color: "#1A1612", fontWeight: 600 }}>{fmt(tva)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, paddingTop: 6, borderTop: "1px solid #F0EBE3", marginTop: 6 }}>
            <span style={{ fontWeight: 700, color: "#1A1612" }}>Total TTC</span>
            <span style={{ fontWeight: 700, color: ac }}>{fmt(ttc)}</span>
          </div>
          {retenue > 0 && (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#b45309", marginTop: 6 }}>
                <span>Retenue de garantie {invoice.retenue_garantie_pct}%</span>
                <span>−{fmt(retenue)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, paddingTop: 6, borderTop: "1px solid #F0EBE3", marginTop: 6 }}>
                <span style={{ fontWeight: 700, color: "#1A1612" }}>Net à payer</span>
                <span style={{ fontWeight: 700, color: "#1A1612" }}>{fmt(netAPayer)}</span>
              </div>
            </>
          )}
        </div>

        <div style={{ background: "white", borderRadius: 14, border: "1px solid #F0EBE3", padding: 14, marginBottom: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#1A1612", marginBottom: 10 }}>Spécificités sectorielles</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <div style={{ fontSize: 10, color: "#6B6358", marginBottom: 4 }}>Type d'opération</div>
                <select value={invoice.operation_type || "service"}
                  onChange={e => onChange({ ...invoice, operation_type: e.target.value }, false)}
                  disabled={isLocked}
                  style={{ width: "100%", border: "1px solid #e5e7eb", borderRadius: 8, padding: "7px 8px", fontSize: 12, background: isLocked ? "#F0EBE3" : "white", cursor: isLocked ? "not-allowed" : "pointer" }}>
                  <option value="service">Prestation de service</option>
                  <option value="vente">Vente de biens</option>
                  <option value="mixte">Mixte</option>
                </select>
              </div>
              <div>
                <div style={{ fontSize: 10, color: "#6B6358", marginBottom: 4 }}>Retenue garantie (%)</div>
                <input type="number" min="0" max="5" step="0.5"
                  value={invoice.retenue_garantie_pct || 0}
                  onChange={e => {
                    const pct = Number(e.target.value) || 0;
                    onChange({ ...invoice, retenue_garantie_pct: pct, retenue_garantie_eur: Math.round(ht * pct) / 100 }, false);
                  }}
                  disabled={isLocked}
                  style={{ width: "100%", border: "1px solid #e5e7eb", borderRadius: 8, padding: "7px 8px", fontSize: 12, background: isLocked ? "#F0EBE3" : "white", cursor: isLocked ? "not-allowed" : "text" }}/>
              </div>
            </div>
            <label style={{ display: "flex", alignItems: "flex-start", gap: 8, marginTop: 12, cursor: isLocked ? "not-allowed" : "pointer", opacity: isLocked ? 0.6 : 1 }}>
              <input type="checkbox"
                checked={!!invoice.auto_liquidation_btp}
                onChange={e => onChange({ ...invoice, auto_liquidation_btp: e.target.checked }, false)}
                disabled={isLocked}
                style={{ marginTop: 2, accentColor: "#22c55e", cursor: isLocked ? "not-allowed" : "pointer" }}/>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#1A1612" }}>Auto-liquidation TVA (sous-traitance BTP)</div>
                <div style={{ fontSize: 10, color: "#6B6358", marginTop: 2, lineHeight: 1.4 }}>
                  Force la TVA à 0 % sur toutes les lignes et ajoute la mention <em>« Autoliquidation — TVA due par le preneur, art. 283-2 nonies CGI »</em> sur le PDF. À cocher uniquement si vous facturez en tant que sous-traitant BTP à un donneur d'ordre assujetti.
                </div>
              </div>
            </label>
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
