// Menu hamburger affiché dans le header. Regroupe : statut abonnement, accès profil,
// admin (si admin), déconnexion. Évite l'encombrement du bandeau supérieur sur mobile.
//
// Implémentation : panneau en position:fixed (le header n'a pas de transform parent —
// voir CLAUDE.md sur les containing blocks). Backdrop transparent qui capture
// le clic pour fermer.

import { useEffect, useRef, useState } from "react";
import { I } from "../ui/icons.jsx";
import { getToken } from "../../lib/getToken.js";

function fmtUsd(n) {
  if (!n) return "$0.000";
  if (n < 0.01) return `$${n.toFixed(4)}`;
  if (n < 1)    return `$${n.toFixed(3)}`;
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(n);
}

function TokenRow({ label, cost, calls }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "3px 0" }}>
      <span style={{ fontSize: 11, color: "#6B6358" }}>{label}</span>
      <span style={{ fontSize: 11, fontWeight: 700, color: "#1A1612" }}>
        {fmtUsd(cost)}
        <span style={{ fontWeight: 400, color: "#9A8E82", marginLeft: 4 }}>{calls > 0 ? `·${calls}` : ""}</span>
      </span>
    </div>
  );
}

export default function HeaderMenu({
  isAdmin,
  user,
  effectivePlan,
  daysLeft,
  onOpenAdmin,
  onOpenProfile,
  onOpenSubscription,
  onOpenPaywall,
  onOpenSupport,
  onSignOut,
}) {
  const [open,       setOpen]       = useState(false);
  const [tokenData,  setTokenData]  = useState(null);
  const [tokenLoading, setTokenLoading] = useState(false);
  const btnRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Charge les stats de tokens quand le menu s'ouvre (admin uniquement)
  useEffect(() => {
    if (!open || !isAdmin || tokenData) return;
    setTokenLoading(true);
    getToken().then(tok =>
      fetch("/api/admin-stats?type=tokens", { headers: { Authorization: `Bearer ${tok}` } })
        .then(r => r.json())
        .then(d => { if (d.total) setTokenData(d); })
        .catch(() => {})
        .finally(() => setTokenLoading(false))
    );
  }, [open, isAdmin]);

  const close = () => setOpen(false);

  const isPro = effectivePlan === "pro";
  const trialUrgent = !isPro && daysLeft <= 7;

  const itemBase = {
    display: "flex", alignItems: "center", gap: 10,
    width: "100%", padding: "11px 14px",
    background: "transparent", border: "none",
    color: "#1A1612", fontSize: 14, fontWeight: 500,
    cursor: "pointer", textAlign: "left",
  };

  return (
    <>
      <button
        ref={btnRef}
        onClick={() => setOpen(o => !o)}
        title="Menu"
        aria-label="Menu"
        aria-expanded={open}
        style={{
          position: "relative",
          background: "#2A231C", border: "1px solid #3D3028", borderRadius: 8,
          padding: "6px 9px", display: "flex", alignItems: "center",
          color: "#E8E2D8", cursor: "pointer",
        }}>
        {I.menu}
        {trialUrgent && (
          <span style={{
            position: "absolute", top: -3, right: -3,
            width: 8, height: 8, borderRadius: "50%",
            background: daysLeft === 0 ? "#ef4444" : "#f97316",
            border: "2px solid #1A1612",
          }}/>
        )}
      </button>

      {open && (
        <>
          {/* Backdrop : capture clic à l'extérieur */}
          <div
            onClick={close}
            style={{
              position: "fixed", inset: 0,
              background: "transparent", zIndex: 90,
            }}
          />
          {/* Panneau */}
          <div
            role="menu"
            style={{
              position: "fixed",
              top: "calc(50px + env(safe-area-inset-top))",
              right: "calc(14px + env(safe-area-inset-right))",
              width: 260, maxWidth: "calc(100vw - 28px)",
              background: "#fff",
              border: "1px solid #E8E2D8",
              borderRadius: 14,
              boxShadow: "0 12px 32px rgba(0,0,0,.18)",
              zIndex: 100,
              overflow: "hidden",
              animation: "popIn .18s ease both",
            }}>
            {/* Identité + statut abonnement */}
            <div style={{ padding: "14px 14px 12px", borderBottom: "1px solid #F1ECE3" }}>
              {user?.email && (
                <div style={{ fontSize: 12, color: "#6B6358", marginBottom: 8, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {user.email}
                </div>
              )}
              <button
                onClick={() => { close(); isPro ? onOpenSubscription() : onOpenPaywall(); }}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  background: isPro ? "rgba(34,197,94,.12)" : (trialUrgent ? "rgba(249,115,22,.12)" : "#F5F0E8"),
                  color:      isPro ? "#16a34a"            : (trialUrgent ? "#c2410c"             : "#6B6358"),
                  border:     `1px solid ${isPro ? "rgba(34,197,94,.25)" : (trialUrgent ? "rgba(249,115,22,.25)" : "#E8E2D8")}`,
                  fontSize: 11, fontWeight: 700,
                  padding: "4px 10px", borderRadius: 20,
                  cursor: "pointer",
                }}>
                {isPro
                  ? <>{I.crown} PRO · gérer</>
                  : daysLeft === 0
                    ? <>Essai terminé · passer Pro</>
                    : <>Essai · {daysLeft}j · passer Pro</>}
              </button>
            </div>

            <button role="menuitem" onClick={() => { close(); onOpenProfile(); }} style={itemBase}
              onMouseEnter={e => e.currentTarget.style.background = "#FAF7F2"}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
              <span style={{ color: "#6B6358", display: "inline-flex" }}>{I.paint}</span>
              Mon profil
            </button>

            {onOpenSupport && (
              <button role="menuitem" onClick={() => { close(); onOpenSupport(); }} style={itemBase}
                onMouseEnter={e => e.currentTarget.style.background = "#FAF7F2"}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                <span style={{ color: "#22c55e", display: "inline-flex" }}>{I.chat}</span>
                Support
              </button>
            )}

            {isAdmin && (
              <>
                <div style={{ padding: "10px 14px 8px", borderTop: "1px solid #F1ECE3" }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "#9A8E82", letterSpacing: "0.5px", textTransform: "uppercase", marginBottom: 6, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    Coûts IA
                    <button
                      onClick={() => { setTokenData(null); setTokenLoading(true); getToken().then(tok => fetch("/api/admin-stats?type=tokens", { headers: { Authorization: `Bearer ${tok}` } }).then(r => r.json()).then(d => { if (d.total) setTokenData(d); }).catch(() => {}).finally(() => setTokenLoading(false))); }}
                      style={{ background: "none", border: "none", color: "#9A8E82", fontSize: 11, cursor: "pointer", padding: 0 }}>↻</button>
                  </div>
                  {tokenLoading && <div style={{ fontSize: 11, color: "#9A8E82" }}>Chargement…</div>}
                  {!tokenLoading && !tokenData && <div style={{ fontSize: 11, color: "#9A8E82" }}>Aucune donnée</div>}
                  {!tokenLoading && tokenData && (
                    <>
                      <TokenRow label="Aujourd'hui"   cost={tokenData.today.cost}  calls={tokenData.today.calls} />
                      <TokenRow label="Cette semaine" cost={tokenData.week.cost}   calls={tokenData.week.calls} />
                      <TokenRow label="Ce mois-ci"    cost={tokenData.month.cost}  calls={null} />
                      <TokenRow label="Total"         cost={tokenData.total.cost}  calls={tokenData.total.calls} />
                    </>
                  )}
                </div>
                <button role="menuitem" onClick={() => { close(); onOpenAdmin(); }} style={itemBase}
                  onMouseEnter={e => e.currentTarget.style.background = "#FAF7F2"}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                  <span style={{ color: "#f59e0b", display: "inline-flex" }}>{I.cog}</span>
                  Panel admin
                </button>
              </>
            )}

            {user && (
              <>
                <div style={{ height: 1, background: "#F1ECE3" }}/>
                <button role="menuitem" onClick={() => { close(); onSignOut(); }}
                  style={{ ...itemBase, color: "#dc2626" }}
                  onMouseEnter={e => e.currentTarget.style.background = "#FEF2F2"}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                  <span style={{ display: "inline-flex" }}>{I.logout}</span>
                  Se déconnecter
                </button>
              </>
            )}
          </div>
        </>
      )}
    </>
  );
}
