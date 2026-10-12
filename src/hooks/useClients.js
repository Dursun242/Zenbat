import { useState, useEffect } from "react";
import {
  listClients,
  createClient as apiCreateClient,
  updateClient as apiUpdateClient,
  deleteClient as apiDeleteClient,
} from "../lib/api";
import { DEMO_CLIENTS } from "../lib/constants.js";
import { logError } from "../lib/logger.js";

export function useClients(user, { markSaving, markSaved, setSaveState, showErr }) {
  // Connecté : liste vide jusqu'au premier chargement (cf. useDevis).
  const [clients, setClients] = useState(() => (user ? [] : DEMO_CLIENTS));
  const [loaded,    setLoaded]    = useState(!user);
  const [loadError, setLoadError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    listClients()
      .then(cs => {
        if (cancelled) return;
        setClients(cs.length ? cs : []);
        setLoaded(true); setLoadError(null);
      })
      .catch(err => {
        if (!cancelled) {
          setLoadError(err || new Error("load clients failed"));
          console.error("[load clients]", err); showErr("Erreur de chargement — vérifie ta connexion");
          logError("load clients failed", err?.stack, { area: "clients-load", code: err?.code, msg: err?.message });
        }
      });
    return () => { cancelled = true; };
  }, [user?.id, reloadKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Relance le chargement de la liste (bouton « Réessayer »).
  const reload = () => { setLoadError(null); setReloadKey(k => k + 1); };

  const onSaveClient = async (c) => {
    const isNew = !clients.some(x => x.id === c.id);
    setClients(prev => isNew ? [c, ...prev] : prev.map(x => x.id === c.id ? c : x));
    if (!user) return;
    markSaving();
    try {
      const { created_at, updated_at, ...fields } = c;
      if (isNew) await apiCreateClient(fields);
      else       await apiUpdateClient(c.id, fields);
      markSaved();
    } catch (err) {
      console.error("[save client]", err); showErr("Impossible de sauvegarder le contact"); setSaveState("idle");
      logError("save client failed", err?.stack, { area: "client-save", client_id: c.id, isNew, code: err?.code, msg: err?.message });
    }
  };

  const onDeleteClient = async (id) => {
    const victim = clients.find(x => x.id === id);
    const idx    = clients.findIndex(x => x.id === id);
    setClients(prev => prev.filter(x => x.id !== id));
    if (user) apiDeleteClient(id).catch(e => {
      console.error("[delete client]", e); showErr("Impossible de supprimer le contact");
      logError("delete client failed", e?.stack, { area: "client-delete", client_id: id, code: e?.code, msg: e?.message });
    });
    return { victim, idx };
  };

  const onRestoreClient = (victim, idx) => {
    setClients(prev => { const n = [...prev]; n.splice(Math.min(idx, n.length), 0, victim); return n; });
    if (user) {
      const { created_at, updated_at, ...fields } = victim;
      apiCreateClient(fields).catch(e => console.error("[restore client]", e));
    }
  };

  return { clients, setClients, loaded, loadError, reload, onSaveClient, onDeleteClient, onRestoreClient };
}
