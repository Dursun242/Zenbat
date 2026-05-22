// useSupportUnread — détecte s'il y a un message support non lu pour l'user
// connecté. Sert à afficher un dot sur le menu hamburger + sur l'item "Support".
//
// Définition d'un message non lu : message role IN ('claude','admin') dont
// created_at > support_tickets.user_last_seen_at (ou created_at du ticket si
// jamais vu). On regarde uniquement le dernier ticket non résolu de l'user.
//
// Rafraîchissement : initial + sur focus/visibilitychange (throttle 5s). Pas
// de realtime — un user ne s'attend pas à voir un badge support clignoter
// pendant qu'il travaille sur autre chose.

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase.js";
import { useAuth } from "../lib/auth.jsx";

export function useSupportUnread() {
  const { user } = useAuth();
  const [hasUnread, setHasUnread] = useState(false);
  const lastCheckRef = useRef(0);

  const check = useCallback(async () => {
    if (!user?.id) { setHasUnread(false); return; }
    lastCheckRef.current = Date.now();

    const { data: ticket } = await supabase
      .from("support_tickets")
      .select("id, user_last_seen_at, created_at")
      .eq("user_id", user.id)
      .neq("status", "resolved")
      .order("last_message_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!ticket) { setHasUnread(false); return; }

    const since = ticket.user_last_seen_at || ticket.created_at;
    const { count } = await supabase
      .from("support_messages")
      .select("id", { count: "exact", head: true })
      .eq("ticket_id", ticket.id)
      .in("role", ["claude", "admin"])
      .gt("created_at", since);
    setHasUnread((count ?? 0) > 0);
  }, [user?.id]);

  useEffect(() => {
    check();
    const onVis = () => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - lastCheckRef.current < 5000) return; // throttle 5s
      check();
    };
    // visibilitychange n'est dispatché que sur document, jamais sur window.
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("focus", onVis);
    };
  }, [check]);

  return { hasUnread, refresh: check };
}
