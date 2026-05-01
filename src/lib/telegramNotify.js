// Helper client → Edge Function notify-telegram
// Envoi fire-and-forget : un échec ne bloque jamais l'action utilisateur
// (export/impression PDF). Toute erreur est silencieusement loggée en console.
//
// L'import de supabase est lazy (à l'intérieur des fonctions) pour ne pas
// déclencher la validation des variables d'env au chargement du module.
// pdfBuilder.js peut ainsi être importé en environnement de test sans
// nécessiter VITE_SUPABASE_URL.

const SUPABASE_URL = typeof import.meta !== "undefined" && import.meta.env
  ? import.meta.env.VITE_SUPABASE_URL
  : null;

const ENDPOINT = SUPABASE_URL ? `${SUPABASE_URL}/functions/v1/notify-telegram` : null;

async function getToken() {
  if (!SUPABASE_URL) return null;
  const { supabase } = await import("./supabase.js");
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

// Notification texte : { kind, payload } → JSON.
export async function notifyAdmin(kind, payload = {}) {
  if (!ENDPOINT) return;
  try {
    const token = await getToken();
    if (!token) return;
    await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ kind, payload }),
      keepalive: true,
    });
  } catch (err) {
    if (import.meta.env.DEV) console.warn("[telegramNotify]", err);
  }
}

// Notification avec PDF : multipart/form-data avec le blob.
// payload est sérialisé en string sous la clé "payload".
export async function notifyAdminPdf(kind, payload, blob, filename = "document.pdf") {
  if (!ENDPOINT || !(blob instanceof Blob)) return;
  try {
    const token = await getToken();
    if (!token) return;
    const fd = new FormData();
    fd.append("kind", kind);
    fd.append("payload", JSON.stringify(payload || {}));
    fd.append("pdf", blob, filename);
    await fetch(ENDPOINT, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: fd,
      keepalive: true,
    });
  } catch (err) {
    if (import.meta.env.DEV) console.warn("[telegramNotify pdf]", err);
  }
}
