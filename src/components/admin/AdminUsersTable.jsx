import { fmtEur, fmtDT, relTime, SC, SL, SORT_OPTS } from "../../lib/admin/format.js";

// Icônes SVG simples — pas de dépendance lucide-react dans le panel admin.
const SearchIcon = () => (
  <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
  </svg>
);
const ClearIcon = () => (
  <svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);
const TrashIcon = () => (
  <svg width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/>
  </svg>
);

export default function AdminUsersTable({ users, userSearch, setUserSearch, sortBy, setSortBy, currentUserId, onOpenDetail, onOpenDelete }) {
  const isSearching = userSearch.trim().length > 0;

  return (
    <div style={{ background: "white", borderRadius: 14, overflow: "hidden", marginBottom: 16, boxShadow: "0 1px 4px rgba(0,0,0,.06)" }}>

      {/* En-tête du tableau */}
      <div style={{ padding: "14px 16px 12px", borderBottom: "1px solid #F0EBE3", background: "#FFFCF7" }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 10, gap: 8 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: "#1A1612", letterSpacing: "-0.2px" }}>
            Utilisateurs
            <span style={{ fontSize: 11, color: "#9A8E82", fontWeight: 500, marginLeft: 6 }}>
              {isSearching ? `${users.length} résultat${users.length > 1 ? "s" : ""}` : users.length}
            </span>
          </div>
        </div>

        {/* Barre de recherche prominente — pleine largeur sur mobile, avec icône + clear */}
        <div style={{ position: "relative", marginBottom: 10 }}>
          <div style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#9A8E82", display: "flex", alignItems: "center", pointerEvents: "none" }}>
            <SearchIcon />
          </div>
          <input
            value={userSearch}
            onChange={e => setUserSearch(e.target.value)}
            placeholder="Nom, société, email…"
            style={{
              width: "100%",
              boxSizing: "border-box",
              border: `1px solid ${isSearching ? "#C97B5C" : "#E8E2D8"}`,
              borderRadius: 10,
              padding: "10px 36px 10px 34px",
              fontSize: 13,
              color: "#1A1612",
              background: "white",
              outline: "none",
              fontFamily: "inherit",
              transition: "border-color .15s",
            }}
            onFocus={e => { e.currentTarget.style.borderColor = "#C97B5C"; }}
            onBlur={e => { e.currentTarget.style.borderColor = isSearching ? "#C97B5C" : "#E8E2D8"; }}
          />
          {isSearching && (
            <button
              onClick={() => setUserSearch("")}
              aria-label="Effacer la recherche"
              style={{
                position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
                background: "#F0EBE3", border: "none", borderRadius: "50%",
                width: 22, height: 22, display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer", color: "#6B6358",
              }}>
              <ClearIcon />
            </button>
          )}
        </div>

        {/* Tri — label inline pour rester compact sans cramponner */}
        <select value={sortBy} onChange={e => setSortBy(e.target.value)}
          style={{ width: "100%", boxSizing: "border-box", border: "1px solid #E8E2D8", borderRadius: 10, padding: "8px 12px", fontSize: 12, color: "#3D3028", background: "white", fontFamily: "inherit", cursor: "pointer" }}>
          {SORT_OPTS.map(o => <option key={o.v} value={o.v}>{`Trier par : ${o.l}`}</option>)}
        </select>
      </div>

      {users.length === 0 && (
        <div style={{ padding: 32, textAlign: "center", color: "#9A8E82", fontSize: 12 }}>
          {isSearching ? `Aucun utilisateur ne correspond à "${userSearch}"` : "Aucun utilisateur"}
        </div>
      )}

      {users.map((u, i) => (
        <div key={u.id}
          style={{
            padding: "14px 16px",
            borderBottom: i < users.length - 1 ? "1px solid #F5F1EA" : "none",
            background: "white",
            cursor: "pointer",
            transition: "background .12s",
          }}
          onClick={(e) => { if (!e.target.closest("button")) onOpenDetail(u); }}
          onMouseOver={e => e.currentTarget.style.background = "#FFFCF7"}
          onMouseOut={e => e.currentTarget.style.background = "white"}>

          {/* Ligne 1 : nom + email + plan */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#1A1612", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", letterSpacing: "-0.2px" }}>
                {u.fullName || u.name}
              </div>
              {u.fullName && u.name && u.fullName !== u.name && (
                <div style={{ fontSize: 11, color: "#6B6358", fontWeight: 500, marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.name}</div>
              )}
              <div style={{ fontSize: 11, color: "#9A8E82", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.email}</div>
            </div>
            <span style={{ fontSize: 9, fontWeight: 700, padding: "3px 8px", borderRadius: 20, display: "inline-block", background: u.plan === "pro" ? "rgba(34,197,94,.14)" : "#F0EBE3", color: u.plan === "pro" ? "#15803d" : "#6B6358", flexShrink: 0, letterSpacing: "0.5px" }}>
              {u.plan === "pro" ? "PRO" : "FREE"}
            </span>
          </div>

          {/* Ligne 2 : 4 métriques en grille */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 6, marginBottom: 9 }}>
            {[
              { l: "CA signé",   v: fmtEur(u.caTotal),                  c: u.caTotal > 0 ? "#0ea5e9" : "#cbd5e1" },
              { l: "Devis",      v: u.devisTotal,                        c: u.devisTotal > 0 ? "#3D3028" : "#cbd5e1" },
              { l: "Taux conv.", v: u.devisTotal ? `${u.txConv}%` : "—", c: u.txConv >= 50 ? "#22c55e" : "#9A8E82" },
              { l: "IA",         v: `${u.ai_used}×`,                     c: u.ai_used > 5 ? "#7c3aed" : "#9A8E82" },
            ].map(m => (
              <div key={m.l} style={{ background: "#FAF7F2", borderRadius: 8, padding: "6px 8px", textAlign: "center" }}>
                <div style={{ fontSize: 9, color: "#9A8E82", fontWeight: 500, letterSpacing: "0.3px" }}>{m.l}</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: m.c, marginTop: 2 }}>{m.v}</div>
              </div>
            ))}
          </div>

          {/* Ligne 3 : timestamps + statuts + bouton supprimer */}
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", fontSize: 10, color: "#9A8E82" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              Inscrit <span style={{ color: "#6B6358", fontWeight: 600 }}>{fmtDT(u.joined)}</span>
              {" · "}Actif <span style={{ color: "#6B6358", fontWeight: 600 }}>{relTime(u.lastActivity || u.lastSignIn)}</span>
              {u.lastDevis && <>{" · "}Devis <span style={{ color: "#6B6358", fontWeight: 600 }}>{relTime(u.lastDevis)}</span></>}
            </div>
            {u.devisTotal > 0 && (
              <div style={{ display: "flex", gap: 3 }}>
                {Object.entries(u.byStatut).filter(([, n]) => n > 0).map(([s, n]) => (
                  <span key={s} title={`${SL[s]}: ${n}`} style={{ fontSize: 9, padding: "2px 6px", borderRadius: 10, background: `${SC[s]}22`, color: SC[s], fontWeight: 700 }}>
                    {SL[s]} {n}
                  </span>
                ))}
              </div>
            )}
            {u.id !== currentUserId && (
              <button onClick={() => onOpenDelete(u)}
                title="Supprimer définitivement ce compte"
                style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#b91c1c", borderRadius: 8, padding: "4px 10px", fontSize: 10, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                <TrashIcon />
                Supprimer
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
