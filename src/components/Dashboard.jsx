// Accueil (système « Bordereau ») : ce qu'il y a à faire maintenant, puis
// l'état des montants en cours. Le nouveau devis se lance depuis le disque
// « Agent IA » de la barre du bas.
import { fmt } from "../lib/utils.js";
import { ZB, NUM } from "../lib/theme.js";
import { todoItems, ledger } from "../lib/todo.js";
import PWAInstallBanner from "./PWAInstallBanner.jsx";
import { LIST_CSS, Sheet, LoadingRows, LoadErrorRow } from "./ui/Register.jsx";

const MAX_TODO = 6;

const Chevron = <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>;

function Section({ title, aside, children }) {
  return (
    <section style={{ marginTop: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, marginBottom: 8 }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: ZB.ink }}>{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

// loaded / loadError / onRetry : devis et factures chargés ? Tant que ce n'est
// pas le cas, ni « Rien en attente » ni montants à 0,00 € (ce serait faux).
export default function Dashboard({ devis = [], invoices = [], clients = [], goDevis, goInvoice, setTab, brand = {}, onOpenProfile, onOpenPWAInstall, loaded = true, loadError = null, onRetry }) {
  const firstName = brand.firstName?.trim() || brand.companyName?.trim().split(" ")[0];
  const todo = todoItems({ devis, invoices, clients, brand });
  const money = ledger({ devis, invoices });
  const open = item => {
    if (item.kind === "devis") goDevis(item.id);
    else if (item.kind === "facture") goInvoice ? goInvoice(item.id) : setTab("factures");
    else onOpenProfile?.();
  };

  return (
    <div className="zb-list" style={{ maxWidth: 960, margin: "0 auto", padding: "18px 12px 28px", fontFamily: ZB.font, color: ZB.ink }}>
      <style>{LIST_CSS}</style>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 12, flexWrap: "wrap" }}>
        <div>
          <p style={{ margin: 0, fontSize: 24, fontWeight: 700, letterSpacing: "-0.01em" }}>{firstName ? `Bonjour, ${firstName}` : "Bonjour"}</p>
          <p style={{ margin: "2px 0 0", fontSize: 14, color: ZB.ink2 }}>
            {new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
          </p>
        </div>
      </div>

      <div style={{ marginTop: 16 }}><PWAInstallBanner onOpenInstall={onOpenPWAInstall}/></div>

      {!loaded ? (
        <Section title="À faire">
          <Sheet>
            {loadError
              ? <LoadErrorRow message="Impossible de charger tes devis et tes factures." onRetry={onRetry}/>
              : <LoadingRows label="Chargement de ton activité…" rows={2}/>}
          </Sheet>
        </Section>
      ) : (<>
      <Section title="À faire" aside={todo.length > 0 && <span style={{ fontSize: 15, color: ZB.ink2, ...NUM }}>{todo.length}</span>}>
        <Sheet>
          {todo.length === 0 ? (
            <p style={{ margin: 0, padding: "20px 16px", fontSize: 15, color: ZB.ink2, lineHeight: 1.45 }}>
              Rien en attente. {devis.length === 0 ? "Dicte ton premier devis : il s'écrit pendant que tu parles." : "Tout est à jour."}
            </p>
          ) : todo.slice(0, MAX_TODO).map((it, i, arr) => (
            <button key={it.key} type="button" className="zb-row" onClick={() => open(it)}
              style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", minHeight: 64, padding: "10px 12px 10px 16px",
                background: "none", border: "none", borderBottom: i < arr.length - 1 ? `1px solid ${ZB.ruleSoft}` : "none",
                textAlign: "left", fontFamily: "inherit", color: ZB.ink, cursor: "pointer" }}>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "block", fontSize: 15, fontWeight: 600 }}>{it.title}</span>
                <span style={{ fontSize: 13, color: ZB.ink2, marginTop: 2, lineHeight: 1.4, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{it.sub}</span>
              </span>
              {it.amount != null && (
                <span style={{ fontSize: 15, fontWeight: 700, whiteSpace: "nowrap", ...NUM }}>{fmt(it.amount)} <span style={{ fontSize: 12, fontWeight: 600, color: ZB.ink2 }}>{it.amountLabel}</span></span>
              )}
              <span style={{ color: ZB.ink3, display: "inline-flex", flexShrink: 0 }}>{Chevron}</span>
            </button>
          ))}
        </Sheet>
        {todo.length > MAX_TODO && (
          <p style={{ margin: "8px 4px 0", fontSize: 14, color: ZB.ink2 }}>
            Et {todo.length - MAX_TODO} autre{todo.length - MAX_TODO > 1 ? "s" : ""} dans les onglets Devis et Factures.
          </p>
        )}
      </Section>

      <Section title="En cours">
        <div style={{ borderTop: `2px solid ${ZB.ink}`, ...NUM }}>
          {[
            { label: "En attente de signature", value: money.enAttente, unit: "HT", tab: "devis" },
            { label: "Signé, à facturer", value: money.signe, unit: "HT", tab: "devis" },
            { label: "À encaisser", value: money.aEncaisser, unit: "TTC", tab: "factures" },
          ].map(r => (
            <button key={r.label} type="button" className="zb-row" onClick={() => setTab(r.tab)}
              style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, width: "100%", minHeight: 48, padding: "10px 4px",
                background: "none", border: "none", borderBottom: `1px solid ${ZB.rule}`, fontFamily: "inherit", color: ZB.ink, cursor: "pointer", textAlign: "left" }}>
              <span style={{ fontSize: 15 }}>{r.label}</span>
              <span style={{ fontSize: 17, fontWeight: 700 }}>{fmt(r.value)} <span style={{ fontSize: 12, fontWeight: 600, color: ZB.ink2 }}>{r.unit}</span></span>
            </button>
          ))}
        </div>
      </Section>
      </>)}
    </div>
  );
}
