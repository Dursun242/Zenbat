import { useState, useEffect, useMemo, useRef } from "react";
import { useModalGuard } from "../../hooks/useModalGuard.js";
import { useDebouncedValue } from "../../hooks/useDebouncedValue.js";
import { ZB } from "../../lib/theme.js";
import { uid } from "../../lib/utils.js";

const CSS = `
  .zb-picker input:focus { border-color: ${ZB.accent} !important; }
  .zb-picker input::placeholder { color: ${ZB.ink3}; opacity: 1; }
  .zb-picker button:focus-visible { outline: 2px solid ${ZB.accent}; outline-offset: -2px; }
  @media (hover: hover) { .zb-picker-row:not([aria-current="true"]):hover { background: ${ZB.paper2} !important; } }
`;

const CheckIcon = <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>;
const PlusIcon  = <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>;

function clientLabel(c) {
  return c?.raison_sociale || `${c?.prenom || ""} ${c?.nom || ""}`.trim() || "—";
}

const EMPTY_NEW = { nom: "", email: "", telephone: "" };

const NEW_FIELDS = [
  { k: "nom",       label: "Nom du client",                   type: "text",  auto: "name"  },
  { k: "email",     label: "Email (utile pour la signature)", type: "email", auto: "email" },
  { k: "telephone", label: "Téléphone",                       type: "tel",   auto: "tel"   },
];

