import { useEffect, useState } from "react";

// Retourne une version retardée de `value`. Utile pour les barres de
// recherche : on garde la saisie réactive (le champ contrôlé met à jour
// immédiatement) mais on ne déclenche le filtre coûteux qu'après le
// délai sans frappe — évite les re-renders à chaque caractère sur les
// grosses listes (1000+ clients, 500+ utilisateurs admin, etc.).
//
// Usage :
//   const [q, setQ] = useState("")
//   const debouncedQ = useDebouncedValue(q, 200)
//   const filtered = useMemo(() => lourdFiltre(debouncedQ, list), [debouncedQ, list])
export function useDebouncedValue(value, delay = 200) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}
