import { useState, useRef, useCallback } from "react";

export function useSaveState() {
  const [saveState, setSaveState] = useState("idle");
  const timer = useRef(null);

  const markSaving = useCallback(() => {
    clearTimeout(timer.current);
    setSaveState("saving");
  }, []);

  const markSaved = useCallback(() => {
    clearTimeout(timer.current);
    setSaveState("saved");
    timer.current = setTimeout(() => setSaveState("idle"), 1800);
  }, []);

  return { saveState, setSaveState, markSaving, markSaved };
}
