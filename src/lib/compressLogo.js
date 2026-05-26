// Compression + redimensionnement d'un logo uploadé par l'utilisateur.
//
// Borne à 800×300 px max (ratio préservé) — couvre largement les 50×14 mm
// d'affichage du logo dans le PDF Factur-X à 300 DPI. Sortie en JPEG 0.88
// si l'image est opaque (cas typique : photo iPhone uploadée par erreur en
// guise de logo), en PNG si elle contient de la transparence (vraie logo
// avec fond transparent qu'on veut préserver pour les rendus sur fond clair).
//
// Sans ça : une photo iPhone non redimensionnée (4000×3000 px, 3+ Mo en
// data URL) est embarquée dans le PDF qui dépasse alors la limite Vercel
// 4,5 Mo de body sur l'appel /api/facturx → l'émission échoue silencieusement.

export const LOGO_MAX_W = 800;
export const LOGO_MAX_H = 300;
export const LOGO_JPEG_QUALITY = 0.88;

// Lit un File HTML5 (input type=file) et renvoie un data URL compressé.
// Renvoie null si le fichier n'est pas une image valide.
export function compressLogoFile(file) {
  return new Promise((resolve) => {
    if (!file) { resolve(null); return; }
    const reader = new FileReader();
    reader.onload = (ev) => {
      compressLogoDataUrl(ev.target.result).then(resolve);
    };
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
}

// Variante data URL → data URL (cas d'un logo déjà stocké à recompresser,
// ou d'une image obtenue par un autre moyen). Si le décodage échoue, renvoie
// le data URL original — on préfère un logo cassé à pas de logo du tout.
export function compressLogoDataUrl(dataUrl) {
  return new Promise((resolve) => {
    if (!dataUrl || typeof dataUrl !== "string") { resolve(null); return; }
    const img = new Image();
    img.onload = () => {
      try {
        const scale = Math.min(1, LOGO_MAX_W / img.naturalWidth, LOGO_MAX_H / img.naturalHeight);
        const w = Math.max(1, Math.round(img.naturalWidth  * scale));
        const h = Math.max(1, Math.round(img.naturalHeight * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext("2d");
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(img, 0, 0, w, h);
        // Heuristique transparence — échantillonne ~256 pixels du canal alpha
        // (assez pour détecter un fond transparent ; un calcul exhaustif sur
        // 800×300 = 240k pixels serait inutilement coûteux).
        let hasAlpha = false;
        try {
          const sample = ctx.getImageData(0, 0, w, h).data;
          const step = Math.max(1, Math.floor(sample.length / 4 / 256)) * 4;
          for (let i = 3; i < sample.length; i += step) {
            if (sample[i] < 255) { hasAlpha = true; break; }
          }
        } catch { /* canvas tainted : on retombe sur JPEG (cas rare) */ }
        resolve(hasAlpha ? canvas.toDataURL("image/png") : canvas.toDataURL("image/jpeg", LOGO_JPEG_QUALITY));
      } catch { resolve(dataUrl); }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}
