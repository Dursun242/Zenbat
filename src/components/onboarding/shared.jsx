// Petits atomes partagés par les étapes de l'onboarding (système « Bordereau »).
import { ZB } from "../../lib/theme.js";

export const Icheck = <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden="true"><polyline points="20,6 9,17 4,12"/></svg>;
export const Iimg   = <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21,15 16,10 5,21"/></svg>;
export const Iclose = <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>;
export const Iplus  = <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>;
export const Isearch = <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>;
export const Iback  = <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>;

// Logotype Zenbat : « Zen » terre cuite + « bat » encre (blanc sur fond encre).
export function Logo({ size = 22, white = false }) {
  return (
    <span style={{ fontFamily: ZB.font, fontWeight: 800, fontSize: size, letterSpacing: "-0.02em" }}>
      <span style={{ color: ZB.accent }}>Zen</span>
      <span style={{ color: white ? ZB.sheet : ZB.ink }}>bat</span>
    </span>
  );
}

// Styles de formulaire communs (champs 48px, texte 16px, bordure ZB.field ≥ 3:1, 8px).
export const labelStyle = { display: "block", fontSize: 14, fontWeight: 600, color: ZB.ink2, marginBottom: 6 };
export const inputStyle = {
  width: "100%", minHeight: 48, background: ZB.sheet, border: `1px solid ${ZB.field}`, borderRadius: 8,
  padding: "11px 12px", fontSize: 16, color: ZB.ink, outline: "none", boxSizing: "border-box", fontFamily: "inherit",
};
export const textareaStyle = { ...inputStyle, minHeight: 0, resize: "vertical", lineHeight: 1.4 };
export const hintStyle = { fontSize: 13, color: ZB.ink2, marginTop: 6, lineHeight: 1.4 };

// Bouton de choix (radio) : feuille au repos, terre cuite pâle une fois choisi.
export const choiceStyle = (on) => ({
  minHeight: 44, borderRadius: 8, border: `1px solid ${on ? ZB.accent : ZB.rule}`,
  background: on ? ZB.accentSoft : ZB.sheet, color: ZB.ink, fontFamily: "inherit", cursor: "pointer",
});

// Section tracée (filet au-dessus) au lieu d'une carte.
export function Section({ title, sub, children }) {
  return (
    <section style={{ borderTop: `1px solid ${ZB.rule}`, paddingTop: 16, display: "flex", flexDirection: "column", gap: 14 }}>
      <div>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: ZB.ink }}>{title}</h3>
        {sub && <p style={{ margin: "4px 0 0", fontSize: 14, color: ZB.ink2, lineHeight: 1.45 }}>{sub}</p>}
      </div>
      {children}
    </section>
  );
}

// CSS commun : focus terre cuite, placeholders lisibles, mouvement réduit.
export const FORM_CSS = `
  .zb-form input:focus:not([aria-invalid="true"]), .zb-form textarea:focus:not([aria-invalid="true"]) { border-color: ${ZB.accent} !important; }
  .zb-form input::placeholder, .zb-form textarea::placeholder { color: ${ZB.ink3}; opacity: 1; }
  .zb-form button:focus-visible, .zb-form a:focus-visible, .zb-form [role="button"]:focus-visible { outline: 2px solid ${ZB.accent}; outline-offset: 2px; }
  .zb-form input[type="checkbox"]:focus-visible { outline: 2px solid ${ZB.accent}; outline-offset: 2px; }
  @media (hover: hover) { .zb-opt:hover { background: ${ZB.paper2} !important; } }
  @keyframes popIn { from { opacity: 0 } to { opacity: 1 } }
  @keyframes spin { to { transform: rotate(360deg) } }
  .pop { animation: popIn .2s ease both; }
  @media (prefers-reduced-motion: reduce) { .pop { animation: none; } }
`;

// `dark` est conservé pour compatibilité ; l'onboarding est désormais sur papier clair.
// eslint-disable-next-line no-unused-vars
export function Field({ dark, label, val, onChange, placeholder, type = "text", hint, required, invalid }) {
  return (
    <label style={{ display: "block" }}>
      <span style={labelStyle}>
        {label}{required && <span aria-hidden="true" style={{ color: ZB.ink2, marginLeft: 2 }}>*</span>}
      </span>
      <input type={type} value={val || ""} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        aria-required={required ? "true" : undefined} aria-invalid={invalid ? "true" : undefined}
        style={{ ...inputStyle, borderColor: invalid ? ZB.danger : ZB.field }}/>
      {hint && <span style={{ ...hintStyle, display: "block", color: invalid ? ZB.danger : ZB.ink2, fontWeight: invalid ? 600 : 400 }}>{hint}</span>}
    </label>
  );
}

// Polices proposées pour les documents de l'artisan (PDF / aperçu) : ce sont
// les polices de SES devis, pas celles de l'interface (cf. PDFViewer).
export const FONTS = [
  { id: "modern",  label: "Moderne", sample: "DM Sans" },
  { id: "elegant", label: "Élégant", sample: "Playfair Display" },
  { id: "tech",    label: "Tech",    sample: "Space Grotesk" },
];

// Couleurs proposées pour les documents de l'artisan (brand.color) : elles ne
// colorent jamais l'interface.
export const COLORS = ["#22c55e", "#3b82f6", "#f97316", "#8b5cf6", "#ef4444", "#0891b2", "#1A1612", "#d97706"];

export const STEPS = [
  { title: "Ton identité",         short: "Identité",  subtitle: "Informations qui apparaîtront en en-tête de tous tes devis." },
  { title: "Tes métiers",          short: "Métiers",   subtitle: "BTP, artisanat, beauté, tech, santé… L'Agent IA adapte les devis à tes spécialités." },
  { title: "Coordonnées",          short: "Contacts",  subtitle: "Comment tes clients peuvent te joindre depuis un devis." },
  { title: "Apparence PDF",        short: "Design",    subtitle: "Couleur, police et rendu visuel de tes devis." },
  { title: "Informations légales", short: "Légal",     subtitle: "Mentions obligatoires et conditions de paiement." },
  { title: "Tes données (RGPD)",   short: "Données",   subtitle: "Télécharge ton archive ou supprime ton compte. Conforme RGPD art. 15, 17 et 20." },
];
