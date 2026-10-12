// Fiche facture (système « Bordereau ») : même bordereau que la fiche devis,
// statut en tampon, une seule action principale selon l'état — Émettre
// (confirmé : la facture devient immuable), Envoyer au client, Marquer comme
// payée — dans une barre collée en bas.
import { useEffect, useRef, useState } from "react";
import { fmt, uid, downloadBlob } from "../lib/utils.js";
import { computeTotals, invoiceAmounts } from "../lib/invoiceCalc.js";
import { ZB, NUM } from "../lib/theme.js";
import { I } from "./ui/icons.jsx";
import PDFViewer from "./PDFViewer.jsx";
import StatusStamp from "./devis/StatusStamp.jsx";
import { sectionsOf, Line, LineEditor, LotEditor, LotHeading, Totals, BORDEREAU_CSS, ICON } from "./bordereau/parts.jsx";
import { RowMenu, btnPrimary, btnSecondary } from "./ui/Register.jsx";
import ClientPickerModal from "./app/ClientPickerModal.jsx";
import { getToken } from "../lib/getToken.js";
import { isChunkLoadError, isLegacyCacheError, tryReloadOnce } from "../lib/chunkReload.js";

// Si un nouveau Service Worker est en attente (déploiement Vercel récent),
// on l'active de force et on recharge. Sert de "filet de sécurité" pour les
// utilisateurs piégés sur l'ancien bundle quand le serveur a déjà la nouvelle
// version : plutôt que de leur afficher un message d'erreur, on récupère
// silencieusement la dernière version. updateSW est exposé sur window par
// main.jsx (au montage du registerSW).
function forcePendingSWUpdateOrReload() {
  try {
    const updateSW = window.__zenbatSWUpdate__;
    if (window.__zenbatSWUpdateReady__ && typeof updateSW === "function") {
      // skipWaiting + reload propre via vite-plugin-pwa
      updateSW(true);
      return true;
    }
  } catch { /* ignore */ }
  return tryReloadOnce();
}

