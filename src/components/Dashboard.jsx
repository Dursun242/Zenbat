import { TX } from "../lib/constants.js";
import { fmt } from "../lib/utils.js";
import { I } from "./ui/icons.jsx";
import Badge from "./ui/Badge.jsx";
import ProfileCompletionCard from "./ProfileCompletionCard.jsx";
import PWAInstallBanner from "./PWAInstallBanner.jsx";

export default function Dashboard({ stats, devis, clients, goDevis, setTab, brand, onOpenProfile, onOpenPWAInstall }) {
  const ac = brand.color || "#22c55e";

  return (
    <div className="dash-wrapper fu" style={{ padding: 18 }}>
      <div style={{ marginBottom: 18 }}>
        <h1 style={{ fontSize: 21, fontWeight: 700, color: "#0f172a" }}>
          {brand.firstName?.trim()
            ? "Bonjour, " + brand.firstName.trim()
            : brand.companyName ? "Bonjour, " + brand.companyName.split(" ")[0] : "Tableau de bord"}
        </h1>
        <p style={{ color: "#94a3b8", fontSize: 12, marginTop: 2 }}>
          {new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
        </p>
      </div>

      <PWAInstallBanner onOpenInstall={onOpenPWAInstall}/>

      {/* KPIs — 2 colonnes sur mobile, 4 sur desktop */}
      <div className="kpi-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 18 }}>
        {[
          { l: TX.clients,    v: stats.clients,        dot: "#3b82f6" },
          { l: TX.inProgress, v: stats.enCours,         dot: "#f59e0b" },
          { l: TX.accepted,   v: stats.acceptes,        dot: ac       },
          { l: TX.signedCA,   v: fmt(stats.ca),         dot: "#f97316" },
        ].map(({ l, v, dot }) => (
          <div key={l} style={{ background: "white", borderRadius: 14, padding: 16, border: "1px solid #f1f5f9", boxShadow: "0 1px 4px rgba(0,0,0,.04)" }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: dot, marginBottom: 10 }}/>
            <div style={{ fontSize: 20, fontWeight: 700, color: "#0f172a" }}>{v}</div>
            <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>{l}</div>
          </div>
        ))}
      </div>

      {/* Profil entreprise + Devis récents — empilés sur mobile, côte à côte sur desktop */}
      <div className="dash-cols" style={{ marginBottom: 14 }}>
        <ProfileCompletionCard brand={brand} onOpenProfile={onOpenProfile}/>

        <div style={{ background: "white", borderRadius: 14, border: "1px solid #f1f5f9", overflow: "hidden" }}>
          <div style={{ padding: "12px 16px", borderBottom: "1px solid #f8fafc", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontWeight: 600, fontSize: 13, color: "#0f172a" }}>{TX.recentQuotes}</span>
            <button onClick={() => setTab("devis")} style={{ background: "none", border: "none", color: ac, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>{TX.seeAll}</button>
          </div>
          {devis.slice(0, 3).map(d => {
            const cl = clients.find(c => c.id === d.client_id);
            return (
              <div key={d.id} onClick={() => goDevis(d.id)}
                style={{ padding: "11px 16px", borderBottom: "1px solid #f8fafc", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}
                onMouseOver={e => e.currentTarget.style.background = "#fafafa"}
                onMouseOut={e => e.currentTarget.style.background = "white"}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a" }}>{d.objet}</div>
                  <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>
                    {cl?.raison_sociale || `${cl?.prenom || ""} ${cl?.nom || ""}`.trim() || "—"}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>{fmt(d.montant_ht)}</div>
                  <div style={{ marginTop: 4 }}><Badge s={d.statut}/></div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Bouton Agent IA */}
      <div onClick={() => setTab("agent")}
        style={{ background: `linear-gradient(135deg,${ac}dd,${ac})`, borderRadius: 14, padding: 16, cursor: "pointer", display: "flex", alignItems: "center", gap: 12, boxShadow: `0 4px 14px ${ac}44` }}>
        <div style={{ width: 38, height: 38, borderRadius: 10, background: "rgba(255,255,255,.2)", display: "flex", alignItems: "center", justifyContent: "center", color: "white" }}>
          {I.spark}
        </div>
        <div>
          <div style={{ color: "white", fontWeight: 700, fontSize: 13 }}>{TX.aiAgent}</div>
          <div style={{ color: "rgba(255,255,255,.75)", fontSize: 11, marginTop: 2 }}>{TX.aiDesc}</div>
        </div>
        <div style={{ color: "rgba(255,255,255,.5)", marginLeft: "auto", fontSize: 20 }}>›</div>
      </div>
    </div>
  );
}
