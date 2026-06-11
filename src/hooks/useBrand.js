import { useState, useRef, useCallback, useEffect } from "react";
import { getMyProfile, saveBrandData } from "../lib/api";
import { DEFAULT_DEMO_BRAND, DEFAULT_BRAND } from "../lib/constants.js";
import { hydrateFromMetadata } from "../lib/appShell.js";

// Clé scopée par user.id : une clé globale faisait hériter le branding
// (logo, coordonnées) du compte précédent sur le même navigateur — même
// famille de bug que le compteur freemium sticky (cf. CLAUDE.md).
const brandKey = (userId) => (userId ? `zenbat_brand:${userId}` : null);

function readCachedBrand(userId) {
  const key = brandKey(userId);
  if (!key) return null;
  try {
    const stored = localStorage.getItem(key);
    if (stored) return { ...DEFAULT_DEMO_BRAND, ...JSON.parse(stored) };
  } catch {}
  return null;
}

export function useBrand(user, setScreen) {
  const [brand, setBrandState] = useState(
    () => readCachedBrand(user?.id) || DEFAULT_DEMO_BRAND
  );

  const brandSaveTimer = useRef(null);
  // setBrand est un useCallback([]) : il capturerait le user du premier
  // render (souvent null pendant le chargement auth) — on passe par une ref.
  const userIdRef = useRef(user?.id);
  userIdRef.current = user?.id;

  const setBrand = useCallback((updater) => {
    setBrandState(prev => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      const key = brandKey(userIdRef.current);
      if (key) { try { localStorage.setItem(key, JSON.stringify(next)); } catch {} }
      clearTimeout(brandSaveTimer.current);
      brandSaveTimer.current = setTimeout(() => {
        saveBrandData(next).catch(err => console.warn("[brand sync]", err));
      }, 600);
      return next;
    });
  }, []);

  useEffect(() => {
    if (!user) return;
    // Purge l'ancienne clé globale non scopée (potentiellement contaminée
    // par un autre compte sur ce navigateur).
    try { localStorage.removeItem("zenbat_brand"); } catch {}
    // Paint instantané depuis le cache scopé du user, en attendant le profil.
    const cached = readCachedBrand(user.id);
    if (cached) setBrandState(cached);
    let cancelled = false;
    getMyProfile()
      .then(profile => {
        if (cancelled) return;
        if (profile?.brand_data && Object.keys(profile.brand_data).length > 0) {
          const merged = { ...DEFAULT_BRAND, ...profile.brand_data };
          setBrandState(merged);
          const key = brandKey(user.id);
          if (key) { try { localStorage.setItem(key, JSON.stringify(merged)); } catch {} }
        } else {
          hydrateFromMetadata(user, setBrand);
          setScreen?.("trades_picker");
        }
      })
      .catch(err => {
        if (cancelled) return;
        console.warn("[brand load]", err);
        hydrateFromMetadata(user, setBrand);
      });
    return () => { cancelled = true; };
    // setBrand est créé une seule fois via useCallback([]), il est stable
    // et n'a pas besoin d'être en dépendance — l'inclure faisait re-runner
    // l'effet sans raison (audit P2 sur les fetches inutiles au login).
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => clearTimeout(brandSaveTimer.current), []);

  return { brand, setBrand };
}
