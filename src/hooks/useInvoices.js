import { useState, useEffect, useRef } from "react";
import { calcInvoiceTotals } from "../lib/invoiceCalc.js";
import { logError } from "../lib/logger.js";
import { isLockAbort } from "../lib/authLock.js";
import {
  listInvoices,
  createInvoice as apiCreateInvoice,
  updateInvoice as apiUpdateInvoice,
  replaceInvoiceLignes,
  deleteInvoice as apiDeleteInvoice,
  createAvoirFromInvoice as apiCreateAvoir,
  createAcompteFromDevis as apiCreateAcompte,
  createSoldeFromDevis   as apiCreateSolde,
} from "../lib/api";

export function useInvoices(user, devis, brand, { markSaving, markSaved, setSaveState, showErr, setTab, clients = [] }) {
  const [invoices, setInvoices] = useState([]);
  const [selI,     setSelI]     = useState(null);
  // État du chargement de la liste (cf. useDevis) : la liste n'affiche
  // « Aucune facture » qu'une fois le chargement réussi.
  const [loaded,    setLoaded]    = useState(!user);
  const [loadError, setLoadError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  // Génère le PDF (brouillon) d'une facture juste créée et le pousse en pièce
  // jointe dans Telegram : buildPdf appelle notifyAdminPdf('pdf_generated') en
  // interne. Best-effort et non bloquant — un échec de rendu ne doit jamais
  // empêcher la création de la facture. Import dynamique de pdfBuilder pour ne
  // pas alourdir le bundle initial.
  const notifyCreationPdf = async (inv) => {
    try {
      if (!inv?.lignes?.length) return;
      const cl = clients.find(c => c.id === inv.client_id) || null;
      const { renderDataToPdf } = await import("../lib/pdf.js");
      await renderDataToPdf({ ...inv, tva_rate: 20 }, cl, brand, "facture", { filename: `${inv.numero || "facture"}.pdf` });
    } catch (e) {
      console.warn("[invoice/creation-pdf]", e);
    }
  };

  // Ref synchronisée avec invoices : permet aux callbacks asynchrones (ex.
  // handleFacturX qui await pendant 5s puis appelle onSaveInvoice) de lire
  // l'état COURANT, pas la closure stale du moment où la fonction a été
  // créée. Sans ce ref, deux clics rapides sur Factur-X peuvent envoyer
  // deux PATCH consécutifs : le premier verrouille la facture côté DB, le
  // second tombe en RLS 42501 parce que la closure ne voit pas le verrou.
  const invoicesRef = useRef(invoices);
  invoicesRef.current = invoices;
  // Dernier enregistrement en cours par facture : l'émission l'attend pour
  // que le serveur relise en base les lignes affichées à l'écran.
  const pendingSaves = useRef(new Map());

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    listInvoices()
      .then(inv => {
        if (cancelled) return;
        setInvoices(inv || []);
        setLoaded(true); setLoadError(null);
      })
      .catch(err => {
        if (cancelled) return;
        setLoadError(err || new Error("load invoices failed"));
        console.warn("[Zenbat] factures indisponibles :", err.message);
        // Avant : échec 100 % silencieux → l'utilisateur voyait une liste
        // vide et croyait n'avoir aucune facture. On le prévient (listInvoices
        // a déjà retenté 3× via withRetry — si on arrive ici c'est durable).
        showErr("Factures momentanément indisponibles — vérifie ta connexion");
      });
    return () => { cancelled = true; };
  }, [user?.id, reloadKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Relance le chargement de la liste (bouton « Réessayer »).
  const reload = () => { setLoadError(null); setReloadKey(k => k + 1); };

  const goInvoice = (id) => { setSelI(id); setTab("factures_detail"); };

  const onSaveInvoice = (inv, saveLignes = false, skipPersist = false) => {
    // skipPersist : la DB a déjà été mise à jour côté serveur (ex. transition
    // brouillon → émise faite dans /api/facturx via service_role). On ne ré-UPDATE
    // pas côté client — la RLS USING (not locked) rejetterait justement parce
    // que la facture vient d'être verrouillée. On synchronise juste le state local.
    if (skipPersist) {
      setInvoices(prev => prev.map(x => x.id === inv.id ? inv : x));
      return;
    }
    // Garde-fou : une facture verrouillée (CGI art. 289) ne peut pas être
    // modifiée côté DB. La RLS la rejette → toast d'erreur inutile pour
    // l'utilisateur. On lit invoicesRef pour avoir l'état COURANT (pas la
    // closure stale) — cas critique : double-clic Factur-X où le 1er save
    // verrouille la facture pendant que le 2e attend déjà.
    const previous = invoicesRef.current.find(x => x.id === inv.id);
    if (previous?.locked) {
      setInvoices(prev => prev.map(x => x.id === inv.id ? { ...inv, locked: true, statut: previous.statut } : x));
      return;
    }
    setInvoices(prev => prev.map(x => x.id === inv.id ? inv : x));
    if (!user) return;
    // Champs hors-DB stripés avant l'UPDATE :
    // - lignes : sauvées séparément via replaceInvoiceLignes
    // - created_at / updated_at : managés par Postgres
    // - devis_numero : injecté côté App.jsx pour l'affichage PDF (Acompte sur
    //   devis DEV-...) — n'existe pas dans la table invoices, PostgREST 400.
    const { lignes: il, created_at, updated_at, devis_numero, ...fields } = inv;
    markSaving();
    const persist = () => Promise.all([
      apiUpdateInvoice(inv.id, fields),
      saveLignes
        ? replaceInvoiceLignes(inv.id, (il || []).map(({ id, created_at, ...l }) => l))
        : Promise.resolve(),
    ]);
    // Retry une fois sur "verrou volé" du Web Locks Supabase (transitoire) :
    // l'UPDATE est avorté quand une requête concurrente vole le verrou de
    // refresh token. Un second essai aboutit presque toujours.
    const saving = persist()
      .catch(e => {
        if (!isLockAbort(e)) throw e;
        return new Promise(r => setTimeout(r, 800)).then(persist);
      });
    pendingSaves.current.set(inv.id, saving);
    saving
      .finally(() => { if (pendingSaves.current.get(inv.id) === saving) pendingSaves.current.delete(inv.id); })
      .then(
        () => markSaved(),
        (e) => {
          setSaveState("idle");
          // Verrou volé même après retry → bénin/transitoire : on n'alarme pas
          // l'utilisateur et on ne pollue pas le panel admin.
          if (isLockAbort(e)) { console.warn("[save invoice] lock volé, ignoré", e); return; }
          console.error("[save invoice]", e); showErr("Impossible de sauvegarder la facture");
          logError("save invoice failed", e?.stack, { area: "invoice-save", invoice_id: inv.id, code: e?.code, msg: e?.message });
        },
      );
  };

  const onCreateInvoiceFromDevis = async (devisId) => {
    const d = devis.find(x => x.id === devisId);
    if (!d) { showErr("Devis introuvable"); return; }
    try {
      const autoLiq = !!d.auto_liquidation_btp;
      const { ht, tva, ttc } = calcInvoiceTotals(d.lignes, brand.vatRegime, autoLiq, d.tva_rate);
      const saved = await apiCreateInvoice(
        {
          // Pas de numéro : il est attribué à l'émission (migration 0060).
          devis_id: d.id, client_id: d.client_id, objet: d.objet,
          operation_type: "service", statut: "brouillon",
          montant_ht: ht, montant_tva: tva, montant_ttc: ttc,
          ...(autoLiq ? { auto_liquidation_btp: true } : {}),
          ville_chantier: d.ville_chantier,
          date_emission: new Date().toISOString().split("T")[0],
          date_echeance: new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0],
        },
        (d.lignes || []).map(({ id, created_at, ...l }) => l),
      );
      setInvoices(prev => [{ ...saved, lignes: d.lignes || [] }, ...prev]);
      goInvoice(saved.id);
      notifyCreationPdf({ ...saved, lignes: d.lignes || [] });
    } catch (err) {
      console.error("[create invoice from devis]", err);
      logError("create invoice from devis failed", err?.stack, { area: "invoice-create-from-devis", devis_id: devisId, code: err?.code, msg: err?.message });
      showErr("Impossible de créer la facture. Réessaie dans un instant.");
    }
  };

  const onCreateEmptyInvoice = async () => {
    try {
      const saved = await apiCreateInvoice(
        {
          objet: "Nouvelle facture", operation_type: "service", statut: "brouillon",
          montant_ht: 0, montant_tva: 0, montant_ttc: 0,
          date_emission: new Date().toISOString().split("T")[0],
          date_echeance: new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0],
        },
        [],
      );
      setInvoices(prev => [{ ...saved, lignes: [] }, ...prev]);
      goInvoice(saved.id);
    } catch (err) {
      console.error("[create empty invoice]", err);
      showErr("Impossible de créer la facture. Réessaie dans un instant.");
    }
  };

  const onCreateAcompte = async (devisId, montantHT) => {
    if (!user) { showErr("Tu dois être connecté."); return; }
    try {
      const found = devis.find(d => d.id === devisId);
      if (!found) throw new Error("Devis introuvable");
      const saved = await apiCreateAcompte(found, montantHT, brand?.vatRegime);
      const fresh = await listInvoices();
      setInvoices(fresh);
      goInvoice(saved.id);
      notifyCreationPdf(fresh.find(x => x.id === saved.id));
    } catch (e) {
      console.error("[create acompte]", e);
      showErr(e?.message || "Impossible de créer l'acompte");
    }
  };

  const onCreateSolde = async (devisId, acompteInvoices) => {
    if (!user) { showErr("Tu dois être connecté."); return; }
    try {
      const found = devis.find(d => d.id === devisId);
      if (!found) throw new Error("Devis introuvable");
      const saved = await apiCreateSolde(found, acompteInvoices, brand?.vatRegime);
      const fresh = await listInvoices();
      setInvoices(fresh);
      goInvoice(saved.id);
      notifyCreationPdf(fresh.find(x => x.id === saved.id));
    } catch (e) {
      console.error("[create solde]", e);
      showErr(e?.message || "Impossible de créer la facture de solde");
    }
  };

  const onCreateAvoir = async (invoiceId) => {
    if (!user) { showErr("Tu dois être connecté."); return; }
    try {
      const newId = await apiCreateAvoir(invoiceId);
      const fresh = await listInvoices();
      setInvoices(fresh);
      goInvoice(newId);
      notifyCreationPdf(fresh.find(x => x.id === newId));
    } catch (e) {
      console.error("[create avoir]", e);
      showErr(e?.message || "Impossible de créer l'avoir");
    }
  };

  const onDeleteInvoice = async (id) => {
    if (!user) { setInvoices(prev => prev.filter(x => x.id !== id)); setTab("factures"); return; }
    try {
      await apiDeleteInvoice(id);
      setInvoices(prev => prev.filter(x => x.id !== id));
      setTab("factures");
    } catch (e) {
      console.error("[delete invoice]", e);
      logError("delete invoice failed", e?.stack, { area: "invoice-delete", invoice_id: id, code: e?.code, msg: e?.message });
      showErr(e?.message || "Impossible de supprimer la facture");
    }
  };

  // Attend la fin de l'enregistrement en cours d'une facture. Rejette si
  // cet enregistrement a échoué : on n'émet pas une facture dont l'écran et
  // la base divergent.
  const flushInvoiceSave = (id) => pendingSaves.current.get(id) || Promise.resolve();

  return {
    invoices, setInvoices, selI, flushInvoiceSave,
    loaded, loadError, reload,
    onSaveInvoice, onCreateInvoiceFromDevis, onCreateEmptyInvoice,
    onCreateAcompte, onCreateSolde, onCreateAvoir, onDeleteInvoice, goInvoice,
  };
}
