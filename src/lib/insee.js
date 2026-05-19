// Intégration INSEE / SIRENE via l'API publique recherche-entreprises.api.gouv.fr
// (DINUM, gratuite, sans clé API, CORS ouvert). C'est la voie officielle
// recommandée pour exposer des données INSEE publiques côté navigateur.
//
// Docs : https://recherche-entreprises.api.gouv.fr/docs/

const BASE = "https://recherche-entreprises.api.gouv.fr";

// Détecte si la saisie ressemble à un SIRET (14 chiffres) ou SIREN (9).
function looksLikeSiretOrSiren(q) {
  const digits = (q || "").replace(/\D/g, "");
  return digits.length === 9 || digits.length === 14;
}

// Calcule le numéro de TVA intracommunautaire français à partir du SIREN.
// Formule officielle (VIES) : FR{key}{siren} où key = (12 + 3*(siren % 97)) % 97
function computeTvaIntra(siren) {
  const s = (siren || "").replace(/\D/g, "");
  if (s.length !== 9) return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  const key = String((12 + 3 * (n % 97)) % 97).padStart(2, "0");
  return `FR${key}${s}`;
}

// Construit l'adresse au format libre à partir du bloc siege renvoyé par l'API.
function formatAdresse(siege) {
  if (!siege) return "";
  const numero = siege.numero_voie || "";
  const indice = siege.indice_repetition || "";
  const typeVoie = siege.type_voie || "";
  const libVoie = siege.libelle_voie || "";
  const complement = siege.complement_adresse || "";
  const parts = [
    [numero, indice].filter(Boolean).join(""),
    typeVoie,
    libVoie,
  ].filter(Boolean).join(" ").trim();
  return complement ? `${parts}, ${complement}`.trim() : parts;
}

// Normalise un résultat brut de l'API vers la forme que le formulaire attend.
function normalize(entry) {
  const siege = entry.siege || {};
  const siret = (siege.siret || "").replace(/\D/g, "");
  const siren = (entry.siren || siret.slice(0, 9) || "").replace(/\D/g, "");
  return {
    raison_sociale: entry.nom_complet || entry.nom_raison_sociale || "",
    siret,
    siren,
    tva_intra: computeTvaIntra(siren),
    adresse: formatAdresse(siege),
    code_postal: siege.code_postal || "",
    ville: siege.libelle_commune || "",
    naf: siege.activite_principale || entry.activite_principale || "",
    activite: siege.libelle_activite_principale || entry.libelle_activite_principale || "",
    // Méta pour l'affichage dans la dropdown
    _display: {
      label: entry.nom_complet || entry.nom_raison_sociale || "(sans nom)",
      sub: [siret, siege.libelle_commune].filter(Boolean).join(" • "),
      etat: siege.etat_administratif === "F" ? "Fermé" : null,
    },
  };
}

// Recherche par nom OU SIRET/SIREN. Renvoie une liste de candidats normalisés.
// Si signal.aborted, jette une AbortError standard.
export async function searchEntreprises(query, { signal, limit = 8 } = {}) {
  const q = (query || "").trim();
  if (q.length < 3) return [];
  const params = new URLSearchParams({ q, per_page: String(limit) });
  // Quand c'est un SIRET/SIREN, on force un filtre exact pour ramener
  // l'établissement précis plutôt que des correspondances fuzzy par nom.
  if (looksLikeSiretOrSiren(q)) {
    const digits = q.replace(/\D/g, "");
    if (digits.length === 14) {
      params.set("q", digits);
    } else {
      params.set("q", digits);
    }
  }
  const url = `${BASE}/search?${params.toString()}`;
  const r = await fetch(url, { signal });
  if (!r.ok) {
    if (r.status === 429) throw new Error("Trop de requêtes INSEE, réessayez dans quelques secondes.");
    throw new Error(`Erreur INSEE (${r.status})`);
  }
  const json = await r.json();
  const results = Array.isArray(json.results) ? json.results : [];
  return results.map(normalize);
}

export { computeTvaIntra };