// Props facultatives (utilisées par l'Agent IA) :
// - title / hint : titre et phrase d'aide de la fenêtre ;
// - noClientLabel : libellé de l'option « sans client » ;
// - showCurrent=false : rien n'est marqué « actuel » (choix du client d'un
//   devis pas encore enregistré) ;
// - onCreate(client) : affiche « Nouveau client » et sa création rapide
//   (nom, email, téléphone) ; une fois enregistré, le client est choisi.
export default function ClientPickerModal({
  clients = [], current, onSelect, onClose, requireEmail = false,
  title = "Choisir un client", hint, noClientLabel = "Sans client",
  showCurrent = true, onCreate, createLabel = "Créer et choisir",
}) {
  const [q, setQ] = useState("");
  const debouncedQ = useDebouncedValue(q, 180);
  const inputRef  = useRef(null);
  const [creating,  setCreating]  = useState(false);
  const [newC,      setNewC]      = useState(EMPTY_NEW);
  const [busy,      setBusy]      = useState(false);
  const [createErr, setCreateErr] = useState("");

  const backToList = () => { setCreating(false); setNewC(EMPTY_NEW); setCreateErr(""); };

  // Échap géré par useModalGuard (seule la fenêtre la plus haute réagit).
  // Pendant la création rapide, Échap revient d'abord à la liste.
  useModalGuard(true, () => { if (creating) backToList(); else onClose(); });
  useEffect(() => { if (!creating) inputRef.current?.focus(); }, [creating]);

  // Filtre memoizé sur la valeur debounced : la liste ne se recalcule pas
  // à chaque frappe (visible côté UX comme un lag sur les comptes ayant
  // beaucoup de clients).
  const filtered = useMemo(() => {
    if (debouncedQ.trim().length === 0) return clients;
    const s = debouncedQ.toLowerCase();
    return clients.filter(c =>
      clientLabel(c).toLowerCase().includes(s)
      || (c.email      || "").toLowerCase().includes(s)
      || (c.telephone  || "").toLowerCase().includes(s)
      || (c.ville      || "").toLowerCase().includes(s)
    );
  }, [clients, debouncedQ]);

  const noneCurrent = showCurrent && !current;
  const canCreate   = newC.nom.trim().length > 0 && !busy;

  // Création rapide : enregistre le client puis le choisit. Le bouton est
  // désactivé pendant l'enregistrement (pas de double création).
  const createAndPick = async () => {
    const nom = newC.nom.trim();
    if (!nom || busy) return;
    const c = {
      id: uid(), nom, email: newC.email.trim(), telephone: newC.telephone.trim(),
      type: "particulier", ville: "", adresse: "", siret: "", notes: "",
    };
    setBusy(true); setCreateErr("");
    try {
      await onCreate(c);
    } catch {
      setBusy(false);
      setCreateErr("Le client n'a pas pu être créé. Réessaie.");
      return;
    }
    onSelect(c); onClose();
  };

  const rowStyle = {
    width: "100%", minHeight: 56, padding: "10px 18px", border: "none", borderBottom: `1px solid ${ZB.ruleSoft}`,
    cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", gap: 12, fontFamily: "inherit", color: ZB.ink,
  };
  const fieldStyle = {
    width: "100%", minHeight: 48, boxSizing: "border-box", background: ZB.sheet, border: `1px solid ${ZB.rule}`,
    borderRadius: 8, padding: "10px 12px", fontSize: 16, fontWeight: 500, outline: "none", fontFamily: "inherit", color: ZB.ink,
  };

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(26,22,18,.55)", zIndex: 300, display: "flex", alignItems: "flex-end", justifyContent: "center", fontFamily: ZB.font, color: ZB.ink }}
      onClick={e => { if (e.target === e.currentTarget && !creating) onClose(); }}>
      <style>{CSS}</style>
      <div role="dialog" aria-modal="true" aria-labelledby="client-picker-title" className="zb-picker"
        style={{ background: ZB.paper, borderRadius: "10px 10px 0 0", width: "100%", maxWidth: 480, maxHeight: "80vh", display: "flex", flexDirection: "column" }}>
        {/* Header */}
        <div style={{ padding: "6px 6px 12px 18px", borderBottom: `1px solid ${ZB.rule}`, flexShrink: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <h2 id="client-picker-title" style={{ margin: 0, fontWeight: 700, fontSize: 19, color: ZB.ink }}>{creating ? "Nouveau client" : title}</h2>
            <button type="button" onClick={onClose} aria-label="Fermer"
              style={{ width: 44, height: 44, display: "grid", placeItems: "center", background: "none", border: "none", color: ZB.ink2, cursor: "pointer" }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>
            </button>
          </div>
          {hint && !creating && <p style={{ margin: "0 12px 10px 0", fontSize: 14, color: ZB.ink2, lineHeight: 1.4 }}>{hint}</p>}
          {!creating && (
            <div style={{ paddingRight: 12 }}>
              <input
                ref={inputRef}
                value={q}
                onChange={e => setQ(e.target.value)}
                placeholder="Rechercher…"
                aria-label="Rechercher un client"
                style={{ ...fieldStyle, minHeight: 44 }}
              />
            </div>
          )}
        </div>

        {creating ? (
          <form
            onSubmit={e => { e.preventDefault(); createAndPick(); }}
            style={{ overflowY: "auto", flex: 1, background: ZB.sheet, padding: "14px 18px calc(18px + env(safe-area-inset-bottom, 0px))", display: "flex", flexDirection: "column", gap: 12 }}>
            {NEW_FIELDS.map((f, i) => (
              <label key={f.k} style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13, fontWeight: 600, color: ZB.ink2 }}>
                {f.label}
                <input
                  type={f.type}
                  autoComplete={f.auto}
                  autoFocus={i === 0}
                  required={f.k === "nom"}
                  value={newC[f.k]}
                  onChange={e => setNewC(prev => ({ ...prev, [f.k]: e.target.value }))}
                  style={fieldStyle}
                />
              </label>
            ))}
            {createErr && <p role="alert" style={{ margin: 0, fontSize: 14, color: ZB.danger }}>{createErr}</p>}
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 4 }}>
              <button type="button" onClick={backToList}
                style={{ minHeight: 48, padding: "0 14px", background: "none", border: "none", color: ZB.ink2, fontFamily: "inherit", fontSize: 15, fontWeight: 600, cursor: "pointer" }}>
                Retour
              </button>
              <button type="submit" disabled={!canCreate}
                style={{ flex: 1, minHeight: 52, background: canCreate ? ZB.accent : ZB.rule, color: canCreate ? ZB.sheet : ZB.ink2, border: "none", borderRadius: 10, fontFamily: "inherit", fontSize: 16, fontWeight: 700, cursor: canCreate ? "pointer" : "not-allowed" }}>
                {busy ? "Enregistrement…" : createLabel}
              </button>
            </div>
          </form>
        ) : (
          <div style={{ overflowY: "auto", flex: 1, background: ZB.sheet }}>
            {requireEmail && (
              <div style={{ margin: "12px 14px 4px", background: ZB.paper2, border: `1px solid ${ZB.rule}`, borderRadius: 8, padding: "10px 12px" }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: ZB.ink, marginBottom: 2 }}>Email requis</div>
                <div style={{ fontSize: 14, color: ZB.ink2, lineHeight: 1.4 }}>Choisis un client avec une adresse email pour la signature électronique.</div>
              </div>
            )}
            {/* Création rapide (si le parent sait enregistrer un client) */}
            {onCreate && (
              <button
                type="button"
                className="zb-picker-row"
                onClick={() => { setNewC({ ...EMPTY_NEW, nom: q.trim() }); setCreating(true); }}
                style={{ ...rowStyle, background: "none" }}>
                <span style={{ color: ZB.accent, display: "flex" }}>{PlusIcon}</span>
                <span style={{ flex: 1, fontSize: 15, fontWeight: 600, color: ZB.accent }}>Nouveau client</span>
              </button>
            )}
            {/* Option "sans client" */}
            <button
              type="button"
              className="zb-picker-row"
              aria-current={noneCurrent ? "true" : undefined}
              onClick={() => { onSelect(null); onClose(); }}
              style={{ ...rowStyle, background: noneCurrent ? ZB.accentSoft : "none" }}>
              <span style={{ flex: 1, fontSize: 15, color: ZB.ink2, fontStyle: "italic" }}>{noClientLabel}</span>
              {noneCurrent && <span style={{ color: ZB.accent, display: "flex" }}>{CheckIcon}</span>}
            </button>

            {filtered.length === 0 && debouncedQ.trim() && (
              <div style={{ padding: "20px 18px", fontSize: 15, color: ZB.ink2, textAlign: "center" }}>
                Aucun client trouvé pour « {debouncedQ} »
              </div>
            )}

            {filtered.map(c => {
              const isCurrent  = showCurrent && c.id === current?.id;
              const label      = clientLabel(c);
              const sub        = c.email || c.telephone || c.ville || "";
              const noEmail    = requireEmail && !c.email;
              return (
                <button key={c.id}
                  type="button"
                  className="zb-picker-row"
                  aria-current={isCurrent ? "true" : undefined}
                  onClick={() => { onSelect(c); onClose(); }}
                  style={{ ...rowStyle, background: isCurrent ? ZB.accentSoft : "none", opacity: noEmail ? 0.65 : 1 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 600, color: ZB.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</div>
                    {sub && <div style={{ fontSize: 13, color: ZB.ink2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sub}</div>}
                    {noEmail && <span style={{ display: "inline-block", fontSize: 12, fontWeight: 600, color: ZB.ink2, border: `1px solid ${ZB.rule}`, borderRadius: 3, padding: "0 5px", marginTop: 4 }}>sans email</span>}
                  </div>
                  {isCurrent && <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 13, color: ZB.accent, fontWeight: 700, flexShrink: 0 }}>{CheckIcon}actuel</span>}
                </button>
              );
            })}

            {clients.length === 0 && !debouncedQ.trim() && (
              <div style={{ padding: "20px 18px", fontSize: 15, color: ZB.ink2, textAlign: "center" }}>
                Aucun client pour l'instant.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
