# sRGB ICC profile

Placez ici le fichier **`sRGB.icc`** (profil sRGB IEC61966-2.1).

## Où le télécharger (gratuit, sans compte)

- **ICC officiel** : https://www.color.org/srgbprofiles.xalter
  - Fichier recommandé : `sRGB_IEC61966-2-1_black_scaled.icc` (3 KB, suffit pour Factur-X)
  - Autre option : `sRGB_v4_ICC_preference.icc` (560 KB, plus récent)

- **Alternative (mêmes sources)** :
  - https://github.com/saucecontrol/Compact-ICC-Profiles → profils minimaux valides (1-2 KB)

## Installation

1. Télécharge le fichier `.icc` choisi.
2. Renomme-le en `sRGB.icc` et place-le dans ce dossier (`public/icc/sRGB.icc`).
3. Commit + push → la fonction `api/facturx.js` le détectera automatiquement
   au prochain déploiement Vercel et l'embarquera dans chaque PDF Factur-X.

Sans ce fichier, la fonction serveur continue de tourner mais ne peut pas
générer un OutputIntent conforme PDF/A-3 → le validateur FNFE-MPE reportera
les erreurs "DeviceRGB may be used only if the file has a PDF/A-1 OutputIntent".
Le PDF Factur-X reste utilisable en B2B email (XML valide embarqué), la
conformité PDF/A-3 stricte est juste incomplète.
