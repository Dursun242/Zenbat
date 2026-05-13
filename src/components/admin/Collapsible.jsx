import { useState, useRef, useEffect } from "react";

// Section repliable utilisée dans le panel admin pour limiter la longueur
// d'écran. Par défaut fermée — chaque section déclenche son chargement
// (onExpand) uniquement la première fois qu'elle s'ouvre, ce qui évite
// d'enchaîner 8 endpoints en parallèle à l'ouverture du panel.
//
// Pattern visuel : le header est une card autonome (toujours arrondie
// sur les 4 coins). Quand ouvert, les enfants apparaissent en dessous —
// chaque enfant (AdminQuotesSent etc.) a déjà son propre wrapper card,
// donc on n'ajoute pas de wrapper supplémentaire ici (pas de double card).
//
// Props :
//   title       — libellé de la section (string)
//   count       — pastille optionnelle (number) à droite du titre
//   subtitle    — petite ligne sous le titre (string, optionnel)
//   defaultOpen — booléen, si true la section est ouverte au montage
//   loaded      — booléen : data déjà chargée ? Si false, onExpand est
//                 appelé la première fois que l'utilisateur ouvre
//   onExpand    — callback appelé à la 1re ouverture si !loaded
//   children    — contenu de la section
export default function Collapsible({ title, count = null, subtitle = null, defaultOpen = false, loaded = true, onExpand, children }) {
  const [open, setOpen] = useState(defaultOpen);
  const triggered = useRef(false);

  useEffect(() => {
    if (open && !loaded && !triggered.current) {
      triggered.current = true;
      onExpand?.();
    }
  }, [open, loaded, onExpand]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        style={{
          width: "100%",
          background: "white",
          border: "none",
          borderRadius: 14,
          padding: "14px 16px",
          marginBottom: 12,
          display: "flex",
          alignItems: "center",
          gap: 12,
          cursor: "pointer",
          textAlign: "left",
          fontFamily: "inherit",
          boxShadow: "0 1px 4px rgba(0,0,0,.06)",
        }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontWeight: 700, fontSize: 14, color: "#1A1612", letterSpacing: "-0.2px" }}>{title}</span>
            {count !== null && count !== undefined && (
              <span style={{
                fontSize: 10, fontWeight: 700, color: "#6B6358",
                background: "#F0EBE3", padding: "2px 8px", borderRadius: 12,
              }}>
                {Number(count).toLocaleString("fr-FR")}
              </span>
            )}
          </div>
          {subtitle && (
            <div style={{ fontSize: 11, color: "#9A8E82", marginTop: 2 }}>{subtitle}</div>
          )}
        </div>
        <div style={{
          color: open ? "#C97B5C" : "#9A8E82",
          fontSize: 20,
          fontWeight: 400,
          transform: open ? "rotate(90deg)" : "rotate(0deg)",
          transition: "transform .15s ease, color .15s",
          lineHeight: 1,
        }}>›</div>
      </button>
      {open && <>{children}</>}
    </>
  );
}
