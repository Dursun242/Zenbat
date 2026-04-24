// Langues supportées par la reconnaissance vocale (Web Speech API)
// et helpers pour sélection persistante du dernier choix utilisateur.
export const SR_LANGS = [
  { code: "fr-FR", label: "Français", flag: "🇫🇷" },
  { code: "ar-SA", label: "العربية",   flag: "🇸🇦" },
  { code: "ar-MA", label: "الدارجة",   flag: "🇲🇦" },
  { code: "en-US", label: "English",  flag: "🇬🇧" },
  { code: "es-ES", label: "Español",  flag: "🇪🇸" },
  { code: "pt-PT", label: "Português",flag: "🇵🇹" },
  { code: "it-IT", label: "Italiano", flag: "🇮🇹" },
  { code: "de-DE", label: "Deutsch",  flag: "🇩🇪" },
  { code: "tr-TR", label: "Türkçe",   flag: "🇹🇷" },
  { code: "ro-RO", label: "Română",   flag: "🇷🇴" },
  { code: "pl-PL", label: "Polski",   flag: "🇵🇱" },
  { code: "ru-RU", label: "Русский",  flag: "🇷🇺" },
];

export const MIC_LANG_KEY = "zenbat_mic_lang";

export const pickInitialLang = () => {
  if (typeof window !== "undefined") {
    try {
      const saved = localStorage.getItem(MIC_LANG_KEY);
      if (saved && SR_LANGS.some(l => l.code === saved)) return saved;
    } catch {}
  }
  if (typeof navigator === "undefined") return "fr-FR";
  const nav = (navigator.language || "fr-FR").toLowerCase();
  const match = SR_LANGS.find(l => l.code.toLowerCase() === nav || l.code.toLowerCase().split("-")[0] === nav.split("-")[0]);
  return match?.code || "fr-FR";
};
