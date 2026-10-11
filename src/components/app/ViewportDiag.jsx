// Diagnostic d'affichage (iPhone / PWA) : ouvert par 5 appuis rapides sur le
// logo de l'en-tête. Affiche les mesures réelles que le navigateur donne à
// l'appli (viewport, écran, zones de sécurité, position de la barre du bas)
// pour corriger les décalages propres à iOS sans travailler à l'aveugle.
import { useEffect, useState } from "react";

function readInsets() {
  const probe = document.createElement("div");
  probe.style.cssText = "position:fixed;visibility:hidden;pointer-events:none;" +
    "padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px);" +
    "padding-left:env(safe-area-inset-left,0px);padding-right:env(safe-area-inset-right,0px)";
  document.body.appendChild(probe);
  const cs = getComputedStyle(probe);
  const v = { top: cs.paddingTop, bottom: cs.paddingBottom, left: cs.paddingLeft, right: cs.paddingRight };
  probe.remove();
  return v;
}

function measure() {
  const vv = window.visualViewport;
  const nav = document.querySelector(".app-bottom-nav")?.getBoundingClientRect();
  const insets = readInsets();
  const script = [...document.scripts].map(s => s.src).find(src => /\/assets\/index-/.test(src)) || "";
  const iosVersion = (navigator.userAgent.match(/OS (\d+[_\d]*) like Mac OS X/) || [])[1]?.replace(/_/g, ".") || "—";
  return [
    ["Version de l'appli", script.split("/").pop() || "—"],
    ["iOS", iosVersion],
    ["Mode installé (standalone)", String(window.matchMedia("(display-mode: standalone)").matches || !!navigator.standalone)],
    ["Écran (screen)", `${screen.width} × ${screen.height}`],
    ["window.inner", `${window.innerWidth} × ${window.innerHeight}`],
    ["window.outerHeight", String(window.outerHeight)],
    ["visualViewport", vv ? `${Math.round(vv.width)} × ${Math.round(vv.height)} (offsetTop ${Math.round(vv.offsetTop)})` : "—"],
    ["html.clientHeight", String(document.documentElement.clientHeight)],
    ["Zone sécurité haut / bas", `${insets.top} / ${insets.bottom}`],
    ["Barre du bas (haut → bas)", nav ? `${Math.round(nav.top)} → ${Math.round(nav.bottom)} (h ${Math.round(nav.height)})` : "—"],
    ["Écart bas barre / bas écran", nav ? `${Math.round(window.outerHeight - nav.bottom)} px` : "—"],
    ["Correctif iOS (--ios-viewport-gap)", getComputedStyle(document.documentElement).getPropertyValue("--ios-viewport-gap").trim() || "0px"],
    ["devicePixelRatio", String(window.devicePixelRatio)],
  ];
}

export default function ViewportDiag({ onClose }) {
  const [rows, setRows] = useState(measure);

  useEffect(() => {
    const update = () => setRows(measure());
    const t = setInterval(update, 1000);
    window.visualViewport?.addEventListener("resize", update);
    window.addEventListener("resize", update);
    return () => {
      clearInterval(t);
      window.visualViewport?.removeEventListener("resize", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  return (
    <div role="dialog" aria-label="Diagnostic d'affichage"
      style={{ position: "fixed", top: "calc(70px + env(safe-area-inset-top, 0px))", left: 12, right: 12, zIndex: 9999, background: "white", borderRadius: 12, boxShadow: "0 12px 40px rgba(0,0,0,.35)", padding: 14, fontSize: 12, color: "#1A1612" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <strong style={{ fontSize: 13 }}>Diagnostic d'affichage</strong>
        <button onClick={onClose} aria-label="Fermer" style={{ border: "none", background: "#F0EBE3", borderRadius: 8, padding: "4px 10px", fontSize: 12, fontWeight: 600 }}>Fermer</button>
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <tbody>
          {rows.map(([k, v]) => (
            <tr key={k} style={{ borderTop: "1px solid #F0EBE3" }}>
              <td style={{ padding: "5px 6px 5px 0", color: "#6B6358" }}>{k}</td>
              <td style={{ padding: "5px 0", fontWeight: 600, textAlign: "right", wordBreak: "break-all" }}>{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ marginTop: 8, color: "#6B6358", lineHeight: 1.4 }}>Faites une capture d'écran de ce panneau et envoyez-la.</div>
    </div>
  );
}
