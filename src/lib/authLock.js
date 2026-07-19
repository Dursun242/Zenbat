// Le Web Locks API du client Supabase auth sérialise le refresh du token entre
// onglets / requêtes concurrentes. Quand une requête prend le verrou avec
// { steal: true }, l'opération en cours est avortée → erreur transitoire et
// bénigne (l'opération perdante est simplement rejouée). Les libellés varient
// selon le moteur et la version de supabase-js :
//   - "AbortError: Lock was stolen by another request"
//   - "Lock \"lock:sb-…-auth-token\" was released because another request stole it"
//   - "Lock broken by another request with the 'steal' option"
// D'où ce matcher large, utilisé partout où une opération DB peut être avortée
// par cette contention (chargement/sauvegarde devis et factures).
export const isLockAbort = (e) => {
  if (e?.name === "AbortError") return true;
  const m = String(e?.message || "");
  return /lock.*(was stolen|stole it|released because another request|'steal' option|broken)/i.test(m);
};
