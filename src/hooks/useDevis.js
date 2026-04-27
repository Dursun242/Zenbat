import { useState, useRef, useEffect } from "react";
import {
  listDevisWithLignes, getDevis,
  createDevis as apiCreateDevis,
  updateDevis as apiUpdateDevis,
  replaceLignes,
  deleteDevis as apiDeleteDevis,
  createIndiceDevis as apiCreateIndice,
} from "../lib/api";
import { uid } from "../lib/utils.js";
import { DEMO_DEVIS } from "../lib/constants.js";

export function useDevis(user, { markSaving, markSaved, setSaveState, showErr, setTab }) {
  const [devis,        setDevis]        = useState(DEMO_DEVIS);
  const [selD,         setSelD]         = useState(null);
  const [loadingDevis, setLoadingDevis] = useState(new Set());
  const [autoOpenPDF,  setAutoOpenPDF]  = useState(null);
  const saveTimers = useRef({});

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    listDevisWithLignes()
      .then(ds => { if (!cancelled) setDevis(ds.length ? ds : []); })
      .catch(err => {
        if (!cancelled) { console.error("[load devis]", err); showErr("Erreur de chargement — vérifiez votre connexion"); }
      });
    return () => { cancelled = true; };
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const scheduleDevisSave = (d, immediate = false, saveLignes = false) => {
    if (!user) return;
    const run = async () => {
      markSaving();
      try {
        const { lignes: dl, client, created_at, updated_at, id: _id, ...fields } = d;
        await apiUpdateDevis(d.id, fields);
        if (saveLignes) await replaceLignes(d.id, (dl || []).map(({ id, created_at, ...l }) => l));
        markSaved();
      } catch (err) { console.error("[save devis]", err); showErr("Impossible de sauvegarder le devis"); setSaveState("idle"); }
    };
    if (immediate) { run(); return; }
    clearTimeout(saveTimers.current[d.id]);
    saveTimers.current[d.id] = setTimeout(run, 800);
  };

  const onSaveDevis = (d, saveLignes = false) => {
    setDevis(prev => prev.map(x => x.id === d.id ? d : x));
    scheduleDevisSave(d, false, saveLignes);
  };

  const onCreateDevis = async (d) => {
    setDevis(prev => [d, ...prev]);
    if (!user) return;
    try {
      const { lignes: dl, client, created_at, updated_at, ...fields } = d;
      const saved = await apiCreateDevis(fields, (dl || []).map(({ id, created_at, ...l }) => l));
      if (dl?.length) {
        const fresh = await getDevis(saved.id);
        if (fresh && !fresh.lignes?.length) {
          await replaceLignes(saved.id, (dl || []).map(({ id, created_at, ...l }) => l));
        }
        if (fresh?.lignes?.length) {
          setDevis(prev => prev.map(x => x.id === d.id ? { ...x, lignes: fresh.lignes } : x));
        }
      }
    } catch (err) { console.error("[create devis]", err); showErr("Erreur lors de l'enregistrement du devis"); }
  };

  const goDevis = (id) => {
    setSelD(id); setTab("devis_detail");
    if (!user) return;
    setLoadingDevis(prev => { const n = new Set(prev); n.add(id); return n; });
    getDevis(id)
      .then(fresh => {
        setLoadingDevis(prev => { const n = new Set(prev); n.delete(id); return n; });
        if (!fresh) return;
        setDevis(prev => prev.map(x => {
          if (x.id !== id) return x;
          const dbLignes    = fresh.lignes || [];
          const stateLignes = x.lignes     || [];
          if (dbLignes.length > 0) return { ...x, lignes: dbLignes, montant_ht: fresh.montant_ht ?? x.montant_ht };
          if (stateLignes.length > 0) {
            replaceLignes(id, stateLignes.map(({ id: _, created_at: __, ...l }) => l))
              .catch(err => { console.error("[goDevis] retry lignes:", err); showErr("Erreur de synchronisation des lignes"); });
            return x;
          }
          return { ...x, montant_ht: fresh.montant_ht ?? x.montant_ht };
        }));
      })
      .catch(err => {
        setLoadingDevis(prev => { const n = new Set(prev); n.delete(id); return n; });
        console.error("[goDevis reload]", err);
        const hasCached = devis.some(x => x.id === id);
        if (!hasCached) showErr("Impossible de charger le devis — vérifiez votre connexion");
      });
  };

  const onDuplicateDevis = async (sourceId) => {
    const src = devis.find(d => d.id === sourceId);
    if (!src) return;
    const newId     = uid();
    const newNumero = `DEV-${new Date().getFullYear()}-${String(devis.length + 1).padStart(4, "0")}`;
    const copy = {
      id:             newId,
      numero:         newNumero,
      objet:          src.objet ? `Copie – ${src.objet}` : "Copie",
      client_id:      src.client_id,
      ville_chantier: src.ville_chantier,
      statut:         "brouillon",
      montant_ht:     src.montant_ht,
      tva_rate:       src.tva_rate,
      date_emission:  new Date().toISOString().split("T")[0],
      lignes:         (src.lignes || []).map(l => ({ ...l, id: uid() })),
    };
    await onCreateDevis(copy);
    goDevis(newId);
  };

  const onCreateIndice = async (sourceId) => {
    if (!user) { showErr("Vous devez être connecté."); return; }
    try {
      const src = devis.find(d => d.id === sourceId);
      if (!src) throw new Error("Devis introuvable");
      const created = await apiCreateIndice(src);
      setDevis(prev => prev.map(d => d.id === sourceId && d.statut !== "remplace"
        ? { ...d, statut: "remplace" } : d));
      setDevis(prev => [{ ...created }, ...prev]);
      goDevis(created.id);
    } catch (e) {
      console.error("[create indice]", e);
      showErr(e?.message || "Impossible de créer l'indice");
    }
  };

  const onDeleteDevis = async (id) => {
    if (!user) { setDevis(prev => prev.filter(x => x.id !== id)); return; }
    try {
      await apiDeleteDevis(id);
      setDevis(prev => prev.filter(x => x.id !== id));
    } catch (e) {
      console.error("[delete devis]", e);
      showErr(e?.message || "Impossible de supprimer le devis");
    }
  };

  return {
    devis, setDevis, selD, setSelD, loadingDevis, autoOpenPDF, setAutoOpenPDF,
    onSaveDevis, onCreateDevis, onDuplicateDevis, onCreateIndice, onDeleteDevis, goDevis,
  };
}
