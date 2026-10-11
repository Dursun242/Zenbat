// Menu hamburger affiché dans le header. Regroupe : statut abonnement, accès profil,
// admin (si admin), déconnexion. Évite l'encombrement du bandeau supérieur sur mobile.
//
// Implémentation : panneau en position:fixed (le header n'a pas de transform parent —
// voir CLAUDE.md sur les containing blocks). Backdrop transparent qui capture
// le clic pour fermer.

import { useEffect, useRef, useState } from "react";
import { I } from "../ui/icons.jsx";
import { getToken } from "../../lib/getToken.js";
import { ZB } from "../../lib/theme.js";

function fmtUsd(n) {
  if (!n) return "$0.000";
  if (n < 0.01) return `$${n.toFixed(4)}`;
  if (n < 1)    return `$${n.toFixed(3)}`;
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(n);
}

function TokenRow({ label, cost, calls }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "3px 0" }}>
      <span style={{ fontSize: 13, color: ZB.ink2 }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 700, color: ZB.ink, fontVariantNumeric: "tabular-nums" }}>
        {fmtUsd(cost)}
        <span style={{ fontWeight: 400, color: ZB.ink3, marginLeft: 4 }}>{calls > 0 ? `·${calls}` : ""}</span>
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
  supportUnread = false,
  onOpenAdmin,
  onOpenProfile,
  onOpenSubscription,
  onOpenPaywall,
  onOpenSupport,
  onOpenComptable,
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

  const isPro          = effectivePlan === "pro";
  const isBiannual     = isPro && billingCycle === "biannual";
  const quotaReached   = !isPro && weekCount >= weekLimit;
  const quotaWarning   = !isPro && weekCount >= weekLimit - 1 && weekCount < weekLimit;

  const itemBase = {
    display: "flex", alignItems: "center", gap: 10,
    width: "100%", minHeight: 44, padding: "10px 14px",
    background: "transparent", border: "none",
    color: ZB.ink, fontSize: 15, fontWeight: 500,
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
          width: 44, height: 44, justifyContent: "center",
          background: ZB.sheet, border: `1px solid ${ZB.rule}`, borderRadius: 8,
          display: "flex", alignItems: "center",
          color: ZB.ink, cursor: "pointer",
        }}>
        {I.menu}
        {(quotaReached || quotaWarning || supportUnread) && (
          <span style={{
            position: "absolute", top: -3, right: -3,
            width: 10, height: 10, borderRadius: "50%",
            background: quotaReached ? ZB.danger
                      : quotaWarning ? ZB.warn
                      :                ZB.accent,
            border: `2px solid ${ZB.paper}`,
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
              top: "calc(60px + env(safe-area-inset-top))",
              right: "calc(14px + env(safe-area-inset-right))",
              width: 260, maxWidth: "calc(100vw - 28px)",
              background: ZB.sheet,
              border: `1px solid ${ZB.rule}`,
              borderRadius: 10,
              boxShadow: "0 10px 30px rgba(26,22,18,.16)",
              zIndex: 100,
              overflow: "hidden",
              animation: "popIn .18s ease both",
            }}>
            {/* Identité + statut abonnement */}
            <div style={{ padding: "14px 14px 12px", borderBottom: `1px solid ${ZB.ruleSoft}` }}>
              {user?.email && (
                <div style={{ fontSize: 13, color: ZB.ink2, marginBottom: 8, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {user.email}
                </div>
              )}
              <div style={{ fontSize: 13, color: isPro ? ZB.stamp : quotaReached ? ZB.danger : ZB.ink2, fontWeight: 600 }}>
                {isPro ? (isBiannual ? "Abonnement Pro · 6 mois" : "Abonnement Pro")
                  : `Gratuit · ${weekCount} devis sur ${weekLimit} cette semaine`}
              </div>
            </div>

            <button role="menuitem" onClick={() => { close(); isPro ? onOpenSubscription() : onOpenPaywall(); }} style={itemBase}
              onMouseEnter={e => e.currentTarget.style.background = ZB.paper}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
              <span style={{ color: ZB.ink2, display: "inline-flex", width: 22, justifyContent: "center", flexShrink: 0 }}>{I.crown}</span>
              {isPro ? "Gérer mon abonnement" : "Passer en Pro"}
            </button>

            <button role="menuitem" onClick={() => { close(); onOpenProfile(); }} style={itemBase}
              onMouseEnter={e => e.currentTarget.style.background = ZB.paper}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
              <span style={{ color: ZB.ink2, display: "inline-flex", width: 22, justifyContent: "center", flexShrink: 0 }}>{I.user}</span>
              Mon profil
            </button>

            {onOpenComptable && (
              <button role="menuitem" onClick={() => { close(); onOpenComptable(); }} style={itemBase}
                onMouseEnter={e => e.currentTarget.style.background = ZB.paper}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                <span style={{ color: ZB.ink2, display: "inline-flex", width: 22, justifyContent: "center", flexShrink: 0 }}>{I.file}</span>
                Envoyer au comptable
              </button>
            )}

            {onOpenSupport && (
              <button role="menuitem" onClick={() => { close(); onOpenSupport(); }} style={itemBase}
                onMouseEnter={e => e.currentTarget.style.background = ZB.paper}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                <span style={{ color: ZB.ink2, display: "inline-flex", width: 22, justifyContent: "center", flexShrink: 0 }}>{I.chat}</span>
                Support
                {supportUnread && (
                  <span aria-label="Nouveau message" style={{
                    marginLeft: "auto",
                    width: 8, height: 8, borderRadius: "50%",
                    background: ZB.accent,
                  }}/>
                )}
              </button>
            )}

            {isAdmin && (
              <>
                <div style={{ padding: "10px 14px 8px", borderTop: `1px solid ${ZB.ruleSoft}` }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: ZB.ink2, marginBottom: 6, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    Coûts IA
                    <button
                      onClick={() => { setTokenData(null); setTokenLoading(true); getToken().then(tok => fetch("/api/admin-stats?type=tokens", { headers: { Authorization: `Bearer ${tok}` } }).then(r => r.json()).then(d => { if (d.total) setTokenData(d); }).catch(() => {}).finally(() => setTokenLoading(false))); }}
                      aria-label="Actualiser les coûts IA"
                      style={{ background: "none", border: "none", color: ZB.ink2, fontSize: 13, fontWeight: 600, cursor: "pointer", padding: "4px 0", fontFamily: "inherit" }}>Actualiser</button>
                  </div>
                  {tokenLoading && <div style={{ fontSize: 13, color: ZB.ink3 }}>Chargement…</div>}
                  {!tokenLoading && !tokenData && <div style={{ fontSize: 13, color: ZB.ink3 }}>Aucune donnée</div>}
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
                  onMouseEnter={e => e.currentTarget.style.background = ZB.paper}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                  <span style={{ color: ZB.ink2, display: "inline-flex", width: 22, justifyContent: "center", flexShrink: 0 }}>{I.cog}</span>
                  Panel admin
                </button>
                <a href="/crm" role="menuitem" style={{ ...itemBase, textDecoration: 'none', color: 'inherit', display: 'flex', alignItems: 'center', gap: 10 }}
                  onMouseEnter={e => e.currentTarget.style.background = ZB.paper}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                  <span style={{ color: ZB.ink2, display: "inline-flex", width: 22, justifyContent: "center", flexShrink: 0 }}>{I.users}</span>
                  CRM Prospection
                </a>
              </>
            )}

            {user && (
              <>
                <div style={{ height: 1, background: ZB.ruleSoft }}/>
                <button role="menuitem" onClick={() => { close(); onSignOut(); }}
                  style={{ ...itemBase, color: ZB.danger }}
                  onMouseEnter={e => e.currentTarget.style.background = ZB.dangerSoft}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                  <span style={{ display: "inline-flex", width: 22, justifyContent: "center", flexShrink: 0 }}>{I.logout}</span>
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
