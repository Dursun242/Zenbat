import { useState, useEffect } from "react";
import { calcInvoiceTotals } from "../lib/invoiceCalc.js";
import {
  listInvoices,
  createInvoice as apiCreateInvoice,
  updateInvoice as apiUpdateInvoice,
  replaceInvoiceLignes,
  deleteInvoice as apiDeleteInvoice,
  nextInvoiceNumber,
  createAvoirFromInvoice as apiCreateAvoir,
  createAcompteFromDevis as apiCreateAcompte,
} from "../lib/api";

export function useInvoices(user, devis, brand, { markSaving, markSaved, setSaveState, showErr, setTab }) {
  const [invoices, setInvoices] = useState([]);
  const [selI,     setSelI]     = useState(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    listInvoices()
      .then(inv => { if (!cancelled) setInvoices(inv || []); })
      .catch(err => { if (!cancelled) console.warn("[Zenbat] factures indisponibles :", err.message); });
    return () => { cancelled = true; };
  }, [user?.id]);

  const goInvoice = (id) => { setSelI(id); setTab("factures_detail"); };

  const onSaveInvoice = (inv, saveLignes = false) => {
    // Garde-fou : une facture verrouillée (CGI art. 289) ne peut pas être
    // modifiée côté DB. La RLS la rejette → toast d'erreur inutile pour
    // l'utilisateur. On no-op : on rafraîchit le state local au cas où la
    // donnée locale serait stale (ex. lecture-seule d'un input verrouillé)
    // mais on n'envoie aucune requête.
    const previous = invoices.find(x => x.id === inv.id);
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
    const p1 = apiUpdateInvoice(inv.id, fields);
    const p2 = saveLignes
      ? replaceInvoiceLignes(inv.id, (il || []).map(({ id, created_at, ...l }) => l))
      : Promise.resolve();
    Promise.all([p1, p2]).then(
      () => markSaved(),
      (e) => { console.error("[save invoice]", e); showErr("Impossible de sauvegarder la facture"); setSaveState("idle"); },
    );
  };

  const onCreateInvoiceFromDevis = async (devisId) => {
    const d = devis.find(x => x.id === devisId);
    if (!d) { showErr("Devis introuvable"); return; }
    try {
      const numero = await nextInvoiceNumber().catch(() => `FAC-${new Date().getFullYear()}-${String(invoices.length + 1).padStart(4, "0")}`);
      const { ht, tva } = calcInvoiceTotals(d.lignes, brand.vatRegime);
      const saved = await apiCreateInvoice(
        {
          devis_id: d.id, client_id: d.client_id, numero, objet: d.objet,
          operation_type: "service", statut: "brouillon",
          montant_ht: ht, montant_tva: tva, montant_ttc: ht + tva,
          ville_chantier: d.ville_chantier,
          date_emission: new Date().toISOString().split("T")[0],
          date_echeance: new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0],
        },
        (d.lignes || []).map(({ id, created_at, ...l }) => l),
      );
      setInvoices(prev => [{ ...saved, lignes: d.lignes || [] }, ...prev]);
      goInvoice(saved.id);
    } catch (err) {
      console.error("[create invoice from devis]", err);
      showErr(err.message?.includes("does not exist") ? "Migration 0005 non appliquée côté Supabase" : "Impossible de créer la facture");
    }
  };

  const onCreateEmptyInvoice = async () => {
    try {
      const numero = await nextInvoiceNumber().catch(() => `FAC-${new Date().getFullYear()}-${String(invoices.length + 1).padStart(4, "0")}`);
      const saved = await apiCreateInvoice(
        {
          numero, objet: "Nouvelle facture", operation_type: "service", statut: "brouillon",
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
      showErr(err.message?.includes("does not exist") ? "Migration 0005 non appliquée côté Supabase" : "Impossible de créer la facture");
    }
  };

  const onCreateAcompte = async (devisId, montantHT, tvaRate) => {
    if (!user) { showErr("Vous devez être connecté."); return; }
    try {
      const found = devis.find(d => d.id === devisId);
      if (!found) throw new Error("Devis introuvable");
      const saved = await apiCreateAcompte(found, montantHT, tvaRate, brand?.vatRegime);
      const fresh = await listInvoices();
      setInvoices(fresh);
      goInvoice(saved.id);
    } catch (e) {
      console.error("[create acompte]", e);
      showErr(e?.message || "Impossible de créer l'acompte");
    }
  };

  const onCreateAvoir = async (invoiceId) => {
    if (!user) { showErr("Vous devez être connecté."); return; }
    try {
      const newId = await apiCreateAvoir(invoiceId);
      const fresh = await listInvoices();
      setInvoices(fresh);
      goInvoice(newId);
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
      showErr(e?.message || "Impossible de supprimer la facture");
    }
  };

  return {
    invoices, setInvoices, selI,
    onSaveInvoice, onCreateInvoiceFromDevis, onCreateEmptyInvoice,
    onCreateAcompte, onCreateAvoir, onDeleteInvoice, goInvoice,
  };
}
