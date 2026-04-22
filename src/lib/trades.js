export const BTP_TRADES = [
  { id:"architecture",    label:"Architecture",              icon:"📐" },
  { id:"ingenierie",      label:"Ingénierie / Bureau d'études", icon:"📊" },
  { id:"moe",             label:"Maîtrise d'œuvre (MOE)",    icon:"👷" },
  { id:"maconnerie",      label:"Maçonnerie",                icon:"🧱" },
  { id:"gros_oeuvre",     label:"Gros œuvre / Béton",        icon:"🏗️" },
  { id:"terrassement",    label:"Terrassement / VRD",        icon:"🚜" },
  { id:"charpente",       label:"Charpente",                 icon:"🪵" },
  { id:"couverture",      label:"Couverture / Zinguerie",    icon:"🏠" },
  { id:"etancheite",      label:"Étanchéité",                icon:"💧" },
  { id:"facade",          label:"Façade / Ravalement",       icon:"🏛️" },
  { id:"isolation",       label:"Isolation (ITE / ITI)",     icon:"🧊" },
  { id:"platrerie",       label:"Plâtrerie / Cloisons",      icon:"📏" },
  { id:"menuiserie_int",  label:"Menuiserie intérieure",     icon:"🚪" },
  { id:"menuiserie_ext",  label:"Menuiserie ext. / Alu",     icon:"🪟" },
  { id:"serrurerie",      label:"Serrurerie / Métallerie",   icon:"🔧" },
  { id:"plomberie",       label:"Plomberie",                 icon:"🚰" },
  { id:"sanitaire",       label:"Sanitaire / Salle de bain", icon:"🛁" },
  { id:"chauffage",       label:"Chauffage / PAC",           icon:"🔥" },
  { id:"climatisation",   label:"Climatisation / VMC",       icon:"❄️" },
  { id:"electricite",     label:"Électricité",               icon:"⚡" },
  { id:"domotique",       label:"Domotique / Courants faibles", icon:"📡" },
  { id:"peinture",        label:"Peinture / Décoration",     icon:"🎨" },
  { id:"carrelage",       label:"Carrelage / Faïence",       icon:"🟦" },
  { id:"sol_souple",      label:"Sols souples / Parquet",    icon:"🟫" },
  { id:"vitrerie",        label:"Vitrerie / Miroiterie",     icon:"🪞" },
  { id:"cuisine",         label:"Cuisine / Agencement",      icon:"🍳" },
  { id:"piscine",         label:"Piscine / Spa",             icon:"🏊" },
  { id:"paysagiste",      label:"Paysagiste / Espaces verts",icon:"🌳" },
  { id:"demolition",      label:"Démolition / Désamiantage", icon:"🧨" },
]

// Rétrocompatibilité : accepte des IDs anciens (ex: "maconnerie") ou des
// libellés libres (ex: "Maçonnerie"). Retourne toujours un tableau de strings.
export const tradesLabels = (trades = []) =>
  trades.map(t => BTP_TRADES.find(b => b.id === t)?.label ?? t).filter(Boolean)

// Liste plate des libellés pour les suggestions de saisie.
export const TRADE_SUGGESTIONS = BTP_TRADES.map(t => t.label)
