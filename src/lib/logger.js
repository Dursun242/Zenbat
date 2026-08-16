// Thin wrapper autour de window.AppLogger initialisé dans index.html.
// Utilisable dans tous les composants React sans import Supabase direct.

import { isTransientNetworkError } from "./authLock.js";

export const logError = (message, stack, context) => {
  try {
    // Filtre central : les échecs réseau transitoires (« Failed to fetch »,
    // « Load failed », timeouts) ne sont pas des bugs applicatifs — pendant
    // une panne Supabase, les logger revient à marteler la base déjà saturée
    // et à noyer le panel admin (incident 16/08). L'utilisateur, lui, voit
    // déjà son toast ; on garde une trace console pour le debug local.
    const candidates = [message, context?.msg, context?.reason, stack];
    if (candidates.some(c => c && isTransientNetworkError(c))) {
      console.warn("[logError filtré — réseau transitoire]", message, context?.msg || "");
      return;
    }
    window.AppLogger?.logError(message, stack, context);
  } catch (_) {}
};

export const logInfo = (message, context) => {
  try { window.AppLogger?.logInfo(message, context); } catch (_) {}
};

export const getSessionId = () => {
  try { return window.AppLogger?.sessionId ?? null; } catch (_) { return null; }
};
