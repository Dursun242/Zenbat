// Menu hamburger affiché dans le header. Forme : side drawer qui slide
// depuis la droite, full hauteur. Regroupe la navigation principale
// (Accueil, Clients, Devis, Factures, Agent IA) + l'accès profil,
// abonnement, support, admin, déconnexion.
//
// Pourquoi un side drawer plutôt qu'une bottom nav fixée :
// - Sur iPhone PWA standalone, position:fixed bottom:0 souffre d'un bug
//   où l'élément ne s'ancre pas au visual viewport bottom (grosse bande
//   noire persistante en dessous). Le side drawer n'est pas concerné car
//   il s'ancre top:0 right:0 bottom:0, qu'iOS gère correctement.
// - Daily UX : le pouce reste à portée du bouton hamburger top-right,
//   un tap ouvre le drawer, un tap sélectionne la section, c'est 2 taps
//   max pour aller n'importe où — comparable à une bottom nav (1 tap)
//   mais sans le bug bottom.

import { useEffect, useState } from "react";
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
  billingCycle,
  weekCount = 0,
  weekLimit = 5,
  navItems = [],
  activeNav,
  onSelectNav,
  onOpenAdmin,
  onOpenProfile,
  onOpenSubscription,
  onOpenPaywall,
  onOpenSupport,
  onOpenComptable,
  onSignOut,
}) {
  const [open,         setOpen]         = useState(false);
  const [tokenData,    setTokenData]    = useState(null);
  const [tokenLoading, setTokenLoading] = useState(false);

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

  const isPro          = effectivePlan === "pro";
  const isBiannual     = isPro && billingCycle === "biannual";
  const quotaReached   = !isPro && weekCount >= weekLimit;
  const quotaWarning   = !isPro && weekCount >= weekLimit - 1 && weekCount < weekLimit;
  const showNavBadge   = quotaReached || quotaWarning;

  const settingsItem = {
    display: "flex", alignItems: "center", gap: 10,
    width: "100%", padding: "12px 16px",
    background: "transparent", border: "none",
    color: "#1A1612", fontSize: 14, fontWeight: 500,
    cursor: "pointer", textAlign: "left",
  };

  return (
    <>
      <style>{`
        @keyframes hm-fade  { from { opacity: 0; } to { opacity: 1; } }
        @keyframes hm-slide { from { transform: translateX(100%); } to { transform: translateX(0); } }
        .hm-drawer-item { -webkit-tap-highlight-color: transparent; transition: background .12s ease; }
        .hm-drawer-item:active { background: rgba(34,197,94,.10) !important; }
        .hm-settings-item { -webkit-tap-highlight-color: transparent; transition: background .12s ease; }
        .hm-settings-item:active { background: #FAF7F2 !important; }
      `}</style>

      <button
        onClick={() => setOpen(o => !o)}
        title="Menu"
        aria-label="Ouvrir le menu"
        aria-expanded={open}
        style={{
          position: "relative",
          background: "#2A231C", border: "1px solid #3D3028", borderRadius: 8,
          padding: "6px 9px", display: "flex", alignItems: "center",
          color: "#E8E2D8", cursor: "pointer",
        }}>
        {I.menu}
        {showNavBadge && (
          <span style={{
            position: "absolute", top: -3, right: -3,
            width: 8, height: 8, borderRadius: "50%",
            background: quotaReached ? "#ef4444" : "#f97316",
            border: "2px solid #1A1612",
          }}/>
        )}
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div
            onClick={close}
            style={{
              position: "fixed", inset: 0,
              background: "rgba(0,0,0,.45)", zIndex: 90,
              animation: "hm-fade .18s ease both",
            }}
          />
          {/* Panneau drawer */}
          <div
            role="menu"
            aria-label="Menu principal"
            style={{
              position: "fixed",
              top: 0, right: 0, bottom: 0,
              width: "min(85vw, 340px)",
              background: "#fff",
              boxShadow: "-10px 0 30px rgba(0,0,0,.18)",
              zIndex: 100,
              display: "flex", flexDirection: "column",
              animation: "hm-slide .22s cubic-bezier(.34,1.3,.64,1) both",
              paddingTop: "calc(14px + env(safe-area-inset-top))",
              paddingBottom: "calc(14px + env(safe-area-inset-bottom))",
              overflowY: "auto",
            }}>

            {/* Header du drawer : email + bouton fermer */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 16px 12px", borderBottom: "1px solid #F1ECE3", marginBottom: 8 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                {user?.email && (
                  <div style={{ fontSize: 12, color: "#6B6358", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {user.email}
                  </div>
                )}
                <button
                  onClick={() => { close(); isPro ? onOpenSubscription() : onOpenPaywall(); }}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 6, marginTop: 6,
                    background: isPro ? "rgba(34,197,94,.12)" : (quotaReached ? "rgba(239,68,68,.12)" : (quotaWarning ? "rgba(249,115,22,.12)" : "#F5F0E8")),
                    color:      isPro ? "#16a34a"            : (quotaReached ? "#b91c1c"             : (quotaWarning ? "#c2410c"             : "#6B6358")),
                    border:     `1px solid ${isPro ? "rgba(34,197,94,.25)" : (quotaReached ? "rgba(239,68,68,.25)" : (quotaWarning ? "rgba(249,115,22,.25)" : "#E8E2D8"))}`,
                    fontSize: 11, fontWeight: 700,
                    padding: "4px 10px", borderRadius: 20,
                    cursor: "pointer",
                  }}>
                  {isPro
                    ? <>{I.crown} {isBiannual ? "PRO · 6 mois · gérer" : "PRO · gérer"}</>
                    : quotaReached
                      ? <>{weekCount}/{weekLimit} · passer Pro</>
                      : <>Freemium · {weekCount}/{weekLimit} · passer Pro</>}
                </button>
              </div>
              <button onClick={close} aria-label="Fermer"
                style={{ background: "none", border: "none", color: "#6B6358", padding: 6, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", marginLeft: 8, flexShrink: 0 }}>
                <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>

            {/* Navigation principale */}
            {navItems.length > 0 && onSelectNav && (
              <div style={{ padding: "4px 8px" }}>
                {navItems.map(({ id, label, icon }) => {
                  const active = activeNav === id;
                  const isAgent = id === "agent";
                  const itemBadge = isAgent && quotaReached;
                  return (
                    <button
                      key={id}
                      role="menuitem"
                      className="hm-drawer-item"
                      onClick={() => { close(); onSelectNav(id); }}
                      style={{
                        display: "flex", alignItems: "center", gap: 14,
                        width: "100%",
                        padding: "13px 14px",
                        border: "none",
                        background: active ? "rgba(34,197,94,.10)" : "transparent",
                        color: active ? "#22c55e" : "#3D3028",
                        borderRadius: 10,
                        cursor: "pointer",
                        fontSize: 15,
                        fontWeight: active ? 700 : 500,
                        textAlign: "left",
                        marginBottom: 2,
                      }}>
                      <div style={{ width: 22, height: 22, display: "flex", alignItems: "center", justifyContent: "center", color: active ? "#22c55e" : "#6B6358" }}>
                        {icon}
                      </div>
                      <span style={{ flex: 1 }}>{label}</span>
                      {itemBadge && (
                        <span style={{ background: "#ef4444", color: "white", fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 10 }}>Quota</span>
                      )}
                      {active && (
                        <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><polyline points="20,6 9,17 4,12"/></svg>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Séparateur entre nav et settings */}
            {navItems.length > 0 && <div style={{ height: 1, background: "#F1ECE3", margin: "10px 12px 4px" }}/>}

            {/* Section profil / réglages */}
            <button role="menuitem" className="hm-settings-item" onClick={() => { close(); onOpenProfile(); }} style={settingsItem}>
              <span style={{ color: "#6B6358", display: "inline-flex" }}>{I.paint}</span>
              Mon profil
            </button>

            {onOpenComptable && (
              <button role="menuitem" className="hm-settings-item" onClick={() => { close(); onOpenComptable(); }} style={settingsItem}>
                <span style={{ color: "#C97B5C", display: "inline-flex" }}>{I.file}</span>
                Envoyer au comptable
              </button>
            )}

            {onOpenSupport && (
              <button role="menuitem" className="hm-settings-item" onClick={() => { close(); onOpenSupport(); }} style={settingsItem}>
                <span style={{ color: "#22c55e", display: "inline-flex" }}>{I.chat}</span>
                Support
              </button>
            )}

            {isAdmin && (
              <>
                <div style={{ padding: "10px 16px 8px", borderTop: "1px solid #F1ECE3", marginTop: 6 }}>
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
                <button role="menuitem" className="hm-settings-item" onClick={() => { close(); onOpenAdmin(); }} style={settingsItem}>
                  <span style={{ color: "#f59e0b", display: "inline-flex" }}>{I.cog}</span>
                  Panel admin
                </button>
              </>
            )}

            {user && (
              <>
                <div style={{ flex: 1 }}/>
                <div style={{ height: 1, background: "#F1ECE3", margin: "4px 0" }}/>
                <button role="menuitem" className="hm-settings-item" onClick={() => { close(); onSignOut(); }}
                  style={{ ...settingsItem, color: "#dc2626" }}>
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
