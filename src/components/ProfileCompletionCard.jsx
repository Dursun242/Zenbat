import { useState } from "react";
import { brandCompleteness } from "../lib/brandCompleteness.js";

export default function ProfileCompletionCard({ brand, onOpenProfile }) {
  const [expanded, setExpanded] = useState(false);
  const { percent, level, missingCritical, missingRecommended, isCleanQuote } = brandCompleteness(brand);

  if (isCleanQuote && percent === 100) return null;

  const missing = [...missingCritical, ...missingRecommended];
  const visibleMissing = expanded ? missing : missing.slice(0, 3);
  const hasMore = missing.length > visibleMissing.length;

  return (
    <div style={{
      background: "white", borderRadius: 14, padding: 16,
      border: `1.5px solid ${missingCritical.length > 0 ? "#fed7aa" : "#e2e8f0"}`,
      marginBottom: 14, boxShadow: "0 1px 4px rgba(0,0,0,.04)"
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
        <div style={{
          width: 44, height: 44, borderRadius: 12,
          background: `${level.color}15`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 20, fontWeight: 800, color: level.color, flexShrink: 0
        }}>
          {percent}%
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", display: "flex", alignItems: "center", gap: 6 }}>
            Profil entreprise
            <span style={{
              fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 20,
              background: `${level.color}15`, color: level.color
            }}>{level.label}</span>
          </div>
          <div style={{ fontSize: 11, color: "#64748b", marginTop: 2, lineHeight: 1.4 }}>
            {missingCritical.length > 0
              ? `${missingCritical.length} info${missingCritical.length > 1 ? "s" : ""} critique${missingCritical.length > 1 ? "s" : ""} manquante${missingCritical.length > 1 ? "s" : ""} pour des devis conformes`
              : "Ajoutez les dernières infos pour un rendu 100% pro"}
          </div>
        </div>
      </div>

      {/* Barre de progression */}
      <div style={{ height: 6, background: "#f1f5f9", borderRadius: 3, overflow: "hidden", marginBottom: 12 }}>
        <div style={{
          height: "100%", width: `${percent}%`,
          background: level.color, borderRadius: 3, transition: "width .4s ease"
        }}/>
      </div>

      {/* Liste des champs manquants */}
      <div style={{ marginBottom: 12 }}>
        {visibleMissing.map((f, i) => {
          const isCritical = missingCritical.includes(f);
          return (
            <div key={f.key} style={{
              display: "flex", alignItems: "flex-start", gap: 8,
              padding: "6px 0", borderTop: i === 0 ? "none" : "1px solid #f8fafc"
            }}>
              <span style={{
                color: isCritical ? "#f97316" : "#94a3b8",
                fontSize: 14, fontWeight: 700, flexShrink: 0, marginTop: 1
              }}>{isCritical ? "!" : "•"}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#0f172a" }}>{f.label}</div>
                <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 1, lineHeight: 1.4 }}>{f.impact}</div>
              </div>
            </div>
          );
        })}
        {hasMore && (
          <button onClick={() => setExpanded(true)}
            style={{
              background: "none", border: "none", color: "#64748b",
              fontSize: 11, fontWeight: 600, cursor: "pointer",
              padding: "6px 0 0", textDecoration: "underline"
            }}>
            Voir {missing.length - visibleMissing.length} autre{missing.length - visibleMissing.length > 1 ? "s" : ""}
          </button>
        )}
      </div>

      <button onClick={onOpenProfile}
        style={{
          width: "100%", background: "#0f172a", color: "white",
          border: "none", borderRadius: 10, padding: "10px 14px",
          fontSize: 12, fontWeight: 700, cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 6
        }}>
        Compléter mon profil →
      </button>
    </div>
  );
}
