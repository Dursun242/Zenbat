import { useState, useRef, useEffect, useMemo } from "react";
import { CLAUDE_MODEL, TX } from "../lib/constants.js";
import { fmt, uid } from "../lib/utils.js";
import { tradesLabels } from "../lib/trades.js";
import { buildDevisHistorySummary, formatHistoryPrompt } from "../lib/devisHistory.js";
import { supabase } from "../lib/supabase.js";
import { I } from "./ui/icons.jsx";
import ClientPickerModal from "./ClientPickerModal.jsx";

const SR_LANGS = [
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

const MIC_LANG_KEY = "zenbat_mic_lang";

const pickInitialLang = () => {
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

// ── Détection de la famille de métiers ───────────────────────────────────────
const SECTOR_KEYWORDS = {
  btp:          ["maçonnerie","plomberie","électricité","charpente","couverture","isolation","carrelage","peinture","menuiserie","façade","étanchéité","terrassement","gros œuvre","chauffage","climatisation","serrurerie","sols souples","vitrerie","piscine","paysagiste","démolition","domotique","sanitaire","architecture","maîtrise d'œuvre","bureau d'études","cuisine / agencement","zinguerie","vrd","béton"],
  beaute:       ["coiffure","barbier","esthétique","onglerie","maquillage","massage","tatouage","piercing","bien-être"],
  sante:        ["kinésithérapie","ostéopathie","naturopathie","diététique","coach sportif","psychologie","opticien","audioprothésiste","nutrition","personal trainer"],
  tech:         ["développement web","développement mobile","informatique","cybersécurité","graphisme","ux","ui design","seo","sea","community management","création de contenu","développement logiciel","réseaux"],
  alimentaire:  ["boulangerie","pâtisserie","boucherie","charcuterie","traiteur","restauration","chocolatier","confiseur","glacier","sommellerie","cave"],
  transport:    ["mécanique automobile","carrosserie","vitrage auto","moto","vélo","déménagement","transport","livraison","vtc","taxi"],
  communication:["photographie","vidéographie","montage","drone","rédaction","copywriting","traduction","illustration","impression","signalétique","publicité","marketing"],
  evenementiel: ["événements","dj","animation musicale","traiteur événementiel","décoration événementielle","son / lumière","scène"],
  education:    ["cours particuliers","formation professionnelle","auto-école"],
  nettoyage:    ["nettoyage","pressing","blanchisserie","ramonage","entretien cheminée","désinfection","dératisation"],
  animaux:      ["toilettage animal","vétérinaire","dog-sitting","pet-sitting","dressage","éducation canine"],
  immobilier:   ["agent immobilier","gestionnaire de patrimoine","comptabilité","expertise comptable","juridique","conseil"],
  mode:         ["couture","retouche","maroquinerie","cordonnerie","teinturerie"],
};

const detectSectors = (tradeNames) => {
  const t = tradeNames.join(" ").toLowerCase();
  const found = Object.entries(SECTOR_KEYWORDS)
    .filter(([, kws]) => kws.some(kw => t.includes(kw)))
    .map(([sector]) => sector);
  return found.length ? found : ["general"];
};

// ── Contexte adapté au secteur ────────────────────────────────────────────────
const SECTOR_LABELS = {
  btp: "BTP et travaux du bâtiment", beaute: "beauté et bien-être", sante: "santé et paramédical",
  tech: "tech et numérique", alimentaire: "artisanat alimentaire et restauration",
  transport: "transport et automobile", communication: "communication et créatif",
  evenementiel: "événementiel et animation", education: "enseignement et formation",
  nettoyage: "nettoyage et entretien", animaux: "services animaliers",
  immobilier: "immobilier et conseil", mode: "mode et textile", general: "prestations de services",
};

const SECTOR_UNITS = {
  btp:           "m², ml, m³, u, ens, h",
  beaute:        "u (prestation), forfait, h, min",
  sante:         "u (séance), forfait, h",
  tech:          "j (jour/homme), h, forfait, u",
  alimentaire:   "u, kg, pers, pièce, lot, kg",
  transport:     "km, h, j, forfait, u",
  communication: "j, h, forfait, u",
  evenementiel:  "h, j, forfait, pers, u",
  education:     "h, j, session, forfait",
  nettoyage:     "h, m², forfait, j",
  animaux:       "u, h, j, forfait",
  immobilier:    "h, j, forfait, u",
  mode:          "u, h, pièce, forfait",
  general:       "u, h, j, forfait, ens",
};

const SECTOR_PRICING = {
  btp:           "Prix réalistes BTP France 2025. Ex : main-d'œuvre élec 45-65 €/h, pose carrelage 30-50 €/m², isolation combles 20-40 €/m².",
  beaute:        "Tarifs beauté France 2025. Ex : coupe femme 35-80 €, soin visage 60-120 €, pose ongles 40-80 €, épilation 20-60 €.",
  sante:         "Tarifs paramédicaux France 2025. Ex : séance kiné 40-70 €, ostéo 60-90 €, coaching sportif 50-100 €/h, consultation diét. 60-80 €.",
  tech:          "TJM tech France 2025. Ex : dev web junior 350-500 €/j, senior 600-900 €/j, graphiste 300-600 €/j, chef de projet 500-800 €/j.",
  alimentaire:   "Tarifs artisanat alimentaire France 2025. Ex : plateau repas traiteur 15-35 €/pers, buffet cocktail 25-55 €/pers, gâteau sur-mesure 4-8 €/part.",
  transport:     "Tarifs transport France 2025. Ex : déménagement studio 400-800 €, VTC aéroport 40-80 €, dépannage moto 80-150 €, livraison express 15-40 €.",
  communication: "Tarifs comm/créatif France 2025. Ex : reportage photo demi-journée 400-800 €, vidéo institutionnelle 1 500-5 000 €, logo 500-2 000 €.",
  evenementiel:  "Tarifs événementiel France 2025. Ex : DJ soirée 400-1 200 €, photographe événement 600-1 500 €, animation musicale 300-800 €.",
  education:     "Tarifs formation France 2025. Ex : cours particulier 25-60 €/h, formation pro 500-1 500 €/jour, auto-école forfait 1 200-2 000 €.",
  nettoyage:     "Tarifs nettoyage France 2025. Ex : ménage domicile 15-25 €/h, nettoyage bureaux 18-30 €/h, vitres 3-8 €/m².",
  animaux:       "Tarifs animaliers France 2025. Ex : toilettage chien 40-80 €, pension journalière 20-40 €, dressage 50-80 €/séance.",
  immobilier:    "Honoraires France 2025. Ex : gestion locative 5-10%/mois, expertise comptable 80-200 €/h, consultant juridique 150-400 €/h.",
  mode:          "Tarifs couture France 2025. Ex : retouche simple 10-30 €, ourlet 15-25 €, robe sur-mesure 200-800 €.",
  general:       "Tarifs du marché France 2025. Adapte les prix, les unités et le vocabulaire au métier exact déclaré par l'utilisateur, en t'appuyant sur ta connaissance professionnelle de ce métier (tarifs pratiqués, conventions, spécificités). Évite toute réponse générique.",
};

const SECTOR_TVA = {
  btp: `TVA : applique le taux correct par ouvrage selon la réglementation française :
- 5.5% : travaux d'amélioration énergétique (isolation, PAC, fenêtres dans logement >2 ans).
- 10% : entretien/rénovation/amélioration dans logement d'habitation >2 ans.
- 20% : neuf, gros œuvre, locaux professionnels, fournitures sans pose.`,
  alimentaire: `TVA :
- 5.5% : produits alimentaires de base (pain, épicerie, pâtisserie non luxe).
- 10% : restauration, plats cuisinés, traiteur.
- 20% : boissons alcoolisées, confiseries, chocolat.`,
  sante: `TVA : 20% pour les soins non remboursés (coaching, naturopathie, nutrition). Actes paramédicaux conventionnés : tva_rate 0. En cas de doute, applique 20%.`,
  nettoyage: `TVA : 10% pour les services à la personne à domicile (résidence principale). 20% pour locaux professionnels.`,
  default: `TVA : 20% par défaut pour les prestations de services en France.`,
};

const buildSectorContext = (sectors, vatRegime) => {
  const expertDomain = sectors.map(s => SECTOR_LABELS[s] || s).join(" et ");
  const units = [...new Set(sectors.flatMap(s => (SECTOR_UNITS[s] || SECTOR_UNITS.general).split(", ")))].join(", ");
  const pricing = sectors.map(s => SECTOR_PRICING[s] || SECTOR_PRICING.general).join("\n");
  const vocab = sectors.includes("btp") ? "travaux / ouvrages" : "prestations / services";
  const tvaContext = vatRegime === "franchise"
    ? `TVA — RÈGLE ABSOLUE : franchise en base (art. 293 B). TOUS les ouvrages ont "tva_rate": 0. Ne propose jamais d'autre taux. Ne mentionne pas la TVA dans le chat.`
    : (SECTOR_TVA[sectors.find(s => SECTOR_TVA[s])] || SECTOR_TVA.default);
  return { expertDomain, units, pricing, vocab, tvaContext };
};

const SECTOR_GREETING_EXAMPLE = {
  btp:           "Ex : *Pose carrelage 40m² à 25€/m², fourniture incluse*",
  beaute:        "Ex : *Coupe + couleur femme 80€, soin visage 60€*",
  sante:         "Ex : *Séance kiné 45€ × 4, bilan posture 90€*",
  tech:          "Ex : *Site vitrine 5j × 500€/j, maintenance 2h/mois × 80€*",
  alimentaire:   "Ex : *Buffet cocktail 35€/pers × 50 pers, livraison 80€*",
  transport:     "Ex : *Déménagement T2 Paris–Lyon forfait 650€, emballage 80€*",
  communication: "Ex : *Reportage photo 8h × 120€, retouches forfait 200€*",
  evenementiel:  "Ex : *DJ soirée 6h 800€, sono & lumières forfait 400€*",
  education:     "Ex : *Cours de maths 2h/sem × 35€/h, bilan pédagogique 90€*",
  nettoyage:     "Ex : *Nettoyage bureaux 80m² × 18€/m², vitrerie 20m² × 5€/m²*",
  animaux:       "Ex : *Toilettage golden 65€, bain + séchage 30€*",
  immobilier:    "Ex : *Gestion locative 6 mois × 120€/mois, état des lieux 180€*",
  mode:          "Ex : *Ourlet pantalon 20€ × 3, retouche robe de soirée 60€*",
  general:       "Ex : *Prestation 2h × 60€/h, fourniture matériel forfait 120€*",
};

const buildAgentGreeting = (brand) => {
  const tradeNames = tradesLabels(brand?.trades || []);
  const sectors = detectSectors(tradeNames);
  const { expertDomain } = buildSectorContext(sectors, brand?.vatRegime);
  const example = SECTOR_GREETING_EXAMPLE[sectors[0]] || SECTOR_GREETING_EXAMPLE.general;
  return `Bonjour 👋 Je suis votre assistant spécialisé en **${expertDomain}**.\n\nDécrivez votre besoin ligne par ligne, dans la langue de votre choix (français, arabe, darija, espagnol, anglais, portugais…). Je rédige le devis en français professionnel.\n\n${example}`;
};

export default function AgentIA({ devis, onCreateDevis, clients, onSaveClient, plan, trialExpired, onPaywall, setTab, onOpenDevisPDF, brand }) {
  const [msgs,         setMsgs]         = useState(() => [{ role: "assistant", content: buildAgentGreeting(brand) }]);
  const [input,        setInput]        = useState("");
  const [loading,      setLoading]      = useState(false);
  const [lignes,       setLignes]       = useState([]);
  const [objet,        setObjet]        = useState("");
  const [visibleCount, setVisibleCount] = useState(0);
  const [pickingClient, setPickingClient] = useState(false);
  const [listening,    setListening]    = useState(false);
  const [micLang,      setMicLang]      = useState(() => pickInitialLang());
  const [langMenu,     setLangMenu]     = useState(false);
  const [micError,     setMicError]     = useState(null);
  const chatRef  = useRef(null);
  const inputRef = useRef(null);
  const recRef   = useRef(null);
  const accumRef = useRef("");

  const ac         = brand.color || "#22c55e";
  const fontFamily = brand.fontStyle === "elegant" ? "Playfair Display" : brand.fontStyle === "tech" ? "Space Grotesk" : "DM Sans";

  // Résume l'historique pour contextualiser l'IA (recalculé quand devis change)
  const historySummary = useMemo(() => buildDevisHistorySummary(devis), [devis]);

  useEffect(() => {
    chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs, loading]);

  // Auto-grandit le textarea et suit la fin du texte (utile pendant la dictée)
  useEffect(() => {
    const ta = inputRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 120) + "px";
    ta.scrollTop = ta.scrollHeight;
    ta.scrollLeft = ta.scrollWidth;
  }, [input]);

  useEffect(() => {
    if (!lignes.length) return;
    setVisibleCount(0);
    let i = 0;
    const iv = setInterval(() => { i++; setVisibleCount(i); if (i >= lignes.length) clearInterval(iv); }, 110);
    return () => clearInterval(iv);
  }, [lignes]);

  const ht = lignes.filter(l => l.type_ligne === "ouvrage")
    .reduce((s, l) => s + l.quantite * (l.prix_unitaire || 0), 0);

  const tvaGroups = lignes.filter(l => l.type_ligne === "ouvrage").reduce((a, l) => {
    const r = Number(l.tva_rate ?? 20);
    a[r] = (a[r] || 0) + (l.quantite || 0) * (l.prix_unitaire || 0);
    return a;
  }, {});
  const tvaRows = Object.keys(tvaGroups).map(Number).sort((a, b) => a - b)
    .map(r => ({ rate: r, base: tvaGroups[r], montant: tvaGroups[r] * (r / 100) }));
  const tvaTotal = tvaRows.reduce((s, r) => s + r.montant, 0);
  const ttc = ht + tvaTotal;

  const buildSystemPrompt = () => {
    const tradeNames = tradesLabels(brand.trades);
    const sectors = detectSectors(tradeNames);
    const { expertDomain, units, pricing, vocab, tvaContext } = buildSectorContext(sectors, brand.vatRegime);
    const hasTrades = tradeNames.length > 0;
    const isGenericSector = sectors.length === 1 && sectors[0] === "general";

    const personaBlock = hasTrades
      ? `Tu INCARNES un professionnel confirmé, reconnu et expérimenté dans le(s) métier(s) suivant(s) : ${tradeNames.join(", ")}.
Tu maîtrises PARFAITEMENT pour chacun de ces métiers :
- le vocabulaire technique précis (termes d'atelier, normes, références),
- les prestations standards, les étapes types d'un chantier / d'une mission,
- les unités de facturation du métier (m², ml, m³, u, h, j, forfait, pers, pièce…),
- les fourchettes de prix réalistes du marché français 2025,
- les usages commerciaux, les mentions légales et obligations propres au métier.
Tu rédiges chaque devis avec la rigueur, le niveau de détail et le ton d'un pro confirmé qui exerce ce métier au quotidien — jamais de formulations génériques, jamais d'approximations.`
      : `Tu es un assistant devis professionnel capable de t'adapter à n'importe quel métier déclaré par l'utilisateur. Adopte systématiquement le ton, le vocabulaire technique et les prix du marché français 2025 du métier concerné.`;

    const tradesBlock = hasTrades
      ? `\n\nSPÉCIALISATION DE L'ENTREPRISE — RÈGLE SOUPLE (gestion du hors-périmètre en 3 temps) :
L'entreprise est déclarée dans les métiers suivants : ${tradeNames.join(", ")}.
Par défaut, tu proposes des devis dans ces métiers.

Si la demande sort CLAIREMENT de ce périmètre (ex : métiers totalement étrangers), tu suis ce flux en 3 étapes — en t'appuyant sur l'historique des messages pour compter les tentatives de l'utilisateur sur la MÊME prestation hors périmètre :

1. 1ʳᵉ demande hors périmètre : NE PAS refuser sèchement. Tu poses UNE question courte, en français, pour vérifier l'intention. PAS de balise <DEVIS>. Exemple : « Cette demande (X) sort de vos métiers déclarés (${tradeNames.slice(0,3).join(", ")}…). Voulez-vous quand même que je rédige un devis pour cette prestation ? »

2. 2ᵈᵉ demande (l'utilisateur insiste ou reformule la même chose) : tu redemandes confirmation en une phrase ET tu mentionnes qu'il peut ajouter ce métier à son profil. PAS de balise <DEVIS>. Exemple : « D'accord, je peux le faire. Voulez-vous que je génère le devis maintenant ? Pensez à ajouter « X » à vos métiers dans Mon profil pour les prochains devis. »

3. 3ᵉ demande ou dès que l'utilisateur confirme explicitement ("oui", "vas-y", "fais-le", "confirme") : tu GÉNÈRES le devis normalement avec <DEVIS> et tu ajoutes en tête de ta réponse visible, avant la balise, cette phrase : « 💡 Pensez à ajouter « X » à vos métiers dans Mon profil (étape Métiers) — vos futurs devis seront plus précis. »

Demandes MIXTES (partie métier + partie hors périmètre) : tu génères TOUTES les lignes utiles sans bloquer, et tu signales en UNE phrase les lignes hors périmètre + la même astuce "pensez à ajouter X au profil".

Tu NE refuses jamais sèchement. Tu ne dis jamais "Désolé, nous ne réalisons pas" sauf si l'utilisateur, après les 3 étapes, annule explicitement lui-même.`
      : "";

    // Si le métier n'entre dans aucun secteur pré-câblé, on fait confiance à
    // l'expertise générale de l'IA sur le métier nommé, sans l'enfermer dans
    // les exemples génériques.
    const pricingBlock = isGenericSector && hasTrades
      ? `PRIX — RÈGLE ABSOLUE :
Utilise des tarifs réalistes du marché français 2025 propres au métier "${tradeNames.join(", ")}". Fais appel à ta connaissance spécifique de ce métier (tarifs pratiqués, unités standards, prestations types). Ne propose JAMAIS de prix génériques ou "secteur services" si un prix plus précis propre à ce métier existe.`
      : pricing;

    const historyBlock = formatHistoryPrompt(historySummary);

    return `${personaBlock}

Contexte produit : tu es intégré dans l'application Zenbat (devis / facturation pour indépendants et TPE françaises).${tradesBlock}

LANGUE — RÈGLE ABSOLUE :
1. Tu comprends TOUTES les langues : français, arabe littéraire, darija marocaine, kabyle, espagnol, portugais, anglais, roumain, polonais, turc, wolof, bambara, tamoul, ourdou, hindi, chinois, russe, ukrainien, italien, allemand, etc.
2. Tu réponds TOUJOURS en français professionnel, 100% du temps, SANS EXCEPTION.
3. Tu TRADUIS systématiquement en français toutes les prestations décrites, quel que soit la langue d'entrée.
4. Le JSON (objet, lots, désignations, unités) est TOUJOURS rédigé en français normé.

MONNAIE — RÈGLE ABSOLUE :
1. Toutes les valeurs monétaires sont TOUJOURS en euros (€), sans exception.
2. Si l'utilisateur exprime un montant dans une autre devise par habitude (dirhams, dollars, livres, yen, dinars, francs CFA, roubles, pesos, réais, zlotys, lei, lires, etc.), tu l'interprètes DIRECTEMENT en euros comme s'il avait dit "euros" — AUCUNE conversion, AUCUN taux de change.
3. Exemples : "10 000 dirhams" = 10 000 €, "5000 dollars" = 5000 €, "100 DH le m²" = 100 € le m².
4. Tu ne mentionnes jamais la devise d'origine dans le devis ni dans ta réponse.

MONTANT GLOBAL DEMANDÉ — RÈGLE ABSOLUE :
1. Si l'utilisateur impose un montant total (ex : "fais-moi un devis de 10 000 € pour...", "budget 15 000", "total 8000 €"), le devis DOIT respecter ce total EXACTEMENT au centime près, quel que soit le nombre de lignes.
2. Dans ce cas, tu DOIS ajouter le champ "target_total_ht": <nombre> dans le JSON racine avec le montant exact demandé par l'utilisateur (en euros, sans symbole, sans séparateur de milliers).
3. Méthode : décompose en lots/${vocab} réalistes, puis ajuste les quantités ET/OU les prix unitaires pour que la somme des (quantité × prix unitaire) des lignes "ouvrage" tombe EXACTEMENT sur le total demandé.
4. Si l'utilisateur précise UN prix unitaire (ex : "50 € le m²"), tu conserves ce PU tel quel et tu ajustes la quantité pour atteindre le total.
5. Si l'utilisateur donne une quantité ET un total, tu vérifies que quantité × PU = total ; en cas de conflit, tu privilégies le PU × quantité tel qu'énoncé et tu signales en une phrase le total réel.
6. Vérification mentale obligatoire AVANT d'émettre le JSON : fais la somme des lignes "ouvrage" et confirme qu'elle correspond exactement au montant demandé.
7. Si aucun montant global n'est imposé, N'AJOUTE PAS le champ "target_total_ht".

TÂCHE : L'utilisateur décrit des ${vocab} à devisser. TOUJOURS répondre avec un JSON entre <DEVIS></DEVIS> même si c'est une seule ligne.
Si l'utilisateur donne un prix unitaire explicite, utilise-le EXACTEMENT.

Unités usuelles${hasTrades ? ` pour ${tradeNames.join(", ")}` : ""} : ${units}${isGenericSector && hasTrades ? " (et toute autre unité propre au métier si plus pertinente)" : ""}.

Format strict : {"objet":"titre court en français","lignes":[
  {"type_ligne":"lot","designation":"NOM DU LOT EN FRANÇAIS"},
  {"type_ligne":"ouvrage","lot":"nom lot","designation":"description en français","unite":"${units.split(", ")[0]}","quantite":10,"prix_unitaire":25,"tva_rate":20}
]}

${tvaContext}

${pricingBlock}

Règles : groupe par lots, désignations professionnelles en français, propres au métier du client.
Si besoin de précision, pose UNE seule question courte EN FRANÇAIS, et génère quand même un JSON partiel.${historyBlock}`;
  };

  const send = async () => {
    if (!input.trim() || loading) return;
    if (trialExpired) { onPaywall(); return; }

    const userMsg = { role: "user", content: input };
    const newMsgs = [...msgs, userMsg];
    setMsgs(newMsgs);
    setInput(""); setLoading(true);

    let assistantAdded = false;
    const updateAssistant = (visibleText) => {
      setMsgs(prev => {
        if (!assistantAdded) {
          assistantAdded = true;
          return [...prev, { role: "assistant", content: visibleText }];
        }
        const next = [...prev];
        next[next.length - 1] = { role: "assistant", content: visibleText };
        return next;
      });
    };

    const body = {
      model: CLAUDE_MODEL,
      max_tokens: 4000,
      system: buildSystemPrompt(),
      messages: newMsgs.map(m => ({ role: m.role, content: m.content })),
    };

    let raw = "";
    let apiError = null;

    const streamResponse = async () => {
      const res = await fetch("/api/claude", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, stream: true }),
      });
      if (!res.ok) {
        const detail = await res.json().catch(() => null);
        apiError = detail?.error || `HTTP ${res.status}`;
        throw new Error("api");
      }
      if (!res.body) throw new Error("api");
      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let sep;
        while ((sep = buffer.indexOf("\n\n")) !== -1) {
          const event = buffer.slice(0, sep);
          buffer = buffer.slice(sep + 2);
          for (const line of event.split("\n")) {
            if (!line.startsWith("data:")) continue;
            const payload = line.slice(5).trim();
            if (!payload || payload === "[DONE]") continue;
            try {
              const msg = JSON.parse(payload);
              if (msg.type === "content_block_delta" && msg.delta?.type === "text_delta") {
                raw += msg.delta.text || "";
                const cut     = raw.indexOf("<DEVIS>");
                const visible = (cut >= 0 ? raw.slice(0, cut) : raw).trim();
                if (visible) updateAssistant(visible);
              } else if (msg.type === "error") {
                apiError = msg.error?.message || "Erreur Anthropic";
                throw new Error("api");
              }
            } catch { /* chunk partiel — on ignore */ }
          }
        }
      }
    };

    const nonStreamResponse = async () => {
      const res = await fetch("/api/claude", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        apiError = data?.error || `HTTP ${res.status}`;
        throw new Error("api");
      }
      raw = (data?.content?.[0]?.text || "").toString();
      const cut     = raw.indexOf("<DEVIS>");
      const visible = (cut >= 0 ? raw.slice(0, cut) : raw).trim();
      if (visible) updateAssistant(visible);
    };

    try {
      try {
        await streamResponse();
        if (!raw) throw new Error("stream-empty");
      } catch (streamErr) {
        // Fallback non-streamé si le SSE casse (proxy, pare-feu, etc.)
        console.warn("[AgentIA] streaming failed, falling back:", streamErr);
        raw = "";
        await nonStreamResponse();
      }

      const match = raw.match(/<DEVIS>([\s\S]*?)<\/DEVIS>/) || raw.match(/<DEVIS>([\s\S]+)/);
      const txt   = raw.replace(/<DEVIS>[\s\S]*/g, "").trim();

      if (match) {
        try {
          const parsed    = JSON.parse(match[1].trim());
          const newLignes = (parsed.lignes || []).map(l => ({ ...l, id: uid() }));

          // Franchise en base de TVA : force tva_rate = 0 sur toutes les lignes
          // (remap immuable — jamais de mutation in-place).
          let finalLignes = brand.vatRegime === "franchise"
            ? newLignes.map(l => l.type_ligne === "ouvrage" ? { ...l, tva_rate: 0 } : l)
            : newLignes;

          // Filet de sécurité : si l'IA déclare un montant cible et que la somme
          // des lignes ouvrage n'y correspond pas, on rescale les prix unitaires.
          const target = Number(parsed.target_total_ht);
          if (target > 0) {
            const sum = finalLignes
              .filter(l => l.type_ligne === "ouvrage")
              .reduce((s, l) => s + (Number(l.quantite) || 0) * (Number(l.prix_unitaire) || 0), 0);
            if (sum > 0 && Math.abs(sum - target) / target > 0.005) {
              const ratio = target / sum;
              // 1ère passe : rescale proportionnel sur chaque ligne ouvrage
              finalLignes = finalLignes.map(l => l.type_ligne === "ouvrage"
                ? { ...l, prix_unitaire: Math.round((Number(l.prix_unitaire) || 0) * ratio * 100) / 100 }
                : l);
              // 2ème passe : absorbe la dérive d'arrondi sur la dernière ligne ouvrage
              const rescaled = finalLignes
                .filter(l => l.type_ligne === "ouvrage")
                .reduce((s, l) => s + (Number(l.quantite) || 0) * (Number(l.prix_unitaire) || 0), 0);
              const drift = target - rescaled;
              if (Math.abs(drift) > 0.009) {
                let fixed = false;
                finalLignes = [...finalLignes].reverse().map(l => {
                  if (!fixed && l.type_ligne === "ouvrage") {
                    fixed = true;
                    const q  = Number(l.quantite) || 1;
                    const pu = (Number(l.prix_unitaire) || 0) + drift / q;
                    return { ...l, prix_unitaire: Math.round(pu * 100) / 100 };
                  }
                  return l;
                }).reverse();
              }
            }
          }

          if (parsed.objet && !objet) setObjet(parsed.objet);
          setLignes(prev => {
            const existingDesigs = new Set(prev.map(l => l.designation));
            return [...prev, ...finalLignes.filter(l => !existingDesigs.has(l.designation))];
          });
        } catch { /* JSON mal formé — on ignore */ }
      }

      const finalText = txt || (match ? TX.linesAdded : "Je n'ai pas compris, pouvez-vous reformuler ?");
      updateAssistant(finalText);

      // Détection best-effort des interactions "négatives" pour analyse admin.
      // - Refus IA : pas de <DEVIS> émis + vocabulaire de refus dans la réponse.
      // - Utilisateur mécontent : marqueurs de frustration dans le message.
      // Refus "dur" uniquement (pas les questions polies du flux soft hors-périmètre).
      const refusalRe  = /ne r[ée]alis(ons|e|ent) pas|ne fais(ons|ent)? pas|ne propos(ons|e|ent) pas|ne traitons pas|pas (notre|de) sp[ée]cialit[ée]/i;
      const negUserRe  = /\b(nul|nulle|pourri|pourrie|merdique|d[ée]bile|stupide|inutile|ne sert à rien|marche pas|fonctionne pas|ne comprend[s]? rien|ça bug|bug[ué]|ça beug|arrête de|n'importe quoi|t'es mauvais|mauvaise r[ée]ponse)\b/i;
      const isRefusal     = !match && refusalRe.test(finalText);
      const isUserNegative= negUserRe.test(userMsg.content || "");
      if (isRefusal || isUserNegative) {
        supabase.from("ia_negative_logs").insert({
          kind:         isRefusal ? "ai_refusal" : "user_negative",
          user_message: userMsg.content?.slice(0, 500) || null,
          ai_response:  isRefusal ? (finalText?.slice(0, 500) || null) : null,
        }).then(
          ({ error: dbErr }) => { if (dbErr) console.warn("[negative log/db]", dbErr.message); },
          (netErr)           => { console.warn("[negative log/net]", netErr?.message || netErr); },
        );
      }

      // Incrémente le compteur d'usage IA (best-effort, silencieux)
      supabase.rpc("increment_ai_used").then(() => {}, () => {});
    } catch (e) {
      const detail = apiError || e.message || "unknown";
      console.error("[AgentIA] send failed:", e, apiError);
      // Log côté serveur pour consultation admin (best-effort, silencieux).
      // Supabase ne rejette jamais .then() → on gère l'error dans onFulfilled
      // et les vraies erreurs réseau dans onRejected.
      supabase.from("ia_error_logs").insert({
        error:         detail,
        user_message:  userMsg.content?.slice(0, 500) || null,
        history_len:   newMsgs.length,
        stream_tried:  true,
      }).then(
        ({ error: dbErr }) => { if (dbErr) console.warn("[log insert/db]", dbErr.message); },
        (netErr)           => { console.warn("[log insert/net]", netErr?.message || netErr); },
      );
      const msg = !navigator.onLine ? TX.errNetwork : e.message === "api" ? TX.errApi : TX.errGeneral;
      updateAssistant("❌ " + msg);
    }
    setLoading(false);
  };

  // ── Reconnaissance vocale (Web Speech API) ─────────────────
  const SRClass = typeof window !== "undefined"
    ? (window.SpeechRecognition || window.webkitSpeechRecognition)
    : null;
  const micSupported = !!SRClass;

  useEffect(() => () => {
    try { recRef.current?.stop(); } catch {}
  }, []);

  const stopListening = () => {
    try { recRef.current?.stop(); } catch {}
    setListening(false);
  };

  const startListening = () => {
    if (!SRClass) { setMicError("La reconnaissance vocale n'est pas disponible sur ce navigateur."); return; }
    setMicError(null);
    accumRef.current = input && !input.endsWith(" ") ? input + " " : input;
    const rec = new SRClass();
    rec.lang = micLang;
    rec.continuous     = true;
    rec.interimResults = true;
    rec.onresult = (e) => {
      let interim = "", final = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) final += t + " ";
        else interim += t;
      }
      if (final) accumRef.current += final;
      setInput(accumRef.current + interim);
    };
    rec.onerror = (ev) => {
      setListening(false);
      if (ev.error === "not-allowed" || ev.error === "service-not-allowed") {
        setMicError("Microphone refusé. Autorisez-le dans les réglages du navigateur.");
      } else if (ev.error === "no-speech") {
        setMicError(null);
      } else {
        setMicError("Problème de reconnaissance vocale. Réessayez.");
      }
    };
    rec.onend = () => setListening(false);
    try {
      rec.start();
      recRef.current = rec;
      setListening(true);
    } catch {
      setListening(false);
    }
  };

  const toggleMic = () => (listening ? stopListening() : startListening());

  const pickLang = (code) => {
    setMicLang(code);
    try { localStorage.setItem(MIC_LANG_KEY, code); } catch {}
    setLangMenu(false);
    if (listening) { stopListening(); setTimeout(startListening, 120); }
  };

  const currentLang = SR_LANGS.find(l => l.code === micLang) || SR_LANGS[0];

  const deleteLigne = id => setLignes(l => l.filter(x => x.id !== id));

  const finalizeSave = (clientId) => {
    const ht2     = lignes.filter(l => l.type_ligne === "ouvrage").reduce((s, l) => s + (l.quantite || 0) * (l.prix_unitaire || 0), 0);
    const picked  = clientId ? clients.find(c => c.id === clientId) : null;
    const newId   = uid();
    onCreateDevis({
      id: newId,
      numero: `DEV-${new Date().getFullYear()}-${String(devis.length + 1).padStart(4, "0")}`,
      objet: objet || "Devis IA",
      client_id: clientId || null,
      ville_chantier: picked?.ville || "",
      statut: "brouillon",
      montant_ht: ht2,
      tva_rate: 20,
      date_emission: new Date().toISOString().split("T")[0],
      lignes,
      odoo_sign_url: null,
    });
    setPickingClient(false);
    setLignes([]); setObjet("");
    setMsgs([{ role: "assistant", content: TX.quoteSaved }]);
    // Ouvre directement la vue PDF du devis fraîchement enregistré
    if (onOpenDevisPDF) onOpenDevisPDF(newId);
    else setTimeout(() => setTab("devis"), 2500);
  };

  const visibleLignes = lignes.slice(0, visibleCount);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#f8fafc" }}>
      <style>{`
        @keyframes bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}
        @keyframes slideIn{from{opacity:0;transform:translateX(-14px) scale(.97)}to{opacity:1;transform:translateX(0) scale(1)}}
        @keyframes rowPop{0%{opacity:0;transform:translateY(6px) scaleY(.85)}100%{opacity:1;transform:translateY(0) scaleY(1)}}
        @keyframes totalCount{from{opacity:0;transform:scale(.8)}to{opacity:1;transform:scale(1)}}
      `}</style>

      {/* ═══ HAUT : aperçu devis en cours ═══════════════════ */}
      <div style={{ flexShrink: 0, background: "white", borderBottom: "2px solid #f1f5f9", minHeight: 110, maxHeight: "45%", display: "flex", flexDirection: "column", overflow: "hidden" }}>

        {/* En-tête branding */}
        <div style={{ background: ac, padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {brand.logo
              ? <img src={brand.logo} alt="" style={{ height: 32, maxWidth: 100, objectFit: "contain" }}/>
              : <span style={{ fontFamily, fontWeight: 800, fontSize: 15, color: "white" }}>{brand.companyName || "Votre entreprise"}</span>
            }
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontFamily, color: "rgba(255,255,255,.6)", fontSize: 9, letterSpacing: "1.5px", fontWeight: 600 }}>{TX.quoteInProgress.toUpperCase()}</div>
            <div style={{ fontFamily, color: "white", fontWeight: 800, fontSize: 18, marginTop: 2, animation: "totalCount .3s ease both" }}>
              {fmt(ht)} <span style={{ fontSize: 10, fontWeight: 400, color: "rgba(255,255,255,.7)", marginLeft: 4 }}>HT</span>
            </div>
          </div>
        </div>

        {/* Objet du devis */}
        {objet && (
          <div style={{ background: "#0f172a", padding: "6px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontFamily, color: "rgba(255,255,255,.9)", fontSize: 12, fontWeight: 600 }}>{objet}</span>
            <span style={{ color: "#64748b", fontSize: 10 }}>{lignes.filter(l => l.type_ligne === "ouvrage").length} ligne{lignes.filter(l => l.type_ligne === "ouvrage").length > 1 ? "s" : ""}</span>
          </div>
        )}

        {/* Tableau des lignes */}
        <div style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
          {visibleLignes.length === 0 ? (
            <div style={{ padding: "20px 16px", textAlign: "center" }}>
              <div style={{ fontSize: 24, marginBottom: 8 }}>📋</div>
              <div style={{ fontSize: 12, color: "#94a3b8", fontWeight: 500 }}>Les lignes du devis apparaîtront ici</div>
              <div style={{ fontSize: 11, color: "#cbd5e1", marginTop: 4 }}>Décrivez votre besoin ci-dessous</div>
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead style={{ position: "sticky", top: 0, background: "white", zIndex: 1 }}>
                <tr style={{ borderBottom: "1px solid #f1f5f9" }}>
                  <th style={{ textAlign: "left",  padding: "6px 14px", fontSize: 9, fontWeight: 600, color: "#94a3b8", letterSpacing: "1px" }}>DÉSIGNATION</th>
                  <th style={{ textAlign: "right", padding: "6px 8px",  fontSize: 9, fontWeight: 600, color: "#94a3b8", width: 50 }}>QTÉ</th>
                  <th style={{ textAlign: "right", padding: "6px 8px",  fontSize: 9, fontWeight: 600, color: "#94a3b8", width: 65 }}>P.U. HT</th>
                  <th style={{ textAlign: "right", padding: "6px 14px", fontSize: 9, fontWeight: 600, color: "#94a3b8", width: 75 }}>TOTAL HT</th>
                  <th style={{ width: 28 }}/>
                </tr>
              </thead>
              <tbody>
                {visibleLignes.map((l, idx) => {
                  if (l.type_ligne === "lot") return (
                    <tr key={l.id} style={{ animation: "slideIn .25s ease both", animationDelay: `${idx * 0.05}s` }}>
                      <td colSpan={5} style={{ background: ac + "18", padding: "7px 14px", borderBottom: "1px solid " + ac + "22" }}>
                        <span style={{ fontFamily, fontSize: 10, fontWeight: 700, color: ac, textTransform: "uppercase", letterSpacing: "1px" }}>{l.designation}</span>
                      </td>
                    </tr>
                  );
                  const total = (l.quantite || 0) * (l.prix_unitaire || 0);
                  return (
                    <tr key={l.id} style={{ borderBottom: "1px solid #f8fafc", animation: "rowPop .3s cubic-bezier(.34,1.3,.64,1) both", animationDelay: `${idx * 0.06}s` }}>
                      <td style={{ padding: "8px 14px" }}>
                        <div style={{ fontSize: 12, fontWeight: 500, color: "#1e293b", fontFamily }}>{l.designation}</div>
                        <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 1, display: "flex", alignItems: "center", gap: 6 }}>
                          <span>{l.unite}</span>
                          <button
                            onClick={() => {
                              if (brand.vatRegime === "franchise") return;
                              const cycle = [20, 10, 5.5];
                              const cur   = Number(l.tva_rate ?? 20);
                              const next  = cycle[(cycle.indexOf(cur) + 1) % cycle.length];
                              setLignes(prev => prev.map(x => x.id === l.id ? { ...x, tva_rate: next } : x));
                            }}
                            disabled={brand.vatRegime === "franchise"}
                            title={brand.vatRegime === "franchise" ? "Franchise en base (art. 293 B du CGI)" : "Cliquer pour changer le taux de TVA"}
                            style={{ background: "#eef2f7", color: "#475569", border: "none", borderRadius: 4, padding: "1px 6px", fontSize: 9, fontWeight: 600, cursor: brand.vatRegime === "franchise" ? "default" : "pointer" }}>
                            TVA {(l.tva_rate ?? (brand.vatRegime === "franchise" ? 0 : 20)).toString().replace(".", ",")}%
                          </button>
                        </div>
                      </td>
                      <td style={{ padding: "8px", textAlign: "right", fontSize: 12, color: "#374151", fontWeight: 600 }}>{l.quantite}</td>
                      <td style={{ padding: "8px", textAlign: "right", fontSize: 11, color: "#64748b" }}>{fmt(l.prix_unitaire)}</td>
                      <td style={{ padding: "8px 14px", textAlign: "right", fontSize: 12, fontWeight: 700, color: "#0f172a" }}>{fmt(total)}</td>
                      <td style={{ padding: "4px" }}>
                        <button onClick={() => deleteLigne(l.id)}
                          style={{ background: "none", border: "none", cursor: "pointer", color: "#e2e8f0", fontSize: 14, lineHeight: 1, padding: "2px 4px" }}
                          onMouseOver={e => e.target.style.color = "#ef4444"}
                          onMouseOut={e => e.target.style.color = "#e2e8f0"}>×</button>
                      </td>
                    </tr>
                  );
                })}

                {/* Indicateur d'ajout en cours */}
                {visibleCount < lignes.length && (
                  <tr><td colSpan={5} style={{ padding: "8px 14px" }}>
                    <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
                      {[0, 1, 2].map(i => (
                        <div key={i} style={{ width: 5, height: 5, borderRadius: "50%", background: ac, animation: `bounce .8s ease ${i * 150}ms infinite` }}/>
                      ))}
                      <span style={{ fontSize: 10, color: "#94a3b8", marginLeft: 4 }}>Ajout en cours…</span>
                    </div>
                  </td></tr>
                )}
              </tbody>

              {/* Totaux */}
              {ht > 0 && visibleCount >= lignes.length && (
                <tfoot>
                  <tr style={{ borderTop: `2px solid ${ac}` }}>
                    <td colSpan={3} style={{ padding: "8px 14px", fontSize: 12, fontWeight: 700, color: "#0f172a", fontFamily }}>Total HT</td>
                    <td style={{ padding: "8px 14px", textAlign: "right", fontSize: 14, fontWeight: 800, color: ac, fontFamily, animation: "totalCount .4s ease both" }}>{fmt(ht)}</td>
                    <td/>
                  </tr>
                  {tvaRows.map(row => (
                    <tr key={row.rate} style={{ background: "#f8fafc" }}>
                      <td colSpan={3} style={{ padding: "4px 14px", fontSize: 11, color: "#64748b" }}>
                        TVA {row.rate.toString().replace(".", ",")}% <span style={{ color: "#cbd5e1", fontSize: 10 }}>(sur {fmt(row.base)})</span>
                      </td>
                      <td style={{ padding: "4px 14px", textAlign: "right", fontSize: 11, color: "#64748b" }}>{fmt(row.montant)}</td>
                      <td/>
                    </tr>
                  ))}
                  <tr style={{ background: ac }}>
                    <td colSpan={3} style={{ padding: "8px 14px", fontSize: 13, fontWeight: 800, color: "white", fontFamily }}>Total TTC</td>
                    <td style={{ padding: "8px 14px", textAlign: "right", fontSize: 15, fontWeight: 800, color: "white", fontFamily }}>{fmt(ttc)}</td>
                    <td/>
                  </tr>
                </tfoot>
              )}
            </table>
          )}
        </div>

        {/* Boutons Enregistrer / Effacer */}
        {lignes.length > 0 && visibleCount >= lignes.length && (
          <div style={{ padding: "10px 14px", borderTop: "1px solid #f1f5f9", display: "flex", gap: 8, flexShrink: 0, animation: "fadeUp .3s ease both" }}>
            <button onClick={() => { setLignes([]); setObjet(""); }}
              style={{ flex: 1, background: "none", border: "1px solid #e2e8f0", borderRadius: 10, padding: 9, fontSize: 12, color: "#64748b", cursor: "pointer", fontWeight: 500 }}>
              {TX.clearQuote}
            </button>
            <button onClick={() => setPickingClient(true)}
              style={{ flex: 2, background: ac, color: "white", border: "none", borderRadius: 10, padding: 9, fontSize: 13, fontWeight: 700, cursor: "pointer", boxShadow: `0 3px 10px ${ac}55` }}>
              {TX.saveQuote}
            </button>
          </div>
        )}
      </div>

      {/* ═══ BAS : chat ══════════════════════════════════════ */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>

        {/* Messages */}
        <div ref={chatRef} style={{ flex: 1, overflowY: "auto", padding: "12px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
          {historySummary && (
            <div title="L'IA utilise vos devis passés pour proposer des tarifs cohérents avec votre historique"
              style={{ alignSelf: "center", display: "flex", alignItems: "center", gap: 6, background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 20, padding: "4px 11px", fontSize: 10, fontWeight: 600, color: "#15803d", marginBottom: 4 }}>
              <svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
              Mémoire active · {historySummary.total} devis · {historySummary.topOuvrages.length} ouvrages référencés
            </div>
          )}
          {msgs.map((m, i) => (
            <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start", alignItems: "flex-end", gap: 6 }}>
              {m.role === "assistant" && (
                <div style={{ width: 24, height: 24, borderRadius: "50%", background: ac + "22", border: `1px solid ${ac}44`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: ac, fontSize: 12 }}>✦</div>
              )}
              <div style={{
                maxWidth: "82%",
                borderRadius: m.role === "user" ? "16px 16px 3px 16px" : "16px 16px 16px 3px",
                padding: "9px 13px", fontSize: 12, lineHeight: 1.55,
                background: m.role === "user" ? "#0f172a" : "white",
                color: m.role === "user" ? "white" : "#1e293b",
                boxShadow: m.role === "assistant" ? "0 1px 4px rgba(0,0,0,.07)" : "none",
                border: m.role === "assistant" ? "1px solid #f1f5f9" : "none",
              }}>
                {m.content.split("\n").map((line, j, arr) => (
                  <span key={j}>{line.replace(/\*([^*]+)\*/g, "$1")}{j < arr.length - 1 && <br/>}</span>
                ))}
              </div>
            </div>
          ))}

          {loading && msgs[msgs.length - 1]?.role !== "assistant" && (
            <div style={{ display: "flex", alignItems: "flex-end", gap: 6 }}>
              <div style={{ width: 24, height: 24, borderRadius: "50%", background: ac + "22", border: `1px solid ${ac}44`, display: "flex", alignItems: "center", justifyContent: "center", color: ac, fontSize: 12 }}>✦</div>
              <div style={{ background: "white", border: "1px solid #f1f5f9", borderRadius: "16px 16px 16px 3px", padding: "10px 14px", display: "flex", gap: 4, boxShadow: "0 1px 4px rgba(0,0,0,.07)" }}>
                {[0, 140, 280].map(d => <div key={d} style={{ width: 6, height: 6, borderRadius: "50%", background: ac, animation: `bounce 1s ease ${d}ms infinite` }}/>)}
              </div>
            </div>
          )}
        </div>

        {/* Zone de saisie */}
        <div style={{ padding: "10px 14px 12px", background: "white", borderTop: "1px solid #f1f5f9", flexShrink: 0, position: "relative" }}>
          <style>{`
            @keyframes micPulse{0%{box-shadow:0 0 0 0 rgba(239,68,68,.55),0 6px 18px rgba(239,68,68,.45)}70%{box-shadow:0 0 0 16px rgba(239,68,68,0),0 6px 18px rgba(239,68,68,.45)}100%{box-shadow:0 0 0 0 rgba(239,68,68,0),0 6px 18px rgba(239,68,68,.45)}}
            @keyframes micWave{0%,100%{transform:scaleY(.4)}50%{transform:scaleY(1)}}
          `}</style>

          {/* Champ texte + envoyer */}
          <div style={{ display: "flex", gap: 8, alignItems: "flex-end", background: "#f8fafc", borderRadius: 14, border: `1.5px solid ${listening ? "#ef4444" : (input.trim() ? ac : "#e2e8f0")}`, padding: "8px 10px", transition: "border-color .2s" }}>
            <textarea ref={inputRef} value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder={listening ? "Écoute en cours…" : TX.inputPlaceholder}
              rows={1} style={{ flex: 1, background: "none", border: "none", outline: "none", fontSize: 16, color: "#1e293b", resize: "none", fontFamily: "inherit", lineHeight: 1.5, maxHeight: 120, overflowY: "auto" }}/>
            <button onClick={send} disabled={!input.trim() || loading}
              style={{ width: 34, height: 34, borderRadius: 10, background: input.trim() && !loading ? ac : "#d1fae5", border: "none", display: "flex", alignItems: "center", justifyContent: "center", color: "white", cursor: "pointer", transition: "background .2s", flexShrink: 0 }}>
              {I.send}
            </button>
          </div>

          {/* Sélecteur langue + bouton micro — layout compact horizontal */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginTop: 8, position: "relative" }}>
            <button
              onClick={() => setLangMenu(v => !v)}
              style={{ background: "#f1f5f9", border: "1px solid #e2e8f0", borderRadius: 20, padding: "3px 9px", fontSize: 11, fontWeight: 600, color: "#334155", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
              <span>{currentLang.flag}</span>
              <span>{currentLang.label}</span>
              <span style={{ fontSize: 9, color: "#94a3b8" }}>▾</span>
            </button>

            <span style={{ fontSize: 11, color: listening ? "#ef4444" : "#64748b", fontWeight: 500 }}>
              {listening ? "Parlez, je transcris…" : (micSupported ? "Appuyez pour dicter" : "Vocal indisponible")}
            </span>

            <button
              onClick={toggleMic}
              disabled={!micSupported}
              title={micSupported ? (listening ? "Appuyez pour arrêter" : "Appuyez pour parler") : "Non supporté par ce navigateur"}
              style={{
                width: 44, height: 44, borderRadius: "50%",
                background: listening ? "#ef4444" : (micSupported ? ac : "#cbd5e1"),
                border: "none", cursor: micSupported ? "pointer" : "not-allowed",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "white",
                boxShadow: listening
                  ? "0 0 0 0 rgba(239,68,68,.55), 0 4px 12px rgba(239,68,68,.4)"
                  : `0 4px 12px ${ac}55`,
                transition: "background .2s, transform .15s",
                animation: listening ? "micPulse 1.4s ease-out infinite" : "none",
                flexShrink: 0,
              }}>
              {listening ? (
                <div style={{ display: "flex", gap: 2, alignItems: "center", height: 16 }}>
                  {[0, 1, 2, 3, 4].map(i => (
                    <div key={i} style={{ width: 2.5, height: 14, borderRadius: 2, background: "white", animation: `micWave .9s ease-in-out ${i * 0.12}s infinite` }}/>
                  ))}
                </div>
              ) : <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M12 14a3 3 0 003-3V5a3 3 0 00-6 0v6a3 3 0 003 3z"/><path d="M19 11a1 1 0 10-2 0 5 5 0 01-10 0 1 1 0 10-2 0 7 7 0 006 6.92V20H8a1 1 0 100 2h8a1 1 0 100-2h-3v-2.08A7 7 0 0019 11z"/></svg>}
            </button>

            {langMenu && (
              <>
                <div onClick={() => setLangMenu(false)} style={{ position: "fixed", inset: 0, zIndex: 40 }}/>
                <div style={{ position: "absolute", bottom: "calc(100% + 6px)", left: 0, background: "white", border: "1px solid #e2e8f0", borderRadius: 12, boxShadow: "0 10px 28px rgba(15,23,42,.18)", padding: 4, zIndex: 41, maxHeight: 260, overflowY: "auto", minWidth: 180 }}>
                  {SR_LANGS.map(l => (
                    <button key={l.code} onClick={() => pickLang(l.code)}
                      style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", background: l.code === micLang ? "#f0fdf4" : "none", border: "none", padding: "8px 10px", borderRadius: 8, cursor: "pointer", fontSize: 12, color: "#0f172a", textAlign: "left" }}>
                      <span style={{ fontSize: 14 }}>{l.flag}</span>
                      <span style={{ fontWeight: l.code === micLang ? 700 : 500, flex: 1 }}>{l.label}</span>
                      {l.code === micLang && <span style={{ color: ac, fontSize: 12 }}>✓</span>}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {micError && (
            <div style={{ fontSize: 11, color: "#991b1b", background: "#fef2f2", border: "1px solid #fecaca", padding: "5px 10px", borderRadius: 8, marginTop: 6, textAlign: "center" }}>
              {micError}
            </div>
          )}
        </div>
      </div>

      {pickingClient && (
        <ClientPickerModal
          clients={clients}
          ac={ac}
          fontFamily={fontFamily}
          onSaveClient={onSaveClient}
          onPick={finalizeSave}
          onClose={() => setPickingClient(false)}
        />
      )}
    </div>
  );
}
