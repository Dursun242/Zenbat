# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

PWA installable (iPhone et Android en priorité, écran d'accueil, mode standalone) et utilisation sur ordinateur (barre latérale au-delà de 1024 px). Une seule base React + Vite.

## Users

Artisans du BTP français, TPE et indépendants (maçonnerie, plomberie, électricité, peinture, carrelage, menuiserie, rénovation…), souvent seuls ou avec quelques compagnons, sans secrétariat. Beaucoup ne sont pas de langue maternelle française.

Usage partagé à parts égales :
- **sur chantier, au téléphone** : décrire ou dicter les travaux à chiffrer, souvent debout, d'une main, interrompu, parfois en plein soleil ;
- **sur ordinateur, le soir ou au bureau** : relire, ajuster les lignes, envoyer le devis, facturer, suivre les paiements.

Audiences secondaires : le **client de l'artisan** (particulier ou entreprise), qui consulte et signe le devis sur une page publique sans compte ; le **comptable**, qui reçoit l'export des factures ; l'**administrateur** Zenbat (panneau admin, CRM de prospection).

## Product Purpose

Faire passer un artisan d'une description de chantier à un devis signé puis à une facture conforme, en quelques minutes et sans compétence administrative. Succès : le devis part le jour même de la visite, le client signe en ligne, la facture est émise et payée sans ressaisie.

## Positioning

- **Dictée IA multilingue** : l'artisan décrit les travaux à l'écrit ou à la voix dans sa langue (français, arabe, darija, anglais, espagnol, portugais, italien, allemand, turc, roumain, polonais, russe) ; l'IA rédige le devis complet en français, par lots, avec des prix cohérents avec son historique et des repères par type de chantier.
- **Rapidité et simplicité** : un devis prêt en quelques minutes depuis le chantier, sans formation.
- **Chaîne complète conforme** : signature client en ligne (code par email, horodatage, PDF signé), acompte et solde, facture électronique Factur-X (réforme 2026), avoirs, export comptable.
- **Prix** : gratuit pour démarrer (5 devis par semaine), Pro à 19 € TTC / mois ou 57 € TTC / 6 mois.

## Operating Context

- Le devis naît souvent pendant ou juste après la visite de chantier, au téléphone ; il est relu et envoyé plus tard, souvent sur ordinateur.
- Documents produits : devis (indices A, B, C… quand il est révisé), factures, factures d'acompte et de solde, avoirs, pro forma. Le PDF porte l'identité de l'artisan (logo, couleur choisie, mentions légales), pas celle de Zenbat.
- Vocabulaire métier : lot, ouvrage, prestation, unité (m², ml, u, forfait…), prix unitaire HT, TVA 5,5 / 10 / 20 %, autoliquidation (sous-traitance), franchise en base (art. 293 B), retenue de garantie, acompte, solde, indice, avoir.
- Le client reçoit un email « Consulter votre devis », ouvre une page publique, se vérifie par code, peut accepter, refuser ou demander des modifications ligne par ligne.

## Capabilities and Constraints

- Agent IA de rédaction (Claude ou Mistral), dictée vocale du navigateur, mémoire des prix et prestations de l'artisan.
- Devis : lots et lignes, duplication, indices, envoi par email, lien public, signature, négociation, conversion en facture, acompte / solde ventilés par taux de TVA.
- Factures : émission définitive et verrouillée (CGI art. 289), Factur-X, statut de paiement, envoi au client, avoirs, export comptable.
- Clients (particuliers, entreprises), tableau de bord, support (chat + escalade), onboarding en 6 étapes (identité, mentions légales, logo, couleur…).
- Contraintes : quotas (5 devis / semaine en gratuit ; 40 appels IA / jour en gratuit, 200 en Pro ; 60 emails / jour), hors ligne partiel, iOS PWA (zones de sécurité, clavier), 12 fonctions serverless maximum (Vercel Hobby).
- Une facture émise ne se modifie plus : elle se corrige par un avoir.

## Brand Commitments

- Nom : **Zenbat** (logo existant : « Zen » terre cuite + « bat », `src/components/ui/Logo`, icônes PWA dans `public/`).
- **Tutoiement** dans toute l'application (l'artisan est traité comme un collègue du métier). Les documents et emails destinés au client de l'artisan restent au vouvoiement.
- Le PDF et la page publique représentent l'**artisan** (sa couleur, son logo) ; l'interface de l'application représente **Zenbat**. Les deux identités ne se mélangent pas.

## Evidence on Hand

- Tarifs : `src/components/landing/PricingSection.jsx`.
- Avis : note Google / Trustpilot affichée sur la landing (widgets tiers) ; aucun témoignage client rédigé dans le dépôt, ne pas en inventer.
- Aucune statistique d'usage publique (nombre d'artisans, devis générés) : ne pas en inventer.

## Product Principles

1. **Du chantier au devis signé sans ressaisie** : chaque écran fait avancer le document d'un statut, une action principale à la fois.
2. **Le document est la vérité** : ce que l'artisan voit à l'écran correspond à ce que son client reçoit (montants, TVA, mentions).
3. **Parler plutôt que taper** : la voix et la langue de l'artisan sont des entrées de premier rang.
4. **Irréversible = explicite** : envoi au client, émission de facture et signature sont confirmés, récapitulés et célébrés.
5. **Conforme sans effort** : les obligations légales (mentions, Factur-X, verrouillage) sont appliquées par défaut, pas laissées à l'artisan.

## Accessibility & Inclusion

- Lisible en extérieur (plein soleil) et au toucher avec des mains abîmées ou gantées : contrastes WCAG AA minimum, cibles tactiles ≥ 44 px, pas de texte informatif sous 12 px.
- Public non francophone natif : libellés courts et concrets, vocabulaire du métier plutôt que jargon informatique, entrée vocale multilingue.
