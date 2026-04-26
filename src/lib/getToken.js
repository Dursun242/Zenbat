import { supabase } from "./supabase.js";

// Toujours récupérer un token frais : le state React peut être périmé
// si Supabase a silencieusement renouvelé le JWT en arrière-plan.
export async function getToken() {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}
