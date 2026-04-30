import { supabase } from "../supabase.js";

export const DEFAULT_SETTINGS = {
  global_disabled: false,
  typology_overrides: {},
};

// Charge les paramètres de cohérence de l'utilisateur connecté.
// Retourne les defaults si la table n'existe pas encore ou si l'utilisateur
// n'a pas encore de ligne (migration 0025 non appliquée → silencieux).
export async function loadUserCoherenceSettings() {
  try {
    const { data, error } = await supabase
      .from("coherence_user_settings")
      .select("settings")
      .maybeSingle();
    if (error || !data) return { ...DEFAULT_SETTINGS };
    return { ...DEFAULT_SETTINGS, ...data.settings };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

// Persiste les paramètres de cohérence (upsert — crée ou met à jour).
export async function saveUserCoherenceSettings(settings) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase
      .from("coherence_user_settings")
      .upsert(
        { user_id: user.id, settings, updated_at: new Date().toISOString() },
        { onConflict: "user_id" }
      );
  } catch { /* silencieux */ }
}
