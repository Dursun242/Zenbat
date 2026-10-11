---
version: 1
slug: "src-components-agentia-jsx"
primary_target: "src/components/AgentIA.jsx"
related_targets: ["src/components/agent/ChatThread.jsx"]
---

# Surface : écran Agent IA (rédaction du devis par dictée)

Mode : Operate. Build : code-led (écran applicatif). Direction épinglée par l'utilisateur : « Bordereau » (pas de tirage concept-seed).

Audience et tâche : l'artisan décrit ou dicte des travaux (dans sa langue) ; l'IA remplit un devis en français, par lots ; il ajuste une ligne, puis enregistre le devis pour un client. Fréquence : plusieurs fois par semaine, sur chantier au téléphone ou le soir sur ordinateur. États : vierge, rédaction en cours, devis rempli, ajout de lignes, erreur IA / réseau, quota atteint, dictée active.

Décisions confirmées (2026-10-11) : le devis d'abord (la dernière réponse de l'IA en note courte, historique sur demande) ; micro appui pour démarrer / appui pour arrêter et envoyer ; écran vide = bordereau vierge à l'en-tête de l'entreprise + 3 exemples du métier, plus de tuto en 3 étapes ; tutoiement.

## Direction contract

THESIS : l'écran est le devis lui-même, un bordereau de prix qui se remplit pendant qu'on parle. Il refuse la conversation de chat en bulles avec un aperçu de devis coincé au-dessus.

OWN-WORLD : papier #FBFAF7, encre #1A1612, secondaire #5C544B, filets #D9D2C5, un seul accent terre cuite foncée #A4461F (action principale, sélection), tampon vert #1E7B3C. Archivo pour tout, chiffres tabulaires pour les montants. Filets fins, aucune carte arrondie empilée, aucune ombre décorative.

STORY : l'artisan comprend en un regard que ce qu'il dicte devient des lignes chiffrées ; il voit le total monter ; il corrige d'un appui ; il enregistre.

FIRST VIEWPORT : en haut, l'en-tête du bordereau (entreprise, objet modifiable, nombre de lignes) ; au centre, les lots en sections tracées, sous-total de lot dans la marge droite, lignes Désignation / Qté / PU / Total ; en bas, le total TTC en grand puis l'action « Enregistrer le devis » ; collée au-dessus de la barre de navigation, la barre de dictée permanente : champ « Dicte ou écris tes travaux… », langue, gros bouton micro. Vide : bordereau vierge réglé et trois exemples du métier.

FORM : direction B « Bordereau » épinglée par l'utilisateur, première de la liste présentée ; seed key : aucune (direction épinglée).
Signature move : les lignes s'inscrivent une à une dans le bordereau pendant la rédaction, et le total de lot se met à jour dans la marge.

FINISH : unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