export default function InvoiceDetail({ invoice, client, clients = [], brand, invoices, onBack, onChange, onCreateAvoir, onDelete, flushSave }) {
  const [showPDF,        setShowPDF]        = useState(false);
  const [exporting,      setExporting]      = useState(false);
  const [exportMsg,      setExportMsg]      = useState(null);
  const [clientPicker,   setClientPicker]   = useState(false);
  const [showSendForm,   setShowSendForm]   = useState(false);
  const [sendMessage,    setSendMessage]    = useState("");
  const [sending,        setSending]        = useState(false);
  const [sendStatusMsg,  setSendStatusMsg]  = useState(null);
  const [deleting,       setDeleting]       = useState(false);
  const [creatingAvoir,  setCreatingAvoir]  = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [statusMsg,      setStatusMsg]      = useState(null);
  const [proformaBusy,   setProformaBusy]   = useState(false);
  const [editingId,      setEditingId]      = useState(null);
  // Émission et création d'avoir : confirmation dans la barre d'action.
  const [confirm,        setConfirm]        = useState(null);
  const safeDelete = async () => {
    if (deleting || !onDelete) return;
    setDeleting(true);
    try { await onDelete(); } finally { setDeleting(false); }
  };

  const lignes = invoice.lignes || [];
  const franchise = brand.vatRegime === "franchise";
  const autoLiq   = !!invoice.auto_liquidation_btp;
  const noTva     = franchise || autoLiq;
  const totals = computeTotals(lignes, { noTva });
  const { ht, ttc } = totals;
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
    // HT, TVA et TTC recalculés ensemble : le XML Factur-X, la liste et
    // l'export comptable lisent montant_tva / montant_ttc.
    onChange({
      ...invoice,
      lignes: newLignes,
      ...invoiceAmounts(newLignes, brand.vatRegime, autoLiq),
    }, true);
  };

  const handleFacturX = async () => {
    if (!lignes.length) { setExportMsg({ error: true, text: "Ajoute au moins une ligne avant d'émettre." }); return; }
    setExporting(true); setExportMsg(null);
    const wasLocked = isLocked;
    let current = invoice;
    try {
      const token = await getToken();
      const authHeaders = {
        "Content-Type": "application/json",
        ...(token ? { "Authorization": `Bearer ${token}` } : {}),
      };

      // 1. Émission : le serveur relit les lignes en base, attribue le numéro
      //    suivant et la date du jour, fige les montants et verrouille la
      //    facture, en une transaction (migration 0060). La dernière
      //    modification à l'écran doit donc être enregistrée avant.
      if (!wasLocked) {
        try { await flushSave?.(); }
        catch { throw new Error("la dernière modification n'est pas enregistrée. Vérifie ta connexion, puis réessaie."); }
        const r = await fetch("/api/facturx", {
          method: "POST", headers: authHeaders,
          body: JSON.stringify({ action: "emit", invoice_id: invoice.id }),
        });
        const e = await r.json().catch(() => ({}));
        if (!r.ok || !e?.numero) throw new Error(e?.error || `HTTP ${r.status}`);
        current = {
          ...invoice,
          numero: e.numero, date_emission: e.date_emission, date_echeance: e.date_echeance,
          statut: e.statut || "envoyee", locked: true,
          ...(e.montant_ttc != null ? { montant_ht: e.montant_ht, montant_tva: e.montant_tva, montant_ttc: e.montant_ttc } : {}),
        };
        // La base est à jour : on synchronise l'écran sans ré-enregistrer.
        onChange(current, false, true);
      }

      // 2. PDF Factur-X de la facture émise (numéro et date définitifs).
      const { renderDataToPdf } = await import("../lib/pdf.js");
      const { base64 } = await renderDataToPdf({ ...current, lignes, montant_ht: ht, tva_rate: 20 }, client, brand, "facture", { filename: `${current.numero}.pdf` });

      // Appelle le serveur pour l'assemblage PDF/A-3 (OutputIntent, XMP, XML embed)
      // Si la facture est un avoir, on transmet les infos de la facture d'origine
      // pour que l'XML Factur-X émette TypeCode=381 + InvoiceReferencedDocument.
      const sourcePayload = isAvoir && sourceInvoice
        ? { numero: sourceInvoice.numero, date_emission: sourceInvoice.date_emission }
        : undefined;

      const res = await fetch("/api/facturx", {
        method:  "POST",
        headers: authHeaders,
        body:    JSON.stringify({
          pdf_base64: base64,
          invoice:    { ...current, lignes },
          client,
          brand,
          sourceInvoice: sourcePayload,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      if (!data?.pdf_base64) throw new Error("Réponse serveur incomplète (pdf_base64 manquant)");

      // Décodage base64 → Blob via fetch(data:) : plus robuste que atob() qui,
      // sur iOS Safari, rejette toute chaîne contenant des caractères hors
      // alphabet base64 strict avec « The string did not match the expected
      // pattern. ». fetch sur data: URL passe par le décodeur interne du
      // navigateur, plus tolérant et sans la limite de taille de String.
      const cleanB64 = String(data.pdf_base64).replace(/\s/g, "");
      const blob = await fetch(`data:application/pdf;base64,${cleanB64}`).then(r => r.blob());
      // Garde-fou : un PDF Factur-X conforme fait toujours plusieurs Ko. Sous
      // 1 Ko, c'est forcément une troncature/corruption silencieuse — on
      // préfère un message d'erreur qu'un téléchargement de fichier cassé
      // que l'artisan ne remarquerait qu'en l'ouvrant.
      if (blob.size < 1024) throw new Error("PDF reçu incomplet, réessaie l'émission.");
      downloadBlob(blob, `${current.numero}-facturx.pdf`);

      if (!data.icc_applied) console.warn("[facturx] profil sRGB absent (public/icc/sRGB.icc) : PDF/A-3 non strict.");
      const done = wasLocked
        ? "PDF Factur-X téléchargé."
        : `${isAvoir ? "Avoir émis" : "Facture émise"} sous le n° ${current.numero}. Le PDF Factur-X (EN 16931) est téléchargé.`;
      setExportMsg(data.archive_warning
        ? { error: true, text: `${wasLocked ? "" : done + " "}${data.archive_warning}` }
        : { error: false, text: done });
    } catch (err) {
      console.error("[facturx]", err);
      // 1) Chunk JS introuvable après redéploiement (Vercel a changé les
      //    hashes) → on recharge pour récupérer le nouveau index.html.
      // 2) Erreur "vieux cache" (ex. atob iOS Safari) : on est sûr que ce
      //    code path n'existe plus dans la version courante → reload.
      // 3) Un nouveau SW est déjà prêt en arrière-plan → on l'active maintenant
      //    sans rien demander à l'utilisateur (mieux qu'un toast d'erreur).
      if (isChunkLoadError(err) || isLegacyCacheError(err) || window.__zenbatSWUpdateReady__) {
        if (forcePendingSWUpdateOrReload()) return;
      }
      setExportMsg({ error: true, text: current.locked && !wasLocked
        ? `${isAvoir ? "Avoir émis" : "Facture émise"} sous le n° ${current.numero}, mais le PDF Factur-X n'a pas pu être généré : ${err.message || err}. Réessaie depuis la facture.`
        : (wasLocked ? "Le PDF Factur-X n'a pas pu être généré : " : "L'émission a échoué : ") + (err.message || err) });
    } finally {
      setExporting(false);
    }
  };

  // Génère un PDF « facture pro forma » depuis le brouillon (document
  // commercial sans valeur fiscale) — n'émet ni ne verrouille la facture.
  const handleProforma = async () => {
    if (proformaBusy || !lignes.length) return;
    setProformaBusy(true);
    try {
      const { renderDataToPdf } = await import("../lib/pdf.js");
      const safe = String(invoice.numero || "facture").replace(/[^a-zA-Z0-9._-]/g, "_");
      const name = `Pro-forma-${safe}.pdf`;
      const { blob } = await renderDataToPdf(asDevisShape, client, brand, "proforma", { filename: name });
      downloadBlob(blob, name);
    } catch (err) {
      console.error("[proforma]", err);
      setExportMsg({ error: true, text: "La pro forma n'a pas pu être générée : " + (err.message || err) });
    } finally {
      setProformaBusy(false);
    }
  };

  const handleSend = async () => {
    setSending(true); setSendStatusMsg(null);
    try {
      const token = await getToken();
      const res = await fetch("/api/facturx", {
        method:  "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { "Authorization": `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          action:     "send",
          invoice_id: invoice.id,
          message:    sendMessage?.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      // Facture verrouillée : onSaveInvoice (cf useInvoices.js) ne fera qu'un
      // setInvoices local, sans UPDATE redondant. La DB a déjà été mise à jour
      // côté serveur par /api/facturx?action=send.
      onChange({
        ...invoice,
        sent_to_client_at:    data.sent_at,
        sent_to_client_count: data.sent_to_client_count,
      }, false);
      setSendStatusMsg({ error: false, text: `Envoyée à ${client.email}.` });
      setShowSendForm(false);
      setSendMessage("");
    } catch (err) {
      console.error("[invoice/send]", err);
      setSendStatusMsg({ error: true, text: "L'envoi a échoué : " + (err.message || "réessaie.") });
    } finally {
      setSending(false);
    }
  };

  // Statuts de paiement modifiables après émission. Le contenu reste
  // verrouillé (CGI art. 289) — seul ce suivi évolue, persisté côté serveur
  // via /api/facturx (service_role) car la RLS bloque tout UPDATE client sur
  // une facture verrouillée.
  const STATUS_OPTIONS = [
    { value: "envoyee", label: "En attente" },
    { value: "payee",   label: "Payée" },
    { value: "rejetee", label: "Impayée" },
    // Libellé seulement : « Annulée » ne se choisit plus, une facture émise se corrige par un avoir.
    { value: "annulee", label: "Annulée" },
  ];
  const changeStatus = async (newStatut) => {
    if (statusUpdating || newStatut === invoice.statut) return;
    setStatusUpdating(true); setStatusMsg(null);
    try {
      const token = await getToken();
      const res = await fetch("/api/facturx", {
        method:  "POST",
        headers: { "Content-Type": "application/json", ...(token ? { "Authorization": `Bearer ${token}` } : {}) },
        body:    JSON.stringify({ action: "set_status", invoice_id: invoice.id, statut: newStatut }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      // skipPersist=true : la DB est déjà à jour (service_role). On synchronise
      // le state local sans UPDATE client (rejeté par la RLS car verrouillée).
      onChange({ ...invoice, statut: data.statut }, false, true);
      setStatusMsg({ error: false, text: `Paiement : ${STATUS_OPTIONS.find(o => o.value === data.statut)?.label || data.statut}.` });
    } catch (err) {
      console.error("[invoice/set-status]", err);
      setStatusMsg({ error: true, text: "Le statut n'a pas changé : " + (err.message || "réessaie.") });
    } finally {
      setStatusUpdating(false);
    }
  };

  const formatSentAt = (iso) => {
    if (!iso) return "";
    try {
      return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
    } catch { return ""; }
  };

  // Adapte la facture au format attendu par PDFViewer (qui parle "devis")
  const asDevisShape = {
    ...invoice,
    lignes,
    montant_ht: ht,
    tva_rate: 20,
  };

  // ── Lignes (bordereau partagé avec la fiche devis) ─────────────────────
  const hasLotRows = lignes.some(l => l.type_ligne === "lot");
  const sections   = sectionsOf(lignes);
  const ouvrages   = lignes.filter(l => l.type_ligne === "ouvrage");
  const changeLine = (id, patch) => updateLignes(lignes.map(l => l.id === id ? { ...l, ...patch } : l));
  const deleteLine = (id) => { updateLignes(lignes.filter(l => l.id !== id)); setEditingId(null); };
  const moveLine = (id, dir) => {
    const i = lignes.findIndex(l => l.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= lignes.length) return;
    const arr = [...lignes];
    [arr[i], arr[j]] = [arr[j], arr[i]];
    updateLignes(arr);
  };
  const addLine = () => {
    const id = uid();
    updateLignes([...lignes, { id, type_ligne: "ouvrage", designation: "", lot: "", unite: "u", quantite: 1, prix_unitaire: 0, tva_rate: noTva ? 0 : 20 }]);
    setEditingId(id);
  };
  const addLot = () => {
    const id = uid();
    updateLignes([...lignes, { id, type_ligne: "lot", designation: "NOUVEAU LOT", lot: "" }]);
    setEditingId(id);
  };

  const clientName = client ? (client.raison_sociale || `${client.prenom || ""} ${client.nom || ""}`.trim() || client.email) : null;
  const email = client?.email;
  const typeLabel = isAvoir ? "Avoir" : invoice.invoice_type === "acompte" ? "Facture d'acompte" : invoice.invoice_type === "solde" ? "Facture de solde" : "Facture";
  const dateLabel = invoice.date_emission ? formatSentAt(invoice.date_emission) : formatSentAt(invoice.created_at);
  const msgBox = (m) => m && (
    <p role={m.error ? "alert" : "status"} style={{ margin: "0 0 12px", padding: "10px 12px", borderRadius: 8, fontSize: 15, lineHeight: 1.45,
      background: m.error ? ZB.dangerSoft : ZB.stampSoft, color: m.error ? ZB.danger : ZB.ink }}>{m.text}</p>
  );

  // ── Zone d'action : une seule action principale selon l'état ────────────
  let actionBar = null;
  if (confirm === "emit") {
    actionBar = (
      <div role="group" aria-label="Confirmer l'émission" style={{ display: "grid", gap: 10 }}>
        <p style={{ margin: 0, fontSize: 15, lineHeight: 1.45 }}>
          Émettre {isAvoir ? "l'avoir" : "la facture"} (<span style={NUM}>{fmt(ttc)}</span> TTC){clientName ? <> pour <strong>{clientName}</strong></> : null} ?
          {isAvoir ? "Il" : "Elle"} recevra le numéro suivant et la date d'aujourd'hui, puis sera <strong>{isAvoir ? "verrouillé" : "verrouillée"}</strong> : plus aucune modification possible (CGI art. 289). Pour corriger ensuite, il faudra un avoir.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 8 }}>
          <button type="button" style={btnSecondary} onClick={() => setConfirm(null)}>Annuler</button>
          <button type="button" style={{ ...btnPrimary, opacity: exporting ? 0.7 : 1 }} disabled={exporting}
            onClick={async () => { await handleFacturX(); setConfirm(null); }}>
            {exporting ? "Émission…" : "Oui, émettre"}
          </button>
        </div>
      </div>
    );
  } else if (confirm === "rejetee") {
    actionBar = (
      <div role="group" aria-label="Confirmer l'impayé" style={{ display: "grid", gap: 10 }}>
        <p style={{ margin: 0, fontSize: 15, lineHeight: 1.45 }}>
          Noter <strong>{invoice.numero}</strong> (<span style={NUM}>{fmt(ttc)}</span> TTC) comme impayée{clientName ? <> par <strong>{clientName}</strong></> : null} ? Tu pourras la remettre en attente.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 8 }}>
          <button type="button" style={btnSecondary} onClick={() => setConfirm(null)}>Annuler</button>
          <button type="button" style={{ ...btnPrimary, background: ZB.danger }} disabled={statusUpdating}
            onClick={async () => { await changeStatus("rejetee"); setConfirm(null); }}>
            Oui, impayée
          </button>
        </div>
      </div>
    );
  } else if (confirm === "payee") {
    actionBar = (
      <div role="group" aria-label="Confirmer le paiement" style={{ display: "grid", gap: 10 }}>
        <p style={{ margin: 0, fontSize: 15, lineHeight: 1.45 }}>
          Noter <strong>{invoice.numero}</strong> (<span style={NUM}>{fmt(ttc)}</span> TTC) comme payée{clientName ? <> par <strong>{clientName}</strong></> : null} ? Tu pourras la remettre en attente.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 8 }}>
          <button type="button" style={btnSecondary} onClick={() => setConfirm(null)}>Annuler</button>
          <button type="button" style={{ ...btnPrimary, opacity: statusUpdating ? 0.7 : 1 }} disabled={statusUpdating}
            onClick={async () => { await changeStatus("payee"); setConfirm(null); }}>
            {statusUpdating ? "Mise à jour…" : "Oui, elle est payée"}
          </button>
        </div>
      </div>
    );
  } else if (confirm === "avoir") {
    actionBar = (
      <div role="group" aria-label="Confirmer l'avoir" style={{ display: "grid", gap: 10 }}>
        <p style={{ margin: 0, fontSize: 15, lineHeight: 1.45 }}>
          Créer un avoir pour <strong>{invoice.numero}</strong> ? Un brouillon reprend les mêmes lignes : ajuste les quantités avant de l'émettre.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 8 }}>
          <button type="button" style={btnSecondary} onClick={() => setConfirm(null)}>Annuler</button>
          <button type="button" style={btnPrimary} disabled={creatingAvoir}
            onClick={async () => {
              setCreatingAvoir(true);
              try { await onCreateAvoir(invoice.id); } finally { setCreatingAvoir(false); setConfirm(null); }
            }}>
            {creatingAvoir ? "Création…" : "Créer l'avoir"}
          </button>
        </div>
      </div>
    );
  } else if (!isLocked) {
    actionBar = lignes.length
      ? <button type="button" className="zb-primary" style={{ ...btnPrimary, width: "100%", minHeight: 52 }} onClick={() => setConfirm("emit")}>{isAvoir ? "Émettre l'avoir" : "Émettre la facture"}</button>
      : <p style={{ margin: 0, fontSize: 15, color: ZB.ink2 }}>Ajoute des lignes pour pouvoir émettre la facture.</p>;
  } else if (!isAvoir && showSendForm && email) {
    actionBar = (
      <div style={{ display: "grid", gap: 10 }}>
        <p style={{ margin: 0, fontSize: 15, lineHeight: 1.45 }}>
          Envoyer <strong>{invoice.numero}</strong> à <strong>{email}</strong>, au nom de {brand.companyName || "ton entreprise"}, avec le PDF Factur-X en pièce jointe.
          {brand.email && <> Les réponses arrivent sur {brand.email}.</>}
        </p>
        <label>
          <span className="zb-sr">Message au client (facultatif)</span>
          <textarea value={sendMessage} onChange={e => setSendMessage(e.target.value)} rows={2} disabled={sending}
            placeholder="Message au client (facultatif)"
            style={{ width: "100%", boxSizing: "border-box", minHeight: 64, padding: "10px 12px", border: `1px solid ${ZB.rule}`, borderRadius: 8, background: ZB.sheet, fontFamily: "inherit", fontSize: 16, color: ZB.ink, resize: "vertical" }}/>
        </label>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 8 }}>
          <button type="button" style={btnSecondary} disabled={sending} onClick={() => { setShowSendForm(false); setSendMessage(""); }}>Annuler</button>
          <button type="button" style={{ ...btnPrimary, opacity: sending ? 0.7 : 1 }} disabled={sending} onClick={handleSend}>
            {sending ? "Envoi…" : invoice.sent_to_client_at ? "Renvoyer" : "Envoyer"}
          </button>
        </div>
      </div>
    );
  } else if (!isAvoir) {
    const sentLine = invoice.sent_to_client_at
      ? <>Envoyée à {email || "ton client"} le {formatSentAt(invoice.sent_to_client_at)}{invoice.sent_to_client_count > 1 ? ` (${invoice.sent_to_client_count} envois)` : ""}.</>
      : null;
    if (!email) {
      actionBar = <p style={{ margin: 0, fontSize: 15, color: ZB.warn }}>Ajoute un email à {clientName || "ce client"} (onglet Clients) pour lui envoyer la facture.</p>;
    } else if (!invoice.sent_to_client_at) {
      actionBar = <button type="button" className="zb-primary" style={{ ...btnPrimary, width: "100%", minHeight: 52 }} onClick={() => { setShowSendForm(true); setSendStatusMsg(null); }}>Envoyer à {clientName}</button>;
    } else if (invoice.statut === "envoyee") {
      actionBar = (
        <div style={{ display: "grid", gap: 10 }}>
          {sentLine && <p style={{ margin: 0, fontSize: 14, color: ZB.ink2 }}>{sentLine}</p>}
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button type="button" className="zb-primary" style={{ ...btnPrimary, flex: 1, opacity: statusUpdating ? 0.7 : 1 }} disabled={statusUpdating} onClick={() => setConfirm("payee")}>
              {statusUpdating ? "Mise à jour…" : "Marquer comme payée"}
            </button>
            <button type="button" style={{ minHeight: 44, padding: "0 4px", background: "none", border: "none", color: ZB.accent, fontFamily: "inherit", fontSize: 15, fontWeight: 600, cursor: "pointer", flexShrink: 0 }}
              onClick={() => { setShowSendForm(true); setSendStatusMsg(null); }}>Renvoyer</button>
          </div>
        </div>
      );
    } else if (sentLine) {
      actionBar = <p style={{ margin: 0, fontSize: 14, color: ZB.ink2 }}>{sentLine}</p>;
    }
  }

  const menuItems = [
    !isLocked && lignes.length > 0 && { key: "pro", label: proformaBusy ? "Pro forma en cours…" : "Télécharger une pro forma", onClick: handleProforma },
    isLocked && { key: "fx", label: exporting ? "Préparation…" : "Télécharger le PDF Factur-X", onClick: handleFacturX },
    isLocked && !isAvoir && onCreateAvoir && { key: "avoir", label: "Créer un avoir", onClick: () => setConfirm("avoir") },
    onDelete && (!isLocked
      ? { key: "del", label: "Supprimer le brouillon", danger: true, confirmLabel: "Appuie encore pour supprimer", onClick: safeDelete }
      : { key: "hide", label: "Masquer de la liste", danger: true, confirmLabel: "Appuie encore : elle reste archivée 10 ans", onClick: safeDelete }),
  ];

  return (
    <>
      <style>{`
        ${BORDEREAU_CSS}
        @media (min-width:1024px){
          .detail-shell{height:100%;min-height:unset !important;overflow:hidden}
          .detail-row{height:100%}
          .detail-editor{overflow-y:auto}
          .detail-preview{display:flex !important;flex-direction:column;width:52%;flex-shrink:0;border-left:1px solid ${ZB.rule};overflow-y:auto}
          .detail-mobile-only{display:none !important}
        }
        .detail-shell button:focus-visible{outline:2px solid ${ZB.accent};outline-offset:2px}
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
      <div className="detail-shell" style={{ background: ZB.paper, minHeight: "100%", display: "flex", flexDirection: "column", fontFamily: ZB.font, color: ZB.ink }}>
        <div className="detail-row" style={{ flex: 1, display: "flex" }}>
          <div className="detail-editor" style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>

            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px 6px 6px", borderBottom: `1px solid ${ZB.rule}` }}>
              <button type="button" onClick={onBack}
                style={{ display: "flex", alignItems: "center", gap: 4, minHeight: 44, padding: "0 8px", background: "none", border: "none", color: ZB.ink, fontFamily: "inherit", fontSize: 15, fontWeight: 600, cursor: "pointer" }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>
                Factures
              </button>
              <div style={{ flex: 1 }}/>
              <button type="button" className="detail-mobile-only" onClick={() => setShowPDF(true)}
                style={{ display: "flex", alignItems: "center", gap: 6, minHeight: 44, padding: "0 8px", background: "none", border: "none", color: ZB.accent, fontFamily: "inherit", fontSize: 15, fontWeight: 600, cursor: "pointer" }}>
                {I.pdf} {invoice.statut === "brouillon" ? "Aperçu" : "PDF"}
              </button>
              <div style={{ border: `1px solid ${ZB.rule}`, borderRadius: 8, background: ZB.sheet }}>
                <RowMenu label="Plus d'actions" items={menuItems}/>
              </div>
            </div>

            <div style={{ flex: 1, padding: "14px 12px 0" }}>
              {msgBox(exportMsg)}
              {msgBox(sendStatusMsg)}
              {msgBox(statusMsg)}

              {isAvoir && (
                <p style={{ margin: "0 0 12px", padding: "10px 12px", background: ZB.paper2, borderRadius: 8, fontSize: 15, lineHeight: 1.4 }}>
                  Avoir : il rectifie la facture {sourceInvoice ? <strong>{sourceInvoice.numero}</strong> : "d'origine"}.
                </p>
              )}
              {isLocked && (
                <p style={{ margin: "0 0 12px", padding: "10px 12px", background: ZB.paper2, borderRadius: 8, fontSize: 15, color: ZB.ink2, lineHeight: 1.4 }}>
                  {isAvoir ? "Avoir émis : il ne se modifie plus." : "Facture émise : elle ne se modifie plus (CGI art. 289). Pour corriger, crée un avoir depuis le menu."}
                </p>
              )}

              <article className="zb-bordereau" aria-label={`${typeLabel} ${invoice.numero || ""}`}
                style={{ background: ZB.sheet, border: `1px solid ${ZB.rule}`, borderRadius: 8, padding: "18px 18px 20px" }}>
                <header style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 16, fontWeight: 700, ...NUM }}>{invoice.numero || "Brouillon"}</div>
                    <div style={{ fontSize: 13, color: ZB.ink2, marginTop: 4 }}>
                      {typeLabel}{dateLabel && <> · <span style={{ whiteSpace: "nowrap" }}>{dateLabel}</span></>}{invoice.devis_numero && <> · <span style={{ whiteSpace: "nowrap" }}>devis {invoice.devis_numero}</span></>}
                    </div>
                  </div>
                  <StatusStamp statut={invoice.statut} kind="facture" label={invoice.statut === "envoyee" && invoice.sent_to_client_at ? "Envoyée" : undefined}/>
                </header>
                {invoice.invoice_type === "acompte" && <p style={{ margin: "10px 0 0", fontSize: 14, color: ZB.ink2 }}>Acompte : il sera déduit de la facture de solde.</p>}
                {invoice.invoice_type === "solde" && <p style={{ margin: "10px 0 0", fontSize: 14, color: ZB.ink2 }}>Solde : le reste dû après déduction des acomptes.</p>}

                <button type="button" onClick={() => !isLocked && setClientPicker(true)} disabled={isLocked}
                  style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", minHeight: 56, marginTop: 14, padding: "8px 0",
                    background: "none", border: "none", borderTop: `1px solid ${ZB.ruleSoft}`, borderBottom: `1px solid ${ZB.ruleSoft}`,
                    textAlign: "left", fontFamily: "inherit", cursor: isLocked ? "default" : "pointer" }}>
                  <span style={{ fontSize: 13, color: ZB.ink2, width: 44, flexShrink: 0 }}>Client</span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: "block", fontSize: 15, fontWeight: 600, color: client ? ZB.ink : ZB.ink3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{clientName || "Aucun client"}</span>
                    {client && <span style={{ display: "block", fontSize: 13, color: email ? ZB.ink2 : ZB.warn }}>{email || "Pas d'email"}</span>}
                  </span>
                  {!isLocked && <span style={{ fontSize: 15, fontWeight: 600, color: ZB.accent, flexShrink: 0 }}>{client ? "Changer" : "Choisir"}</span>}
                </button>

                <label htmlFor="fa-objet" className="zb-sr">Objet de la facture</label>
                <AutoTextarea id="fa-objet" value={invoice.objet || ""} readOnly={isLocked} placeholder="Objet de la facture"
                  onChange={v => onChange({ ...invoice, objet: v })}/>
                {(!isLocked || invoice.ville_chantier) && <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
                  <label htmlFor="fa-lieu" style={{ fontSize: 13, color: ZB.ink2, flexShrink: 0 }}>Lieu du chantier</label>
                  <input id="fa-lieu" value={invoice.ville_chantier || ""} readOnly={isLocked} placeholder="À préciser"
                    onChange={e => !isLocked && onChange({ ...invoice, ville_chantier: e.target.value })}
                    style={{ flex: 1, minWidth: 0, minHeight: 36, padding: "4px 0", border: "none", borderBottom: `1px dotted ${ZB.rule}`, background: "none", fontFamily: "inherit", fontSize: 16, color: ZB.ink, outline: "none" }}/>
                </div>}

                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 18, paddingBottom: 8, borderBottom: `2px solid ${ZB.ink}`, fontSize: 13, fontWeight: 600, color: ZB.ink2 }}>
                  <span>Désignation <span style={{ fontWeight: 500 }}>· {ouvrages.length} ligne{ouvrages.length > 1 ? "s" : ""}</span></span><span>Montant HT</span>
                </div>
                {lignes.length === 0 && <p style={{ margin: "14px 0", fontSize: 15, color: ZB.ink2 }}>Aucune ligne pour l'instant.</p>}
                {sections.map((sec, si) => (
                  <section key={sec.lot?.id || `s${si}`} aria-label={sec.lot?.designation || "Prestations"}>
                    {sec.lot && (editingId === sec.lot.id && !sec.lot.virtual ? (
                      <LotEditor lot={sec.lot}
                        onChange={patch => changeLine(sec.lot.id, patch)}
                        onDelete={() => deleteLine(sec.lot.id)}
                        onDone={() => setEditingId(null)}
                        onMove={dir => moveLine(sec.lot.id, dir)}
                        canUp={sec.at > 0} canDown={sec.at < lignes.length - 1}/>
                    ) : (
                      <LotHeading lot={sec.lot} subtotal={sec.subtotal} onOpen={isLocked || sec.lot.virtual ? undefined : () => setEditingId(sec.lot.id)}/>
                    ))}
                    {sec.rows.map(({ l, idx }) => editingId === l.id ? (
                      <LineEditor key={l.id} l={l} franchise={noTva} withLot={!hasLotRows} withPercent
                        onChange={patch => changeLine(l.id, patch)}
                        onDelete={() => deleteLine(l.id)}
                        onDone={() => setEditingId(null)}
                        onMove={dir => moveLine(l.id, dir)}
                        canUp={idx > 0} canDown={idx < lignes.length - 1}/>
                    ) : (
                      <Line key={l.id} l={l} idx={idx} franchise={noTva} onOpen={isLocked ? undefined : () => setEditingId(l.id)}/>
                    ))}
                  </section>
                ))}
                {!isLocked && (
                  <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                    <button type="button" onClick={addLine} style={{ display: "flex", alignItems: "center", gap: 8, minHeight: 48, padding: "0 4px", background: "none", border: "none", color: ZB.accent, fontFamily: "inherit", fontSize: 15, fontWeight: 600, cursor: "pointer" }}>{ICON.plus} Ajouter une ligne</button>
                    <button type="button" onClick={addLot} style={{ display: "flex", alignItems: "center", gap: 8, minHeight: 48, padding: "0 4px", background: "none", border: "none", color: ZB.ink2, fontFamily: "inherit", fontSize: 15, fontWeight: 600, cursor: "pointer" }}>{ICON.plus} Ajouter un lot</button>
                  </div>
                )}
                {lignes.length > 0 && (
                  <>
                    <Totals ht={ht} tvaRows={totals.tvaRows} ttc={ttc} franchise={franchise} autoLiquidation={autoLiq && !franchise}/>
                    {retenue > 0 && (
                      <div style={{ ...NUM }}>
                        <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0 4px", fontSize: 14, color: ZB.ink2 }}>
                          <span>Retenue de garantie {String(invoice.retenue_garantie_pct).replace(".", ",")} %</span><span>−{fmt(retenue)}</span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "4px 0" }}>
                          <span style={{ fontSize: 16, fontWeight: 700 }}>Net à payer</span><span style={{ fontSize: 20, fontWeight: 700 }}>{fmt(netAPayer)}</span>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </article>

              {/* Suivi du paiement : le contenu reste verrouillé, seul ce suivi change.
                  « Payée » est l'action de la barre du bas ; ici, l'état et les corrections. */}
              {isLocked && !isAvoir && invoice.sent_to_client_at && (
                <section aria-label="Paiement" style={{ marginTop: 20, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap",
                  padding: "10px 0", borderTop: `1px solid ${ZB.rule}`, borderBottom: `1px solid ${ZB.rule}` }}>
                  <span style={{ fontSize: 15 }}>
                    Paiement : <strong style={{ color: invoice.statut === "payee" ? ZB.stamp : invoice.statut === "rejetee" ? ZB.danger : ZB.ink }}>
                      {STATUS_OPTIONS.find(o => o.value === invoice.statut)?.label || invoice.statut}
                    </strong>
                  </span>
                  {invoice.statut === "envoyee" ? (
                    <button type="button" disabled={statusUpdating} onClick={() => setConfirm("rejetee")}
                      style={{ minHeight: 44, padding: "0 4px", background: "none", border: "none", color: ZB.ink2, fontFamily: "inherit", fontSize: 15, fontWeight: 600, cursor: "pointer" }}>
                      Signaler un impayé
                    </button>
                  ) : ["payee", "rejetee"].includes(invoice.statut) ? (
                    <button type="button" disabled={statusUpdating} onClick={() => changeStatus("envoyee")}
                      style={{ minHeight: 44, padding: "0 4px", background: "none", border: "none", color: ZB.accent, fontFamily: "inherit", fontSize: 15, fontWeight: 600, cursor: "pointer" }}>
                      Remettre en attente
                    </button>
                  ) : null}
                </section>
              )}

              {/* Options de facturation : modifiables tant que la facture n'est pas émise
                  (une fois émise, elles figurent sur le PDF). */}
              {!isLocked && <section style={{ marginTop: 20 }}>
                <h2 style={{ margin: "0 0 8px", fontSize: 17, fontWeight: 700 }}>Options de facturation</h2>
                <div style={{ borderTop: `1px solid ${ZB.rule}` }}>
                  <div style={{ padding: "10px 0", borderBottom: `1px solid ${ZB.ruleSoft}` }}>
                    <span id="fa-op" style={{ display: "block", fontSize: 13, fontWeight: 600, color: ZB.ink2, marginBottom: 6 }}>Type d'opération</span>
                    <div role="radiogroup" aria-labelledby="fa-op" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
                      {[["service", "Prestation"], ["vente", "Vente de biens"], ["mixte", "Mixte"]].map(([v, lbl]) => {
                        const on = (invoice.operation_type || "service") === v;
                        return (
                          <button key={v} type="button" role="radio" aria-checked={on} disabled={isLocked}
                            onClick={() => onChange({ ...invoice, operation_type: v }, false)}
                            style={{ minHeight: 44, borderRadius: 8, border: `1px solid ${on ? ZB.accent : ZB.rule}`, background: on ? ZB.accentSoft : ZB.sheet,
                              color: on ? ZB.accent : ZB.ink, fontFamily: "inherit", fontSize: 14, fontWeight: on ? 700 : 500, cursor: isLocked ? "default" : "pointer", opacity: isLocked && !on ? 0.5 : 1 }}>
                            {lbl}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <label style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: `1px solid ${ZB.ruleSoft}` }}>
                    <span style={{ fontSize: 15 }}>Retenue de garantie <span style={{ color: ZB.ink2 }}>(0 à 5 %)</span></span>
                    <input type="number" inputMode="decimal" min="0" max="5" step="0.5" disabled={isLocked}
                      value={invoice.retenue_garantie_pct || 0}
                      onChange={e => {
                        const pct = Number(e.target.value) || 0;
                        onChange({ ...invoice, retenue_garantie_pct: pct, retenue_garantie_eur: Math.round(ht * pct) / 100 }, false);
                      }}
                      style={{ width: 88, minHeight: 44, padding: "0 10px", border: `1px solid ${ZB.rule}`, borderRadius: 8, background: isLocked ? ZB.paper2 : ZB.sheet, fontFamily: "inherit", fontSize: 16, textAlign: "right", color: ZB.ink, ...NUM }}/>
                  </label>
                  <label style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "12px 0", borderBottom: `1px solid ${ZB.ruleSoft}`, cursor: isLocked ? "default" : "pointer", opacity: isLocked ? 0.7 : 1 }}>
                    <input type="checkbox" checked={!!invoice.auto_liquidation_btp} disabled={isLocked}
                      onChange={e => onChange({ ...invoice, auto_liquidation_btp: e.target.checked, ...invoiceAmounts(lignes, brand.vatRegime, e.target.checked) }, false)}
                      style={{ width: 22, height: 22, marginTop: 1, accentColor: ZB.accent, flexShrink: 0 }}/>
                    <span>
                      <span style={{ display: "block", fontSize: 15, fontWeight: 600 }}>Autoliquidation de la TVA (sous-traitance BTP)</span>
                      <span style={{ display: "block", fontSize: 14, color: ZB.ink2, marginTop: 2, lineHeight: 1.45 }}>
                        TVA à 0 % et mention « Autoliquidation, TVA due par le preneur (art. 283-2 nonies du CGI) » sur le PDF. Seulement si tu factures en sous-traitant à un donneur d'ordre assujetti.
                      </span>
                    </span>
                  </label>
                </div>
              </section>}
              <div style={{ height: 16 }}/>
            </div>

            {actionBar && !editingId && (
              <div style={{ position: "sticky", bottom: 0, zIndex: 2, padding: "12px 12px 14px", background: ZB.paper, borderTop: `1px solid ${ZB.rule}` }}>
                <div style={{ maxWidth: 760, margin: "0 auto" }}>{actionBar}</div>
              </div>
            )}
          </div>

          <div className="detail-preview" style={{ display: "none", background: ZB.paper2 }}>
            <PDFViewer d={asDevisShape} cl={client} brand={brand} inline kind="facture" noDownload={invoice.statut === "brouillon"}/>
          </div>
        </div>
      </div>
    </>
  );
}

// Objet sur plusieurs lignes, à la manière du titre du document.
function AutoTextarea({ value, onChange, readOnly, ...rest }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
  }, [value]);
  return (
    <textarea ref={ref} rows={1} value={value} readOnly={readOnly}
      onChange={e => !readOnly && onChange(e.target.value)}
      onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); e.currentTarget.blur(); } }}
      className="zb-focus-ring"
      style={{ display: "block", width: "100%", margin: "14px 0 0", padding: "4px 0", border: "none", resize: "none", overflow: "hidden",
        background: "none", fontFamily: "inherit", fontSize: 21, fontWeight: 700, lineHeight: 1.25, color: ZB.ink }}
      {...rest}/>
  );

}
