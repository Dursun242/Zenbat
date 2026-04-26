// Petits atomes partagés par les étapes de l'onboarding.

export const Icheck = <svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><polyline points="20,6 9,17 4,12"/></svg>;
export const Iimg   = <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21,15 16,10 5,21"/></svg>;

export function Logo({ size = 22, white = false }) {
  return (
    <span style={{ fontWeight: 800, fontSize: size, letterSpacing: "-0.5px" }}>
      <span style={{ color: "#22c55e" }}>Zen</span>
      <span style={{ color: white ? "white" : "#1A1612" }}>bat</span>
    </span>
  );
}

export function Field({ dark, label, val, onChange, placeholder, type = "text", hint, required, invalid }) {
  const borderColor = invalid ? "#ef4444" : dark ? "#3D3028" : "#E8E2D8";
  return (
    <div>
      <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 600, color: dark ? "#9A8E82" : "#6B6358", marginBottom: 6 }}>
        <span>{label}{required && <span style={{ color: "#ef4444", marginLeft: 2 }}>*</span>}</span>
      </label>
      <input type={type} value={val || ""} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        style={{ width: "100%", background: dark ? "#2A231C" : "white", border: `1px solid ${borderColor}`, borderRadius: 12, padding: "10px 14px", fontSize: 13, color: dark ? "white" : "#1A1612", outline: "none" }}/>
      {hint && <div style={{ fontSize: 10, color: invalid ? "#fca5a5" : "#6B6358", marginTop: 5, lineHeight: 1.4 }}>{invalid ? "⚠ " : "💡 "}{hint}</div>}
    </div>
  );
}

export const FONTS = [
  { id: "modern",  label: "Moderne", sample: "DM Sans" },
  { id: "elegant", label: "Élégant", sample: "Playfair Display" },
  { id: "tech",    label: "Tech",    sample: "Space Grotesk" },
];

export const COLORS = ["#22c55e", "#3b82f6", "#f97316", "#8b5cf6", "#ef4444", "#0891b2", "#1A1612", "#d97706"];

export const STEPS = [
  { title: "Votre identité",       short: "Identité",  subtitle: "Informations qui apparaîtront en en-tête de tous vos devis." },
  { title: "Vos métiers",          short: "Métiers",   subtitle: "BTP, artisanat, beauté, tech, santé… L'Agent IA adapte les devis à vos spécialités." },
  { title: "Coordonnées",          short: "Contacts",  subtitle: "Comment vos clients peuvent vous joindre depuis un devis." },
  { title: "Apparence PDF",        short: "Design",    subtitle: "Couleur, police et rendu visuel de vos devis." },
  { title: "Informations légales", short: "Légal",     subtitle: "Mentions obligatoires et conditions de paiement." },
  { title: "Vos données (RGPD)",   short: "Données",   subtitle: "Téléchargez votre archive ou supprimez votre compte. Conforme RGPD art. 15, 17 et 20." },
];
