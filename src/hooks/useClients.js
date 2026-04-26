import { useState, useEffect } from "react";
import {
  listClients,
  createClient as apiCreateClient,
  updateClient as apiUpdateClient,
  deleteClient as apiDeleteClient,
} from "../lib/api";
import { DEMO_CLIENTS } from "../lib/constants.js";

export function useClients(user, { markSaving, markSaved, setSaveState, showErr }) {
  const [clients, setClients] = useState(DEMO_CLIENTS);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    listClients()
      .then(cs => { if (!cancelled) setClients(cs.length ? cs : []); })
      .catch(err => {
        if (!cancelled) { console.error("[load clients]", err); showErr("Erreur de chargement — vérifiez votre connexion"); }
      });
    return () => { cancelled = true; };
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

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
    } catch (err) { console.error("[save client]", err); showErr("Impossible de sauvegarder le contact"); setSaveState("idle"); }
  };

  const onDeleteClient = async (id) => {
    const victim = clients.find(x => x.id === id);
    const idx    = clients.findIndex(x => x.id === id);
    setClients(prev => prev.filter(x => x.id !== id));
    if (user) apiDeleteClient(id).catch(e => { console.error("[delete client]", e); showErr("Impossible de supprimer le contact"); });
    return { victim, idx };
  };

  const onRestoreClient = (victim, idx) => {
    setClients(prev => { const n = [...prev]; n.splice(Math.min(idx, n.length), 0, victim); return n; });
    if (user) {
      const { created_at, updated_at, ...fields } = victim;
      apiCreateClient(fields).catch(e => console.error("[restore client]", e));
    }
  };

  return { clients, setClients, onSaveClient, onDeleteClient, onRestoreClient };
}
