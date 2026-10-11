// Fiche client (système « Bordereau ») : coordonnées tracées, appel et mail
// d'un appui, devis du client en registre.
import { useState } from "react";
import { displayName, fmt } from "../lib/utils.js";
import { saveContactToPhone } from "../lib/vcard.js";
import { ZB } from "../lib/theme.js";
import Badge from "./ui/Badge.jsx";
import ContactEditor from "./ContactEditor.jsx";
import { LIST_CSS, Sheet, EmptyRow, RegisterRow, RowMenu, btnPrimary } from "./ui/Register.jsx";
import { I } from "./ui/icons.jsx";

const TYPE_LABEL = { particulier: "Particulier", artisan: "Artisan", entreprise: "Entreprise" };
const BackIcon = <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>;

export default function ClientDetail({ c, clientDevis, onBack, goDevis, onUpdate, onDelete, onNewDevis }) {
  const [editing, setEditing] = useState(false);

  if (!c) return null;

  // Le 3e élément est un lien : tel: ouvre le téléphone, mailto: le mail.
  const telHref = (n) => n ? `tel:${String(n).replace(/[^\d+]/g, "")}` : null;
  const fields = [
    ["Email",         c.email,          c.email ? `mailto:${c.email}` : null],
    ["Mobile",        c.telephone,      telHref(c.telephone)],
    ["Fixe",          c.telephone_fixe, telHref(c.telephone_fixe)],
    ["Adresse",       [c.adresse, [c.code_postal, c.ville].filter(Boolean).join(" ")].filter(Boolean).join(", "), null],
    ["SIRET",         c.siret,          null],
    ["TVA intracom.", c.tva_intra,      null],
    ["Code NAF",      c.naf,            null],
    ["Activité",      c.activite,       null],
    ["Notes",         c.notes,          null],
  ].filter(([, v]) => v);
  const name = displayName(c);

  return (
    <div className="zb-list" style={{ maxWidth: 960, margin: "0 auto", padding: "8px 12px 28px", fontFamily: ZB.font, color: ZB.ink }}>
      <style>{LIST_CSS}</style>
      <button type="button" onClick={onBack}
        style={{ display: "flex", alignItems: "center", gap: 4, minHeight: 44, padding: "0 4px", marginBottom: 6, background: "none", border: "none", color: ZB.ink, fontFamily: "inherit", fontSize: 15, fontWeight: 600, cursor: "pointer" }}>
        {BackIcon} Clients
      </button>

      <div style={{ background: ZB.sheet, border: `1px solid ${ZB.rule}`, borderRadius: 8, padding: "16px 18px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, overflowWrap: "anywhere" }}>{name}</h2>
            <div style={{ fontSize: 14, color: ZB.ink2, marginTop: 2 }}>
              {TYPE_LABEL[c.type] || "Client"}{c.ville ? ` · ${c.ville}` : ""}
            </div>
          </div>
          <button type="button" onClick={() => setEditing(true)}
            style={{ minHeight: 44, padding: "0 6px", background: "none", border: "none", color: ZB.accent, fontFamily: "inherit", fontSize: 15, fontWeight: 600, cursor: "pointer", flexShrink: 0 }}>
            Modifier
          </button>
          <RowMenu label={`Plus d'actions pour ${name}`} items={[
            { key: "vcard", label: "Ajouter à mon répertoire", onClick: () => saveContactToPhone(c) },
            { key: "del", label: "Supprimer le client", danger: true, confirmLabel: "Appuie encore pour supprimer", onClick: onDelete },
          ]}/>
        </div>

        {fields.length > 0 ? (
          <dl style={{ margin: "14px 0 0", borderTop: `2px solid ${ZB.ink}` }}>
            {fields.map(([k, v, href]) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 16, padding: "10px 0", borderBottom: `1px solid ${ZB.ruleSoft}` }}>
                <dt style={{ fontSize: 14, color: ZB.ink2, flexShrink: 0 }}>{k}</dt>
                <dd style={{ margin: 0, fontSize: 15, textAlign: "right", overflowWrap: "anywhere", whiteSpace: k === "Notes" ? "pre-wrap" : undefined }}>
                  {href ? <a href={href} style={{ color: ZB.accent, fontWeight: 600, textDecoration: "underline", textUnderlineOffset: 3 }}>{v}</a> : v}
                </dd>
              </div>
            ))}
          </dl>
        ) : (
          <p style={{ margin: "14px 0 0", fontSize: 15, color: ZB.ink2 }}>Aucune coordonnée : ajoute-les avec « Modifier ».</p>
        )}

        {onNewDevis && (
          <button type="button" className="zb-primary" style={{ ...btnPrimary, width: "100%", minHeight: 52, marginTop: 16 }} onClick={onNewDevis}>
            {I.spark} Nouveau devis
          </button>
        )}
      </div>

      <section style={{ marginTop: 24 }}>
        <h3 style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 700 }}>
          Devis <span style={{ fontWeight: 500, color: ZB.ink2 }}>· {clientDevis.length}</span>
        </h3>
        <Sheet>
          {clientDevis.length === 0 && <EmptyRow>Aucun devis pour ce client.</EmptyRow>}
          {clientDevis.map((d, i) => (
            <RegisterRow key={d.id} last={i === clientDevis.length - 1}
              onOpen={() => goDevis(d.id)} openLabel={`Ouvrir le devis ${d.objet || d.numero}`}
              title={d.objet || d.numero}
              sub={<span style={{ fontVariantNumeric: "tabular-nums" }}>{d.numero}{d.indice ? ` · indice ${d.indice}` : ""}</span>}
              amount={fmt(d.montant_ht)}
              status={<Badge s={d.statut} short/>}
              menu={<span style={{ width: 8 }}/>}/>
          ))}
        </Sheet>
      </section>

      {editing && <ContactEditor c={c} onSave={u => { onUpdate(u); setEditing(false); }} onClose={() => setEditing(false)}/>}
    </div>
  );
}
