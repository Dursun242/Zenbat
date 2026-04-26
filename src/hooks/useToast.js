import { useState, useCallback } from "react";

export function useToast() {
  const [toast, setToast] = useState(null);

  const showUndo = useCallback((label, onUndo) => {
    setToast(prev => {
      if (prev?.timer) clearTimeout(prev.timer);
      const timer = setTimeout(() => setToast(null), 6000);
      return { label, onUndo, timer };
    });
  }, []);

  const showErr = useCallback((label) => {
    setToast(prev => {
      if (prev?.timer) clearTimeout(prev.timer);
      const timer = setTimeout(() => setToast(null), 5000);
      return { label, isError: true, timer };
    });
  }, []);

  const dismissToast = useCallback(() =>
    setToast(prev => { if (prev?.timer) clearTimeout(prev.timer); return null; }),
  []);

  return { toast, showUndo, showErr, dismissToast };
}
