// Thin wrapper autour de window.AppLogger initialisé dans index.html.
// Utilisable dans tous les composants React sans import Supabase direct.

export const logError = (message, stack, context) => {
  try { window.AppLogger?.logError(message, stack, context); } catch (_) {}
};

export const logInfo = (message, context) => {
  try { window.AppLogger?.logInfo(message, context); } catch (_) {}
};

export const getSessionId = () => {
  try { return window.AppLogger?.sessionId ?? null; } catch (_) { return null; }
};
