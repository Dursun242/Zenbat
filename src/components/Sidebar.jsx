import Logo from "./ui/Logo.jsx";
import { I } from "./ui/icons.jsx";

const NAV = [
  { id: "dashboard", label: "Accueil",  icon: I.trend },
  { id: "clients",   label: "Clients",  icon: I.users },
  { id: "devis",     label: "Devis",    icon: I.file  },
  { id: "factures",  label: "Factures", icon: I.file  },
  { id: "agent",     label: "Agent IA", icon: I.spark },
];

export default function Sidebar({ tab, setTab, isAdmin, plan, daysLeft, onAdmin, onProfile, onSignOut }) {
  const activeNav = NAV.find(n => tab.startsWith(n.id))?.id || "dashboard";

  return (
    <aside className="app-sidebar" style={{
      display: "none",
      width: 240,
      flexShrink: 0,
      background: "#0f172a",
      flexDirection: "column",
      borderRight: "1px solid rgba(255,255,255,.06)",
      overflow: "hidden",
    }}>
      {/* Logo */}
      <div style={{ padding: "22px 20px", borderBottom: "1px solid rgba(255,255,255,.06)" }}>
        <Logo size={22} white />
      </div>

      {/* Navigation */}
      <div style={{ flex: 1, padding: "10px", display: "flex", flexDirection: "column", gap: 2, overflowY: "auto" }}>
        {NAV.map(({ id, label, icon }) => {
          const active = activeNav === id;
          return (
            <button key={id} onClick={() => setTab(id)}
              style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "10px 12px", borderRadius: 8, width: "100%",
                background: active ? "rgba(34,197,94,.1)" : "transparent",
                border: "none",
                outline: active ? "1px solid rgba(34,197,94,.2)" : "1px solid transparent",
                color: active ? "#22c55e" : "#94a3b8",
                cursor: "pointer", textAlign: "left",
                fontSize: 13, fontWeight: active ? 600 : 400,
              }}>
              <span style={{ position: "relative", display: "flex" }}>
                {icon}
                {id === "agent" && plan === "free" && daysLeft <= 7 && (
                  <span style={{ position: "absolute", top: -4, right: -10, background: daysLeft === 0 ? "#ef4444" : "#f97316", color: "white", fontSize: 8, fontWeight: 700, padding: "0 4px", height: 14, minWidth: 14, borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {daysLeft === 0 ? "!" : `${daysLeft}j`}
                  </span>
                )}
              </span>
              {label}
            </button>
          );
        })}
      </div>

      {/* Boutons bas */}
      <div style={{ padding: "10px", borderTop: "1px solid rgba(255,255,255,.06)", display: "flex", flexDirection: "column", gap: 2 }}>
        {isAdmin && (
          <button onClick={onAdmin}
            style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 8, background: "transparent", border: "none", color: "#f59e0b", fontSize: 12, fontWeight: 600, cursor: "pointer", width: "100%" }}>
            <span>⚙</span> Admin
          </button>
        )}
        <button onClick={onProfile}
          style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 8, background: "transparent", border: "none", color: "#94a3b8", fontSize: 12, fontWeight: 500, cursor: "pointer", width: "100%" }}>
          {I.paint} Mon profil
        </button>
        <button onClick={onSignOut}
          style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 8, background: "transparent", border: "none", color: "#ef4444", fontSize: 12, fontWeight: 500, cursor: "pointer", width: "100%" }}>
          {I.logout} Se déconnecter
        </button>
        <div style={{ padding: "6px 12px", marginTop: 2 }}>
          {plan === "pro"
            ? <span style={{ background: "rgba(34,197,94,.15)", color: "#4ade80", fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 20, border: "1px solid rgba(34,197,94,.25)" }}>PRO</span>
            : <span style={{ background: daysLeft <= 7 ? "rgba(249,115,22,.15)" : "#1e293b", color: daysLeft <= 7 ? "#fb923c" : "#94a3b8", fontSize: 10, fontWeight: 600, padding: "3px 8px", borderRadius: 20, border: daysLeft <= 7 ? "1px solid rgba(249,115,22,.25)" : "none" }}>Essai · {daysLeft}j</span>
          }
        </div>
      </div>
    </aside>
  );
}
