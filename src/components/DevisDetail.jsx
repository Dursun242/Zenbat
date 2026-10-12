// Fiche devis (système « Bordereau ») : le devis se lit comme le document
// que reçoit le client. Statut en tampon, lots tracés avec leur sous-total
// dans la marge, appui sur une ligne pour la modifier, une seule action
// principale selon le statut, dans une barre collée en bas (au pouce).
import { useState, useEffect, useRef } from "react";
import { fmt, uid, downloadBlob } from "../lib/utils.js";
import { computeTotals, isNoTva, splitByRate, ventilatedLines } from "../lib/invoiceCalc.js";
import { ZB, NUM } from "../lib/theme.js";
import { I } from "./ui/icons.jsx";
import PDFViewer from "./PDFViewer.jsx";
import ClientPickerModal from "./app/ClientPickerModal.jsx";
import { useDevisSuivi, NegotiationPanel, SuiviLog } from "./DevisClientActions.jsx";
import StatusStamp from "./devis/StatusStamp.jsx";
import { sectionsOf, Line, LineEditor, LotEditor, LotHeading, Totals, BORDEREAU_CSS, ICON } from "./bordereau/parts.jsx";
import { useModalGuard } from "../hooks/useModalGuard.js";
import { useAuth } from "../lib/auth.jsx";
import { devisDraftKey } from "../lib/devisDraft.js";

const clientName = c => c ? (c.raison_sociale || `${c.prenom || ""} ${c.nom || ""}`.trim() || c.email || "Client sans nom") : null;
const fmtDate = d => d ? new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }) : "";

const btnPrimary = {
  minHeight: 52, padding: "0 20px", borderRadius: 10, border: "none", background: ZB.accent, color: "#fff",
  fontFamily: "inherit", fontSize: 16, fontWeight: 700, cursor: "pointer",
};
const btnSecondary = {
  minHeight: 48, padding: "0 16px", borderRadius: 10, border: `1px solid ${ZB.rule}`, background: ZB.sheet, color: ZB.ink,
  fontFamily: "inherit", fontSize: 15, fontWeight: 600, cursor: "pointer",
};
const btnText = {
  minHeight: 44, padding: "0 4px", background: "none", border: "none", color: ZB.accent,
  fontFamily: "inherit", fontSize: 15, fontWeight: 600, cursor: "pointer",
};

const MoreIcon = <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></svg>;
const BackIcon = <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>;

