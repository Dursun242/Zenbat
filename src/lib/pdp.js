// Super PDP (plateforme agréée) côté navigateur — passe par /api/facturx
// (actions pdp_*, cf. api/_pdp.js). Les jetons Super PDP ne quittent jamais
// le serveur.
import { getToken } from "./getToken.js";

async function call(action, payload = {}) {
  const token = await getToken();
  const res = await fetch("/api/facturx", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ action, ...payload }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data?.error || `Erreur ${res.status}`);
    err.code = data?.code || null;
    throw err;
  }
  return data;
}

export const pdp = {
  status:     () => call("pdp_status"),
  connect:    async () => { const { url } = await call("pdp_connect"); window.location.href = url; },
  disconnect: () => call("pdp_disconnect"),
  inbox:      (after = null) => call("pdp_inbox", after ? { after } : {}),
  setStatus:  (invoiceId, statusCode) => call("pdp_event", { invoice_id: invoiceId, status_code: statusCode }),
  // Fichier de la facture (PDF Factur-X ou XML) prêt à ouvrir.
  download: async (invoiceId) => {
    const { base64, content_type } = await call("pdp_download", { invoice_id: invoiceId });
    const type = content_type || "application/pdf";
    return fetch(`data:${type};base64,${String(base64 || "").replace(/\s/g, "")}`).then(r => r.blob());
  },
};

// Messages du retour OAuth (?pdp= dans l'URL, posé par api/_pdp.js).
export const PDP_RETURN_MESSAGES = {
  connected: { ok: true,  text: "Ton compte Super PDP est connecté." },
  denied:    { ok: false, text: "Connexion annulée sur Super PDP." },
  expired:   { ok: false, text: "Le lien de connexion a expiré. Recommence." },
  error:     { ok: false, text: "La connexion à Super PDP a échoué. Réessaie dans un instant." },
};
