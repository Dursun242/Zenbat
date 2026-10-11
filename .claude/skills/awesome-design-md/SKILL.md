---
name: awesome-design-md
description: Bibliothèque de 74 fichiers DESIGN.md (systèmes de design analysés de sites réels — Apple, Stripe, Linear, Airbnb, Notion, Vercel, Tesla, etc. — couleurs, typographie, espacements, composants). À utiliser quand l'utilisateur veut un rendu « dans le style de » une marque ou un site, demande un DESIGN.md, ou cherche une direction visuelle de référence pour une page ou un composant.
---

# Awesome DESIGN.md

Collection de systèmes de design au format DESIGN.md (concept Google Stitch) : chaque fichier décrit en Markdown + front-matter YAML les tokens (couleurs, typo, rayons, ombres, espacements), les composants et les règles d'usage d'un site réel.

## Utilisation

1. Identifier la ou les références demandées (« comme Stripe », « style Apple », « sobre et éditorial »…). Si aucune n'est nommée, proposer 2–3 candidats pertinents dans l'index ci-dessous.
2. Lire `designs/<nom>/DESIGN.md` (seulement les fichiers utiles — ils font 20–40 Ko chacun).
3. Traduire les tokens dans la stack du projet (ici Tailwind 3 : `theme.extend` dans `tailwind.config.js`, variables CSS dans `src/index.css`) plutôt que de copier des valeurs en dur dans les composants.
4. S'inspirer du langage visuel, sans reprendre logos, noms de marque, polices propriétaires non licenciées ni contenus : prévoir des polices de substitution libres (Google Fonts / Fontsource).
5. Pour fixer une direction durable, copier le DESIGN.md retenu (adapté à l'identité du projet) à la racine du projet en `DESIGN.md`.

Se combine bien avec le skill `design-taste-frontend` : celui-ci pour la méthode et le contrôle qualité, celui-là pour les références concrètes.

## Index des designs (`designs/<nom>/DESIGN.md`)

- `airbnb` — A warm, generous consumer marketplace anchored on a clean white canvas and Airbnb Rausch (#ff385c), the single brand voltage that carries every primary CTA, sea
- `airtable` — A sober, editorial workflow-software interface anchored on white canvas and dark-ink type, where brand voltage comes from full-bleed signature cards in coral, d
- `apple` — A photography-first interface that turns marketing into a museum gallery. Edge-to-edge product tiles alternate light and dark canvases, framed by SF Pro Display
- `binance` — A confident financial-platform interface anchored on a deep near-black canvas, where Binance's iconic yellow (#FCD535) carries every primary CTA, brand accent, 
- `bmw` — BMW's corporate site — distinct from BMW M's motorsport-bombastic variant, this is a measured and settled corporate-automotive interface. On a light (cream-ti
- `bmw-m` — A motorsport-engineering interface anchored on a near-black canvas with white BMW Type Next Latin display headlines in confident UPPERCASE. The brand carries no
- `bugatti` — An austere luxury-automotive interface that uses near-pure black canvas, white uppercase letterspaced display, and full-bleed automotive photography as the only
- `cal` — A clean, calendar-software-first interface anchored on white canvas with black primary CTAs and custom Cal Sans display typography. The system reads as friendly
- `claude` — A warm-canvas editorial interface for Anthropic's Claude product. The system anchors on a tinted cream canvas with serif display headlines, warm coral CTAs, and
- `clay` — A vibrant claymation-meets-data interface for Clay.com (GTM data-orchestration platform). Anchors on white canvas with dark-navy primary CTAs, custom rounded di
- `clickhouse` — A high-performance database interface anchored on near-pure black canvas with electric yellow as the brand voltage. White typography in confident sans, yellow C
- `cohere` — Cohere's 2026 web system is a controlled enterprise AI interface built from stark white editorial space, deep green-black product bands, soft mineral surfaces, 
- `coinbase` — An institutional-grade crypto exchange whose marketing surfaces read like a quietly-confident financial-services brand. The base canvas is pure white; Coinbase 
- `composio` — A developer-tools brand for AI-agent tool integration whose marketing surfaces lean into a dark, technical aesthetic with a single deep-electric-blue voltage (`
- `cursor` — An AI-first code editor whose marketing site reads like a quietly-confident developer-tools brand with a warm-cream editorial canvas (`#f7f7f4`) instead of the 
- `dell-1996` — An inspired interpretation of Dell.com's 1996 design language — a catalog-era enterprise web design built around a literal black page frame, vivid flat color-
- `elevenlabs` — A voice-AI brand whose marketing surfaces read like a quietly editorial print magazine. The base canvas is off-white (`#f5f5f5`) holding warm near-black ink (`#
- `expo` — A React Native developer-platform whose marketing site reads like a quietly-confident infrastructure brand. The base canvas is pure white with a soft sky-blue g
- `ferrari` — A luxury-automotive brand whose marketing surfaces read as cinematic editorial. The base canvas is **near-black** (`#181818`) holding pure white display type; w
- `figma` — A confident black-and-white editorial frame interrupted by oversized, hand-cut pastel color blocks. The marketing canvas is rigorously monochrome — figmaSans 
- `framer` — A confident dark-canvas builder marketing site that treats the page like a working artboard — pure black surfaces, white display type set in GT Walsheim Mediu
- `hashicorp` — An enterprise-infrastructure marketing canvas built around a near-black ground (#000000) and a system of per-product accent colors — Terraform purple, Vault y
- `hp` — An inspired interpretation of HP's design language — a white-paper enterprise-consumer system anchored by HP Electric Blue (`#024ad8`) as the lone signal CTA,
- `ibm` — An enterprise-marketing canvas faithful to Carbon Design System: white surfaces, charcoal type, IBM Blue (#0f62fe) as the single confident accent, and a deliber
- `intercom` — An editorial customer-service marketing canvas built around a soft cream-white ground, charcoal type set in Saans (Intercom's proprietary geometric sans), and a
- `kraken`
- `lamborghini`
- `linear.app` — A near-black product-focused marketing canvas built around #010102 (the deepest dark surface of any tool in this collection), light gray text (#f7f8f8), and the
- `lovable`
- `mastercard`
- `meta` — Meta's design system spans hardware commerce (Quest VR, Ray-Ban Meta AI glasses) and brand surfaces with a confident product-merchandising voice. The system pai
- `minimax` — MiniMax presents itself as a premium AI infrastructure brand through a striking duality — bold black-pill CTAs and stark white canvas for marketing, paired wi
- `mintlify` — Mintlify presents documentation infrastructure with a dual-mode aesthetic — atmospheric sky-gradient marketing heroes (cloud illustration backdrops, soft crea
- `miro` — Miro presents itself as the AI-powered visual workspace through a confident, almost playful brand voice — anchored by its signature canary yellow ({colors.bra
- `mistral.ai` — Mistral AI brands itself with a singular signature — atmospheric sunset gradients (mustard, orange, deep red) layered over photography of mountains, plus a ho
- `mongodb` — MongoDB carries a strong dual-mode visual identity — dark deep-teal hero bands with bright MongoDB green ({colors.brand-green}) CTAs paired with stark white d
- `nike` — |
- `nintendo-2001` — An analysis of Nintendo.com's 2001 design language — a brushed-periwinkle "console chrome" interface where every panel is a beveled metal plate, navigation gl
- `notion` — Notion presents itself as the all-in-one workspace through a confident, illustration-rich brand voice — anchored by a deep navy hero band ({colors.brand-navy}
- `nvidia` — |
- `ollama` — |
- `opencode.ai` — |
- `pinterest` — |
- `playstation` — |
- `posthog` — |
- `raycast` — |
- `renault` — |
- `replicate` — |
- `resend` — |
- `revolut` — |
- `runwayml`
- `sanity`
- `sentry` — An inspired interpretation of Sentri's design language — a developer-tools brand built on a deep purple-violet midnight canvas, electric lime accents, and a s
- `shopify` — An inspired interpretation of Shopifi's design language — a cinematic commerce platform that runs two parallel design tracks. The marketing-hero and product-n
- `slack` — An inspired interpretation of Slacc's design language — a workplace messaging brand built on a deep aubergine primary, with cream-lavender hero gradients, blu
- `spacex` — An inspired interpretation of Spasex's design language — a mission-oriented aerospace brand built on pure black canvas, full-bleed photographic and video hero
- `spotify`
- `starbucks`
- `stripe` — An inspired interpretation of Stripi's design language — a financial-infrastructure brand built on a deep navy ink, an electric indigo primary, and a recurrin
- `supabase` — An inspired interpretation of Supabaze's design language — an open-source database platform built on a clean white-and-near-black system with a single signatu
- `superhuman` — An inspired interpretation of Superhumon's design language — a fast-email productivity brand split between an editorial dark hero (deep indigo navy with viole
- `tesla`
- `theverge`
- `together.ai` — An inspired interpretation of Together AI's design language — an AI infrastructure platform whose surface alternates between near-black hero bands (with a thr
- `uber` — An inspired interpretation of Uber's design language — a transportation-and-delivery super-app brand whose web surface is a black-and-white duet, framed by a 
- `vercel` — An inspired interpretation of Vercel's design language — a developer-platform brand whose surface is a stark black-and-ink duet on near-white canvas, broken a
- `vodafone` — An inspired interpretation of Vodafone's design language — a telecom super-brand whose web surface alternates between editorial photography hero bands with ma
- `voltagent` — An inspired interpretation of Voltagent's design language — a developer-focused AI agent engineering platform whose surface is an unrelenting near-black canva
- `warp` — An inspired interpretation of Warp's design language — an agentic terminal-and-development-environment brand whose surface is a warm near-charcoal canvas (a t
- `webflow` — An inspired interpretation of Webflow's design language — a visual web development platform whose surface contrasts a deep near-black `#080808` primary agains
- `wired` — An inspired interpretation of Wired's design language — a flagship technology-magazine brand whose surface is a strict editorial duet of stark black wordmark 
- `wise` — An inspired interpretation of Wise's design language — a global money-transfer brand whose surface combines an unusually heavy near-black display sans (weight
- `x.ai` — An inspired interpretation of xAI's design language — Elon Musk's frontier-AI company whose web surface is a strict near-black canvas broken only by white pil
- `zapier` — An inspired interpretation of Zapier's design language — a workflow-automation platform whose surface combines warm-cream neutrals (`#fffefb` canvas, `#f8f4f0