export default function DevisDetail({ d, cl, clients = [], onBack, brand, onChange, onConvertToInvoice, onCreateAcompte, onCreateSolde, invoices = [], onDuplicate, onCreateIndice, groupVersions = [], goDevis, loading, autoOpenPDF, onAutoOpenPDFConsumed, isFreemium = false, onPaywall = () => {} }) {
  const [showPDF,        setShowPDF]        = useState(false);
  const [acompteModal,   setAcompteModal]   = useState(false);
  const [acomptePct,     setAcomptePct]     = useState(30);
  // Mode de saisie de l'acompte : "pct" = curseur en %, "montant" = montant
  // HT forfaitaire libre saisi en euros (plafonné au reste à facturer).
  const [acompteMode,       setAcompteMode]       = useState("pct");
  const [acompteMontantHT,  setAcompteMontantHT]  = useState("");
  const [acompteLoading, setAcompteLoading] = useState(false);
  const [soldeLoading,   setSoldeLoading]   = useState(false);
  const [proformaBusy,   setProformaBusy]   = useState(false);
  const [clientPicker,   setClientPicker]   = useState(false);
  const [statutBusy,     setStatutBusy]     = useState(false);
  const [editingId,      setEditingId]      = useState(null);
  const [moreOpen,       setMoreOpen]       = useState(false);
  // Envoi sécurisé : un premier appui ouvre la confirmation (destinataire,
  // montant), le second envoie.
  const [confirmSend,    setConfirmSend]    = useState(false);
  // Statut posé à la main (« signé en direct », « refusé ») : confirmation.
  const [confirmStatus,  setConfirmStatus]  = useState(null);
  // Protection anti-double-clic sur les actions qui créent une ressource
  // (Dupliquer, Facturer, Nouvel indice).
  const [actionBusy,     setActionBusy]     = useState(false);
  const runAction = async (fn) => {
    if (actionBusy || !fn) return;
    setActionBusy(true);
    try { await fn(); } finally { setActionBusy(false); }
  };

  const suivi = useDevisSuivi({ devis: d || {}, client: cl, onChange });

  // Brouillon en cours d'édition persisté en localStorage : filet de
  // sécurité contre tout reload imprévu. Si à l'arrivée sur ce devis on
  // trouve un brouillon plus récent que la version DB, on propose de le
  // restaurer.
  const { user } = useAuth();
  const userId = user?.id;
  const [restoreOffer, setRestoreOffer] = useState(null);
  const restoreCheckedRef = useRef(false);
  const lastPersistRef    = useRef(0);

  useEffect(() => {
    if (restoreCheckedRef.current || !d?.id) return;
    restoreCheckedRef.current = true;
    try {
      const raw = localStorage.getItem(devisDraftKey(userId, d.id));
      if (!raw) return;
      const local = JSON.parse(raw);
      const dbAt    = new Date(d.updated_at || d.created_at || 0).getTime();
      const localAt = Number(local?.savedAt || 0);
      // Tolérance 2 s : évite de proposer la dernière sauvegarde DB elle-même.
      if (localAt > dbAt + 2000 && local?.d) {
        setRestoreOffer(local);
      } else {
        localStorage.removeItem(devisDraftKey(userId, d.id));
      }
    } catch {}
  }, [d?.id, d?.updated_at, userId]);

  // Persiste le brouillon à chaque changement (throttle 600 ms ; la
  // persistance DB a son propre debounce côté useDevis).
  useEffect(() => {
    if (!d?.id) return;
    const now = Date.now();
    if (now - lastPersistRef.current < 600) return;
    lastPersistRef.current = now;
    try {
      localStorage.setItem(devisDraftKey(userId, d.id), JSON.stringify({ d, savedAt: now }));
    } catch {}
  }, [d, userId]);

  const restoreDraft = () => {
    if (!restoreOffer?.d || !onChange) return;
    onChange(restoreOffer.d);
    try { localStorage.removeItem(devisDraftKey(userId, d.id)); } catch {}
    setRestoreOffer(null);
  };
  const dismissDraft = () => {
    try { localStorage.removeItem(devisDraftKey(userId, d.id)); } catch {}
    setRestoreOffer(null);
  };

  // onChange est fire-and-forget : si le serveur refuse, le statut ne bouge
  // pas et les boutons ne doivent pas rester bloqués.
  useEffect(() => {
    if (!statutBusy) return;
    const t = setTimeout(() => setStatutBusy(false), 4000);
    return () => clearTimeout(t);
  }, [statutBusy]);

  useEffect(() => {
    if (!confirmSend) return;
    const t = setTimeout(() => setConfirmSend(false), 15000);
    return () => clearTimeout(t);
  }, [confirmSend]);

  useModalGuard(acompteModal, () => setAcompteModal(false));

  // Ouvre automatiquement le PDF quand on arrive depuis l'Agent IA après save
  useEffect(() => {
    if (autoOpenPDF) {
      setShowPDF(true);
      onAutoOpenPDFConsumed?.();
    }
  }, [autoOpenPDF, onAutoOpenPDFConsumed]);

  if (loading) return <LoadingSkeleton/>;

  const isRemplace = d.statut === "remplace";
  // Un devis signé ne se modifie plus : il fait foi entre les deux parties.
  const isSigned   = d.statut === "accepte";
  const readOnly   = isRemplace || isSigned;
  const isOut      = ["envoye", "en_signature", "en_negociation"].includes(d.statut);
  const lignes     = d.lignes || [];
  const franchise  = brand?.vatRegime === "franchise";
  const autoLiqDevis = !!d.auto_liquidation_btp;
  const noTvaDevis   = isNoTva(brand?.vatRegime, autoLiqDevis);
  const totals     = computeTotals(lignes, { noTva: noTvaDevis, docRate: d.tva_rate });
  const ht         = totals.ht;
  const hasLotRows = lignes.some(l => l.type_ligne === "lot");
  const sections   = sectionsOf(lignes);
  const ouvrages   = lignes.filter(l => l.type_ligne === "ouvrage");

  const updateLignes = (newLignes) => {
    const newHt = computeTotals(newLignes, { noTva: noTvaDevis, docRate: d.tva_rate }).ht;
    onChange({ ...d, lignes: newLignes, montant_ht: newHt }, true);
  };
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
    const lastLot = [...lignes].reverse().find(l => l.type_ligne === "lot");
    const id = uid();
    updateLignes([...lignes, {
      id, type_ligne: "ouvrage", designation: "",
      lot: lastLot?.designation ? lastLot.designation.charAt(0) + lastLot.designation.slice(1).toLowerCase() : "",
      unite: "u", quantite: 1, prix_unitaire: 0, tva_rate: franchise ? 0 : 20,
    }]);
    setEditingId(id);
  };
  const addLot = () => {
    const id = uid();
    updateLignes([...lignes, { id, type_ligne: "lot", designation: "NOUVEAU LOT", lot: "" }]);
    setEditingId(id);
  };

  // Acompte / solde : TVA ventilée sur les taux du devis (même calcul que la
  // facture créée, cf. createAcompteFromDevis). 0 % en franchise ou autoliquidation.
  const ttcOf = (amountHT) => computeTotals(
    ventilatedLines(amountHT, lignes, { noTva: noTvaDevis, docRate: d.tva_rate }),
  ).ttc;
  const devisRates   = noTvaDevis ? [0] : splitByRate(ht, lignes, d.tva_rate).map(p => p.rate);
  const tvaLabel     = devisRates.length === 1 ? `TVA ${String(devisRates[0]).replace(".", ",")} %` : "TVA ventilée";
  const canAcompte = onCreateAcompte && ht > 0 && ["envoye","en_signature","accepte"].includes(d.statut);

  const devisAcomptes = invoices.filter(inv =>
    inv.devis_id === d.id && inv.invoice_type === "acompte" && inv.statut !== "annulee"
  );
  const devisHasSolde = invoices.some(inv =>
    inv.devis_id === d.id && inv.invoice_type === "solde" && inv.statut !== "annulee"
  );
  const totalAcompteHT = devisAcomptes.reduce((s, a) => s + (Number(a.montant_ht) || 0), 0);
  const remainingHT    = Math.max(0, Math.round((ht - totalAcompteHT) * 100) / 100);
  const remainingPct   = ht > 0 ? Math.round(remainingHT / ht * 100) : 100;
  const maxAcomptePct  = Math.max(1, remainingPct);
  const clampedPct     = Math.min(acomptePct, maxAcomptePct);
  const pctHT          = Math.round(ht * clampedPct) / 100;
  const freeHT         = Math.min(remainingHT, Math.max(0, Number(acompteMontantHT) || 0));
  const acompteHT      = acompteMode === "montant" ? freeHT : pctHT;
  const acompteEffPct  = ht > 0 ? Math.round(acompteHT / ht * 100) : 0;
  const acompteTTC     = ttcOf(acompteHT);
  const soldeTTC       = ttcOf(remainingHT);

  // Facture « pro forma » (PDF commercial sans valeur fiscale, aucun numéro légal).
  const handleProforma = async () => {
    if (proformaBusy || !lignes.length) return;
    setProformaBusy(true);
    try {
      const { renderDataToPdf } = await import("../lib/pdf.js");
      const safe = String(d.numero || "devis").replace(/[^a-zA-Z0-9._-]/g, "_");
      const name = `Pro-forma-${safe}.pdf`;
      const { blob } = await renderDataToPdf(d, cl, brand, "proforma", { filename: name });
      downloadBlob(blob, name);
    } catch (e) {
      console.error("[proforma]", e);
    } finally {
      setProformaBusy(false);
    }
  };

  const handleAcompte = async () => {
    if (!acompteHT || acompteLoading) return;
    setAcompteLoading(true);
    try {
      await onCreateAcompte(d.id, acompteHT);
      setAcompteModal(false);
    } finally {
      setAcompteLoading(false);
    }
  };

  const handleSolde = async () => {
    if (!onCreateSolde || soldeLoading || !remainingHT) return;
    setSoldeLoading(true);
    try {
      await onCreateSolde(d.id, devisAcomptes);
      setAcompteModal(false);
    } finally {
      setSoldeLoading(false);
    }
  };

  const markSigned = () => {
    setStatutBusy(true); setConfirmStatus(null);
    onChange({ ...d, statut: "accepte", signed_at: new Date().toISOString(), signed_by: clientName(cl) || "" });
  };
  const markRefused = () => { setStatutBusy(true); setConfirmStatus(null); onChange({ ...d, statut: "refuse" }); };
  // Statuts posés à la main sans email (envoyé hors Zenbat, à signer).
  const markStatus = statut => { setStatutBusy(true); setConfirmStatus(null); onChange({ ...d, statut }); };

  // ── Zone d'action : une seule action principale selon le statut ─────────
  const email = cl?.email;
  const canEditStatus = !isRemplace;
  const sentLine = suivi.sentTo
    ? <>Envoyé à <strong style={{ color: ZB.ink }}>{suivi.sentTo}</strong>. Le client a reçu un lien pour consulter et signer.</>
    : suivi.lastSent && email
      ? <>Envoyé à {email} le {fmtDate(suivi.lastSent.created_at)}.</>
      : null;

  let actionBar = null;
  if (canEditStatus && d.statut === "brouillon") {
    if (!lignes.length) {
      actionBar = <p style={hint}>Ajoute des lignes au devis pour pouvoir l'envoyer.</p>;
    } else if (!cl) {
      actionBar = <button type="button" style={{ ...btnPrimary, width: "100%" }} onClick={() => setClientPicker(true)}>Choisir le client</button>;
    } else if (!email) {
      actionBar = (
        <div style={{ display: "grid", gap: 8 }}>
          <p style={{ ...hint, color: ZB.warn }}>{clientName(cl)} n'a pas d'email : ajoute-le dans sa fiche (onglet Clients) pour envoyer le devis.</p>
          <button type="button" style={btnSecondary} onClick={() => setClientPicker(true)}>Choisir un autre client</button>
        </div>
      );
    } else if (confirmSend) {
      actionBar = (
        <div role="group" aria-label="Confirmer l'envoi" style={{ display: "grid", gap: 10 }}>
          <p style={{ margin: 0, fontSize: 15, color: ZB.ink, lineHeight: 1.45 }}>
            Envoyer le devis <strong>{d.numero}</strong> (<span style={NUM}>{fmt(totals.ttc)}</span> TTC) à <strong>{email}</strong> ? Le client recevra un lien pour le consulter et le signer.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 8 }}>
            <button type="button" style={btnSecondary} onClick={() => setConfirmSend(false)}>Annuler</button>
            <button type="button" style={{ ...btnPrimary, opacity: suivi.sending ? 0.7 : 1 }} disabled={suivi.sending}
              onClick={async () => { const ok = await suivi.send(); if (ok) setConfirmSend(false); }}>
              {suivi.sending ? "Envoi…" : "Envoyer"}
            </button>
          </div>
        </div>
      );
    } else {
      actionBar = <button type="button" className="zb-primary" style={{ ...btnPrimary, width: "100%" }} onClick={() => setConfirmSend(true)}>Envoyer au client</button>;
    }
  } else if (canEditStatus && isOut) {
    const who = clientName(cl) || email;
    actionBar = (
      <div style={{ display: "grid", gap: 10 }}>
        {sentLine && <p style={{ ...hint, fontSize: 14 }}>{sentLine}</p>}
        {confirmSend ? (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 8 }}>
            <button type="button" style={btnSecondary} onClick={() => setConfirmSend(false)}>Annuler</button>
            <button type="button" style={{ ...btnPrimary, minHeight: 48 }} disabled={suivi.sending}
              onClick={async () => { const ok = await suivi.send(); if (ok) setConfirmSend(false); }}>
              {suivi.sending ? "Envoi…" : `Renvoyer à ${email}`}
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {email && d.statut !== "en_negociation" && (
              <button type="button" className="zb-primary" style={{ ...btnPrimary, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                onClick={() => setConfirmSend(true)}>
                Relancer {who}
              </button>
            )}
            {suivi.hasLink && (
              <button type="button" style={{ ...btnText, flexShrink: 0 }} onClick={suivi.copyLink}>{suivi.copied ? "Lien copié" : "Copier le lien"}</button>
            )}
          </div>
        )}
      </div>
    );
  } else if (canEditStatus && d.statut === "accepte") {
    actionBar = (
      <div style={{ display: "grid", gap: 8 }}>
        {onConvertToInvoice && lignes.length > 0 && (
          isFreemium ? (
            <button type="button" style={{ ...btnPrimary, width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }} onClick={onPaywall}>
              Facturer <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: ".06em", padding: "2px 6px", borderRadius: 4, border: "1px solid rgba(255,255,255,.7)" }}>PRO</span>
            </button>
          ) : (
            <button type="button" className="zb-primary" style={{ ...btnPrimary, width: "100%", opacity: actionBusy ? 0.7 : 1 }} disabled={actionBusy}
              onClick={() => runAction(() => onConvertToInvoice())}>
              {actionBusy ? "Création de la facture…" : "Facturer"}
            </button>
          )
        )}
      </div>
    );
  } else if (canEditStatus && d.statut === "refuse" && onCreateIndice) {
    actionBar = (
      <button type="button" style={{ ...btnSecondary, width: "100%" }} disabled={actionBusy} onClick={() => runAction(() => onCreateIndice())}>
        Proposer un nouvel indice
      </button>
    );
  }

  if (confirmStatus === "envoye" || confirmStatus === "en_signature") {
    const sent = confirmStatus === "envoye";
    actionBar = (
      <div role="group" aria-label="Confirmer le statut" style={{ display: "grid", gap: 10 }}>
        <p style={{ margin: 0, fontSize: 15, color: ZB.ink, lineHeight: 1.45 }}>
          {sent
            ? <>Marquer le devis <strong>{d.numero}</strong> (<span style={NUM}>{fmt(totals.ttc)}</span> TTC) comme envoyé{cl ? <> à <strong>{clientName(cl)}</strong></> : null} ? Aucun email ne part de Zenbat.</>
            : <>Passer le devis <strong>{d.numero}</strong> (<span style={NUM}>{fmt(totals.ttc)}</span> TTC) en « À signer »{cl ? <> pour <strong>{clientName(cl)}</strong></> : null} ? Aucun email ne part de Zenbat.</>}
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 8 }}>
          <button type="button" style={btnSecondary} onClick={() => setConfirmStatus(null)}>Annuler</button>
          <button type="button" disabled={statutBusy} onClick={() => markStatus(confirmStatus)} style={btnPrimary}>
            {sent ? "Oui, marquer envoyé" : "Oui, à signer"}
          </button>
        </div>
      </div>
    );
  } else if (confirmStatus) {
    const signed = confirmStatus === "accepte";
    actionBar = (
      <div role="group" aria-label="Confirmer le statut" style={{ display: "grid", gap: 10 }}>
        <p style={{ margin: 0, fontSize: 15, color: ZB.ink, lineHeight: 1.45 }}>
          {signed
            ? <>Marquer le devis comme signé par <strong>{clientName(cl) || "le client"}</strong> (<span style={NUM}>{fmt(totals.ttc)}</span> TTC) ? Il ne pourra plus être modifié.</>
            : <>Marquer le devis comme refusé par <strong>{clientName(cl) || "le client"}</strong> ?</>}
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 8 }}>
          <button type="button" style={btnSecondary} onClick={() => setConfirmStatus(null)}>Annuler</button>
          <button type="button" disabled={statutBusy} onClick={signed ? markSigned : markRefused}
            style={{ ...btnPrimary, background: signed ? ZB.stamp : ZB.danger }}>
            {signed ? "Oui, il est signé" : "Oui, il est refusé"}
          </button>
        </div>
      </div>
    );
  }

  // ── Menu « Plus » ──────────────────────────────────────────────────────
  const moreItems = [
    onDuplicate && { key: "dup", label: "Dupliquer le devis", onClick: () => runAction(() => onDuplicate()) },
    onCreateIndice && d.statut !== "accepte" && !isRemplace && d.statut !== "refuse" && { key: "ind", label: "Créer un nouvel indice", onClick: () => runAction(() => onCreateIndice()) },
    lignes.length > 0 && { key: "pro", label: proformaBusy ? "Pro forma en cours…" : "Télécharger une pro forma", onClick: handleProforma },
    d.statut === "brouillon" && !isRemplace && { key: "sent", label: "Marquer comme envoyé (envoyé hors Zenbat)", onClick: () => setConfirmStatus("envoye") },
    d.statut === "brouillon" && !isRemplace && { key: "sig", label: "Marquer comme à signer", onClick: () => setConfirmStatus("en_signature") },
    canAcompte && { key: "aco", label: "Créer une facture d'acompte", onClick: () => setAcompteModal(true) },
    ["envoye", "en_signature"].includes(d.statut) && !isRemplace && { key: "ok", label: "Marquer comme signé (signé en direct)", onClick: () => setConfirmStatus("accepte") },
    ["envoye", "en_signature"].includes(d.statut) && !isRemplace && { key: "ko", label: "Marquer comme refusé", onClick: () => setConfirmStatus("refuse"), danger: true },
  ].filter(Boolean);

  const createdAt = d.date_emission || d.created_at;

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
        <PDFViewer d={d} cl={cl} brand={brand} onClose={() => setShowPDF(false)}
          onMarkSent={d.statut === "brouillon" ? () => onChange({ ...d, statut: "envoye" }) : undefined}
          onMarkSignature={["brouillon","envoye"].includes(d.statut) ? () => onChange({ ...d, statut: "en_signature" }) : undefined}
        />
      )}

      {acompteModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(26,22,18,.5)", zIndex: 200, display: "flex", alignItems: "flex-end", justifyContent: "center", fontFamily: ZB.font }}>
          <div role="dialog" aria-modal="true" aria-labelledby="acompte-title"
            style={{ background: ZB.sheet, borderRadius: "12px 12px 0 0", padding: "20px 18px calc(20px + env(safe-area-inset-bottom))", width: "100%", maxWidth: 480, maxHeight: "90vh", overflowY: "auto", color: ZB.ink }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 4 }}>
              <h2 id="acompte-title" style={{ margin: 0, fontSize: 19, fontWeight: 700 }}>Facturer par acomptes</h2>
              <button type="button" aria-label="Fermer" onClick={() => setAcompteModal(false)}
                style={{ width: 44, height: 44, marginTop: -10, marginRight: -10, display: "grid", placeItems: "center", background: "none", border: "none", color: ZB.ink2, cursor: "pointer" }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>
              </button>
            </div>
            <div style={{ fontSize: 14, color: ZB.ink2, marginBottom: 16, ...NUM }}>Devis {d.numero} · Total {fmt(ht)} HT</div>

            {devisAcomptes.length > 0 && (
              <div style={{ marginBottom: 16, borderTop: `1px solid ${ZB.rule}` }}>
                {devisAcomptes.map(a => (
                  <div key={a.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, padding: "8px 0", borderBottom: `1px solid ${ZB.ruleSoft}`, fontSize: 14, ...NUM }}>
                    <span><strong>{a.numero || "Brouillon"}</strong> <span style={{ color: ZB.ink2 }}>· {Math.round((Number(a.montant_ht) || 0) / ht * 100)} % · {a.statut === "envoyee" ? "émise" : a.statut === "payee" ? "payée" : "brouillon"}</span></span>
                    <span style={{ fontWeight: 700 }}>{fmt(Number(a.montant_ht) || 0)} HT</span>
                  </div>
                ))}
                <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", fontSize: 15, ...NUM }}>
                  <span>Reste à facturer</span>
                  <strong>{fmt(remainingHT)} HT ({remainingPct} %)</strong>
                </div>
              </div>
            )}

            {devisHasSolde && (
              <p style={{ margin: "0 0 16px", fontSize: 15, color: ZB.stamp }}>La facture de solde de ce devis est déjà créée.</p>
            )}

            {remainingHT > 0 && !devisHasSolde && (
              <>
                <div style={{ fontSize: 14, fontWeight: 600, color: ZB.ink2, marginBottom: 8 }}>
                  {devisAcomptes.length > 0 ? "Nouvel acompte" : "Montant de l'acompte"}
                </div>
                <div role="radiogroup" aria-label="Mode de saisie" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 12 }}>
                  {[{ k: "pct", label: "En %" }, { k: "montant", label: "Montant libre" }].map(opt => {
                    const on = acompteMode === opt.k;
                    return (
                      <button key={opt.k} type="button" role="radio" aria-checked={on} onClick={() => setAcompteMode(opt.k)}
                        style={{ minHeight: 44, borderRadius: 8, border: `1px solid ${on ? ZB.accent : ZB.rule}`, background: on ? ZB.accentSoft : ZB.sheet,
                          color: on ? ZB.accent : ZB.ink, fontFamily: "inherit", fontSize: 15, fontWeight: on ? 700 : 500, cursor: "pointer" }}>
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
                {acompteMode === "pct" ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                    <input type="range" min={1} max={maxAcomptePct} value={clampedPct} aria-label="Pourcentage de l'acompte"
                      onChange={e => setAcomptePct(Number(e.target.value))}
                      style={{ flex: 1, accentColor: ZB.accent, minHeight: 44 }}/>
                    <label style={{ display: "flex", alignItems: "center", gap: 4, border: `1px solid ${ZB.field}`, borderRadius: 8, padding: "0 10px", minHeight: 44 }}>
                      <span className="zb-sr">Pourcentage</span>
                      <input type="number" inputMode="decimal" min={1} max={maxAcomptePct} value={clampedPct}
                        onChange={e => setAcomptePct(Math.min(maxAcomptePct, Math.max(1, Number(e.target.value))))}
                        style={{ width: 52, border: "none", outline: "none", fontSize: 16, fontWeight: 700, textAlign: "right", fontFamily: "inherit", color: ZB.ink, ...NUM }}/>
                      <span style={{ color: ZB.ink2, fontSize: 15 }}>%</span>
                    </label>
                  </div>
                ) : (
                  <div style={{ marginBottom: 12 }}>
                    <label style={{ display: "flex", alignItems: "center", gap: 8, border: `1px solid ${ZB.field}`, borderRadius: 8, padding: "0 12px", minHeight: 48 }}>
                      <span className="zb-sr">Montant HT de l'acompte</span>
                      <input type="number" inputMode="decimal" min={0} max={remainingHT} step="0.01"
                        value={acompteMontantHT} placeholder="0"
                        onChange={e => setAcompteMontantHT(e.target.value)}
                        style={{ flex: 1, minWidth: 0, border: "none", outline: "none", fontSize: 17, fontWeight: 700, fontFamily: "inherit", color: ZB.ink, ...NUM }}/>
                      <span style={{ color: ZB.ink2, fontSize: 15, fontWeight: 600 }}>€ HT</span>
                    </label>
                    <div style={{ fontSize: 13, color: Number(acompteMontantHT) > remainingHT ? ZB.warn : ZB.ink2, marginTop: 6, ...NUM }}>
                      {Number(acompteMontantHT) > remainingHT
                        ? `Limité à ${fmt(remainingHT)} HT (reste à facturer).`
                        : acompteHT > 0
                          ? `Soit ${acompteEffPct} % du devis · maximum ${fmt(remainingHT)} HT`
                          : `Maximum ${fmt(remainingHT)} HT`}
                    </div>
                  </div>
                )}

                <div style={{ borderTop: `2px solid ${ZB.ink}`, borderBottom: `3px double ${ZB.ink}`, padding: "10px 0", marginBottom: 16, ...NUM }}>
                  {noTvaDevis ? (
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 15 }}>
                      <span>{autoLiqDevis ? "Montant (autoliquidation, sans TVA)" : "Montant (TVA non applicable)"}</span>
                      <strong style={{ fontSize: 18 }}>{fmt(acompteHT)}</strong>
                    </div>
                  ) : (
                    <>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 15, marginBottom: 4 }}>
                        <span>Montant HT</span><span style={{ fontWeight: 600 }}>{fmt(acompteHT)}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", fontSize: 15 }}>
                        <span>Montant TTC ({tvaLabel})</span><strong style={{ fontSize: 18 }}>{fmt(acompteTTC)}</strong>
                      </div>
                    </>
                  )}
                </div>

                <button type="button" onClick={handleAcompte} disabled={acompteLoading || !acompteHT}
                  style={{ ...btnPrimary, width: "100%", opacity: acompteLoading || !acompteHT ? 0.5 : 1, cursor: acompteLoading || !acompteHT ? "not-allowed" : "pointer", marginBottom: 8 }}>
                  {acompteLoading ? "Création…" : <>Créer l'acompte de <span style={NUM}>{fmt(acompteTTC)}</span> TTC</>}
                </button>

                {devisAcomptes.length > 0 && onCreateSolde && (
                  <button type="button" onClick={handleSolde} disabled={soldeLoading}
                    style={{ ...btnSecondary, width: "100%", opacity: soldeLoading ? 0.6 : 1 }}>
                    {soldeLoading ? "Création…" : <>Créer la facture de solde (<span style={NUM}>{fmt(soldeTTC)}</span> TTC · {remainingPct} %)</>}
                  </button>
                )}
              </>
            )}
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

      <div className="detail-shell" style={{ minHeight: "100%", background: ZB.paper, display: "flex", flexDirection: "column", fontFamily: ZB.font, color: ZB.ink }}>
        <div className="detail-row" style={{ flex: 1, display: "flex" }}>
          <div className="detail-editor" style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>

            {/* Retour + actions secondaires */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px 6px 6px", borderBottom: `1px solid ${ZB.rule}`, background: ZB.paper }}>
              <button type="button" onClick={onBack}
                style={{ display: "flex", alignItems: "center", gap: 4, minHeight: 44, padding: "0 8px", background: "none", border: "none", color: ZB.ink, fontFamily: "inherit", fontSize: 15, fontWeight: 600, cursor: "pointer" }}>
                {BackIcon} Devis
              </button>
              <div style={{ flex: 1 }}/>
              <button type="button" className="detail-mobile-only" onClick={() => setShowPDF(true)}
                style={{ ...btnText, display: "flex", alignItems: "center", gap: 6, padding: "0 8px" }}>
                {I.pdf} PDF
              </button>
              <div style={{ position: "relative" }}>
                <button type="button" aria-label="Plus d'actions" aria-haspopup="menu" aria-expanded={moreOpen} onClick={() => setMoreOpen(o => !o)}
                  style={{ width: 44, height: 44, display: "grid", placeItems: "center", borderRadius: 8, border: `1px solid ${ZB.rule}`, background: ZB.sheet, color: ZB.ink, cursor: "pointer" }}>
                  {MoreIcon}
                </button>
                {moreOpen && (
                  <>
                    <div onClick={() => setMoreOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 90 }}/>
                    <div role="menu" style={{ position: "absolute", right: 0, top: "calc(100% + 6px)", zIndex: 91, width: 280, maxWidth: "calc(100vw - 24px)", padding: 4,
                      background: ZB.sheet, border: `1px solid ${ZB.rule}`, borderRadius: 10, boxShadow: "0 10px 30px rgba(26,22,18,.16)" }}>
                      {moreItems.map(it => (
                        <button key={it.key} type="button" role="menuitem" disabled={actionBusy && ["dup", "ind"].includes(it.key)}
                          onClick={() => { setMoreOpen(false); it.onClick(); }}
                          style={{ display: "block", width: "100%", minHeight: 44, padding: "10px 12px", textAlign: "left", background: "none", border: "none", borderRadius: 8, fontFamily: "inherit", fontSize: 15, color: it.danger ? ZB.danger : ZB.ink, cursor: "pointer" }}>
                          {it.label}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>

            <div style={{ flex: 1, padding: "14px 12px 0" }}>
              {restoreOffer && (
                <div role="status" style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", padding: "10px 12px", marginBottom: 12, background: ZB.warnSoft, borderRadius: 8 }}>
                  <span style={{ flex: 1, minWidth: 180, fontSize: 15, color: ZB.ink, lineHeight: 1.4 }}>Des modifications de ce devis n'ont pas été enregistrées.</span>
                  <button type="button" onClick={dismissDraft} style={{ ...btnText, color: ZB.ink2 }}>Ignorer</button>
                  <button type="button" onClick={restoreDraft} style={{ ...btnSecondary, minHeight: 44 }}>Les récupérer</button>
                </div>
              )}

              {isRemplace && (
                <p style={{ margin: "0 0 12px", padding: "10px 12px", background: ZB.paper2, borderRadius: 8, fontSize: 15, color: ZB.ink2, lineHeight: 1.4 }}>
                  Version remplacée : consultation seulement. Pour la modifier, crée un nouvel indice depuis la dernière version.
                </p>
              )}

              {isSigned && (
                <p style={{ margin: "0 0 12px", padding: "10px 12px", background: ZB.stampSoft, borderRadius: 8, fontSize: 15, color: ZB.ink, lineHeight: 1.4 }}>
                  Devis signé : il ne se modifie plus. Pour changer quelque chose, duplique-le depuis le menu.
                </p>
              )}
              {isOut && editingId && (
                <p role="status" style={{ margin: "0 0 12px", padding: "10px 12px", background: ZB.warnSoft, borderRadius: 8, fontSize: 15, color: ZB.ink, lineHeight: 1.4 }}>
                  Le client a déjà reçu ce devis : ce que tu modifies apparaît sur son lien. Pour une nouvelle proposition, crée plutôt un nouvel indice.
                </p>
              )}

              {d.statut === "en_negociation" && <NegotiationPanel devis={d} suivi={suivi} onCreateIndice={onCreateIndice}/>}

              {/* Le devis */}
              <article className="zb-bordereau" aria-label={`Devis ${d.numero || ""}`}
                style={{ background: ZB.sheet, border: `1px solid ${ZB.rule}`, borderRadius: 8, padding: "18px 18px 20px" }}>
                <header style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 16, fontWeight: 700, ...NUM }}>{d.numero || "Devis"}{d.indice ? ` · indice ${d.indice}` : ""}</div>
                    {createdAt && <div style={{ fontSize: 13, color: ZB.ink2, marginTop: 4 }}>{fmtDate(createdAt)}</div>}
                  </div>
                  <StatusStamp statut={d.statut}/>
                </header>

                {groupVersions.length > 1 && (
                  <nav aria-label="Versions du devis" style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap", marginTop: 12, fontSize: 14 }}>
                    <span style={{ color: ZB.ink2, marginRight: 4 }}>Versions :</span>
                    {groupVersions.map(v => {
                      const cur = v.id === d.id;
                      return (
                        <button key={v.id} type="button" aria-current={cur ? "page" : undefined} onClick={() => !cur && goDevis(v.id)}
                          style={{ minHeight: 36, minWidth: 36, padding: "0 8px", background: "none", border: "none", fontFamily: "inherit", fontSize: 14,
                            fontWeight: cur ? 700 : 500, color: cur ? ZB.ink : ZB.accent, cursor: cur ? "default" : "pointer",
                            textDecoration: cur ? "underline" : "none", textDecorationColor: ZB.accent, textDecorationThickness: 2, textUnderlineOffset: 5 }}>
                          {v.indice || "Initiale"}
                        </button>
                      );
                    })}
                  </nav>
                )}

                {/* Client */}
                <button type="button" onClick={() => !readOnly && setClientPicker(true)} disabled={readOnly}
                  style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", minHeight: 56, marginTop: 14, padding: "8px 0",
                    background: "none", border: "none", borderTop: `1px solid ${ZB.ruleSoft}`, borderBottom: `1px solid ${ZB.ruleSoft}`,
                    textAlign: "left", fontFamily: "inherit", cursor: readOnly ? "default" : "pointer" }}>
                  <span style={{ fontSize: 13, color: ZB.ink2, width: 44, flexShrink: 0 }}>Client</span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: "block", fontSize: 15, fontWeight: 600, color: cl ? ZB.ink : ZB.ink3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {clientName(cl) || "Aucun client"}
                    </span>
                    {cl && <span style={{ display: "block", fontSize: 13, color: email ? ZB.ink2 : ZB.warn, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{email || "Pas d'email"}</span>}
                  </span>
                  {!readOnly && <span style={{ fontSize: 15, fontWeight: 600, color: ZB.accent, flexShrink: 0 }}>{cl ? "Changer" : "Choisir"}</span>}
                </button>

                <label htmlFor="dv-objet" className="zb-sr">Objet du devis</label>
                <AutoTextarea id="dv-objet" value={d.objet || ""} readOnly={readOnly} placeholder="Objet du devis"
                  onChange={v => onChange({ ...d, objet: v })} className="zb-focus-ring"
                  style={{ display: "block", width: "100%", margin: "14px 0 0", padding: "4px 0", border: "none", resize: "none", overflow: "hidden",
                    background: "none", fontFamily: "inherit", fontSize: 21, fontWeight: 700, lineHeight: 1.25, color: ZB.ink }}/>
                {(!readOnly || d.ville_chantier) && <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
                  <label htmlFor="dv-lieu" style={{ fontSize: 13, color: ZB.ink2, flexShrink: 0 }}>Lieu du chantier</label>
                  <input id="dv-lieu" value={d.ville_chantier || ""} readOnly={readOnly} placeholder="À préciser"
                    onChange={e => !readOnly && onChange({ ...d, ville_chantier: e.target.value })}
                    style={{ flex: 1, minWidth: 0, minHeight: 36, padding: "4px 0", border: "none", borderBottom: `1px dotted ${ZB.field}`, background: "none", fontFamily: "inherit", fontSize: 16, color: ZB.ink, outline: "none" }}/>
                </div>}

                {/* Colonnes */}
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 18, paddingBottom: 8, borderBottom: `2px solid ${ZB.ink}`, fontSize: 13, fontWeight: 600, color: ZB.ink2 }}>
                  <span>Désignation <span style={{ fontWeight: 500 }}>· {ouvrages.length} ligne{ouvrages.length > 1 ? "s" : ""}</span></span><span>Montant HT</span>
                </div>

                {lignes.length === 0 && (
                  <p style={{ margin: "14px 0", fontSize: 15, color: ZB.ink2 }}>Aucune ligne pour l'instant.</p>
                )}

                {sections.map((s, si) => (
                  <section key={s.lot?.id || `s${si}`} aria-label={s.lot?.designation || "Prestations"}>
                    {s.lot && (editingId === s.lot.id && !s.lot.virtual ? (
                      <LotEditor lot={s.lot}
                        onChange={patch => changeLine(s.lot.id, patch)}
                        onDelete={() => deleteLine(s.lot.id)}
                        onDone={() => setEditingId(null)}
                        onMove={dir => moveLine(s.lot.id, dir)}
                        canUp={s.at > 0} canDown={s.at < lignes.length - 1}/>
                    ) : (
                      <LotHeading lot={s.lot} subtotal={s.subtotal}
                        onOpen={readOnly || s.lot.virtual ? undefined : () => setEditingId(s.lot.id)}/>
                    ))}
                    {s.rows.map(({ l, idx }) => editingId === l.id ? (
                      <LineEditor key={l.id} l={l} franchise={franchise} withLot={!hasLotRows} withPercent
                        onChange={patch => changeLine(l.id, patch)}
                        onDelete={() => deleteLine(l.id)}
                        onDone={() => setEditingId(null)}
                        onMove={dir => moveLine(l.id, dir)}
                        canUp={idx > 0} canDown={idx < lignes.length - 1}/>
                    ) : (
                      <Line key={l.id} l={l} idx={idx} franchise={franchise} onOpen={readOnly ? undefined : () => setEditingId(l.id)}/>
                    ))}
                  </section>
                ))}

                {!readOnly && (
                  <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                    <button type="button" onClick={addLine} style={{ ...btnText, display: "flex", alignItems: "center", gap: 8, minHeight: 48 }}>{ICON.plus} Ajouter une ligne</button>
                    <button type="button" onClick={addLot} style={{ ...btnText, display: "flex", alignItems: "center", gap: 8, minHeight: 48, color: ZB.ink2 }}>{ICON.plus} Ajouter un lot</button>
                  </div>
                )}

                {lignes.length > 0 && (
                  <Totals ht={ht} tvaRows={totals.tvaRows} ttc={totals.ttc} franchise={franchise} autoLiquidation={autoLiqDevis && !franchise}/>
                )}
              </article>

              <SuiviLog suivi={suivi}/>
              {suivi.sendErr && <p role="alert" style={{ margin: "12px 0 0", fontSize: 15, color: ZB.danger }}>{suivi.sendErr}</p>}
              <div style={{ height: 16 }}/>
            </div>

            {/* Zone d'action collée en bas, au pouce */}
            {/* Masquée pendant l'édition d'une ligne : la place va au clavier. */}
            {actionBar && !editingId && (
              <div className="detail-actions" style={{ position: "sticky", bottom: 0, zIndex: 2, padding: "12px 12px 14px", background: ZB.paper, borderTop: `1px solid ${ZB.rule}` }}>
                <div style={{ maxWidth: 760, margin: "0 auto" }}>{actionBar}</div>
              </div>
            )}
          </div>

          {/* Aperçu PDF en direct : ordinateur uniquement */}
          <div className="detail-preview" style={{ display: "none", background: ZB.paper2 }}>
            <PDFViewer d={d} cl={cl} brand={brand} inline/>
          </div>
        </div>
      </div>
    </>
  );
}

const hint = { margin: 0, fontSize: 15, color: ZB.ink2, lineHeight: 1.45 };

// Champ texte qui s'agrandit avec son contenu (objet sur plusieurs lignes).
function AutoTextarea({ value, onChange, readOnly, style, ...rest }) {
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
      style={style} {...rest}/>
  );
}

function LoadingSkeleton() {
  return (
    <div role="status" aria-label="Chargement du devis" style={{ padding: "14px 12px" }}>
      <div style={{ background: ZB.sheet, border: `1px solid ${ZB.rule}`, borderRadius: 8, padding: 18 }}>
        <div style={{ height: 14, width: 120, background: ZB.ruleSoft, borderRadius: 3 }}/>
        <div style={{ height: 22, width: "70%", background: ZB.ruleSoft, borderRadius: 3, marginTop: 24 }}/>
        <div style={{ borderBottom: `2px solid ${ZB.ink}`, marginTop: 24 }}/>
        {[0, 1, 2].map(i => <div key={i} style={{ height: 48, borderBottom: `1px ${i ? "dotted" : "solid"} ${ZB.rule}` }}/>)}
      </div>
    </div>
  );
}
