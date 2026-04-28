import { useState, useRef, useCallback, useEffect } from "react";
import { getMyProfile, saveBrandData } from "../lib/api";
import { DEFAULT_DEMO_BRAND, DEFAULT_BRAND } from "../lib/constants.js";
import { hydrateFromMetadata } from "../lib/appShell.js";

export function useBrand(user, setScreen) {
  const [brand, setBrandState] = useState(() => {
    try {
      const stored = localStorage.getItem("zenbat_brand");
      if (stored) return { ...DEFAULT_DEMO_BRAND, ...JSON.parse(stored) };
    } catch {}
    return DEFAULT_DEMO_BRAND;
  });

  const brandSaveTimer = useRef(null);

  const setBrand = useCallback((updater) => {
    setBrandState(prev => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      try { localStorage.setItem("zenbat_brand", JSON.stringify(next)); } catch {}
      clearTimeout(brandSaveTimer.current);
      brandSaveTimer.current = setTimeout(() => {
        saveBrandData(next).catch(err => console.warn("[brand sync]", err));
      }, 600);
      return next;
    });
  }, []);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    getMyProfile()
      .then(profile => {
        if (cancelled) return;
        if (profile?.brand_data && Object.keys(profile.brand_data).length > 0) {
          const merged = { ...DEFAULT_BRAND, ...profile.brand_data };
          setBrandState(merged);
          try { localStorage.setItem("zenbat_brand", JSON.stringify(merged)); } catch {}
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
  }, [user?.id, setBrand]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => clearTimeout(brandSaveTimer.current), []);

  return { brand, setBrand };
}
