export const CGU_VERSION = "1.0"

const articles = [
  {
    n: 1, title: "Objet",
    body: `Les présentes Conditions Générales d'Utilisation (CGU) régissent l'accès et l'utilisation de la plateforme Zenbat, service SaaS de génération de devis et de facturation à destination des artisans, auto-entrepreneurs et PME. Toute utilisation du service implique l'acceptation pleine et entière des présentes CGU.`,
  },
  {
    n: 2, title: "Acceptation des CGU",
    body: `L'utilisateur accepte les présentes CGU lors de la création de son compte, en cochant la case prévue à cet effet. Cette acceptation est enregistrée horodatée en base de données (champ cgu_accepted_at). En cas de mise à jour des CGU, l'utilisateur sera invité à les accepter à nouveau lors de sa prochaine connexion. Le refus entraîne la déconnexion automatique du compte.`,
  },
  {
    n: 3, title: "Description du service",
    body: `Zenbat est une application web progressive (PWA) permettant de :\n• Générer des devis professionnels assistés par intelligence artificielle (IA Claude d'Anthropic)\n• Gérer un portefeuille clients\n• Émettre des factures conformes à la réglementation française (TVA, Factur-X)\n• Envoyer des documents en signature électronique via Odoo Sign\n• Accéder au service depuis tout appareil (smartphone, tablette, ordinateur)\n\nLe service est disponible en mode SaaS via l'adresse https://zenbat.vercel.app.`,
  },
  {
    n: 4, title: "Inscription et accès au service",
    body: `L'inscription est ouverte à toute personne physique ou morale exerçant une activité professionnelle. L'utilisateur s'engage à fournir des informations exactes lors de la création de son compte (nom, email, SIRET). Un email de confirmation est envoyé à l'adresse fournie. Le compte n'est activé qu'après validation de cet email. L'utilisateur est seul responsable de la confidentialité de ses identifiants.`,
  },
  {
    n: 5, title: "Essai gratuit et abonnement",
    body: `Un essai gratuit de 30 jours est proposé sans engagement et sans carte bancaire. À l'issue de la période d'essai, la continuité du service est conditionnée à la souscription d'un abonnement au tarif en vigueur (actuellement 19 € TTC/mois). L'abonnement est sans engagement, résiliable à tout moment. Aucun remboursement ne sera effectué pour une période entamée.`,
  },
  {
    n: 6, title: "Données personnelles",
    body: `Zenbat collecte et traite les données personnelles nécessaires au fonctionnement du service (nom, email, coordonnées professionnelles, données de facturation). Ces données sont stockées de manière sécurisée sur l'infrastructure Supabase (hébergée en Europe). Elles ne sont jamais revendues à des tiers. Conformément au RGPD, l'utilisateur dispose d'un droit d'accès, de rectification et de suppression de ses données, exerçable à l'adresse contact@zenbat.fr.`,
  },
  {
    n: 7, title: "Utilisation de l'intelligence artificielle",
    body: `Le service utilise l'API Claude d'Anthropic pour générer des suggestions de devis. Les données transmises à l'IA (description des travaux, métiers) peuvent être traitées par Anthropic conformément à leur politique de confidentialité. L'utilisateur reste seul responsable de la vérification et de la validation des devis générés avant tout envoi à un client. Zenbat ne garantit pas l'exactitude des montants ou descriptions suggérés par l'IA.`,
  },
  {
    n: 8, title: "Propriété intellectuelle",
    body: `La plateforme Zenbat, son code source, son design et ses contenus sont la propriété exclusive de l'éditeur. Toute reproduction, diffusion ou utilisation à des fins commerciales sans autorisation écrite est interdite. Les documents (devis, factures) générés par l'utilisateur via le service lui appartiennent intégralement.`,
  },
  {
    n: 9, title: "Responsabilité",
    body: `Zenbat s'engage à maintenir le service disponible au mieux mais ne peut garantir une disponibilité ininterrompue. La responsabilité de Zenbat ne saurait être engagée en cas de perte de données, de dysfonctionnement lié à un tiers (Supabase, Anthropic, Odoo), ou d'utilisation non conforme du service par l'utilisateur. L'utilisateur est seul responsable de la conformité fiscale et légale de ses documents.`,
  },
  {
    n: 10, title: "Disponibilité et maintenance",
    body: `Zenbat se réserve le droit d'interrompre le service pour des opérations de maintenance, avec un préavis de 24 h sauf urgence. Les mises à jour sont déployées régulièrement et peuvent modifier les fonctionnalités disponibles. L'utilisateur sera informé des changements significatifs par email ou notification dans l'application.`,
  },
  {
    n: 11, title: "Résiliation",
    body: `L'utilisateur peut résilier son abonnement à tout moment depuis son espace client ou en contactant support@zenbat.fr. La résiliation prend effet à la fin de la période en cours. En cas de non-respect des présentes CGU, Zenbat se réserve le droit de suspendre ou supprimer le compte sans préavis ni remboursement.`,
  },
  {
    n: 12, title: "Droit applicable et contact",
    body: `Les présentes CGU sont soumises au droit français. Tout litige sera porté devant les tribunaux compétents du ressort de Paris, à défaut d'accord amiable préalable.\n\nPour toute question relative aux présentes CGU :\nEmail : contact@zenbat.fr\nVersion en vigueur : ${CGU_VERSION} — mise à jour le 1er janvier 2026`,
  },
]

export default function CGU() {
  const go = (href) => { window.location.href = href }

  return (
    <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", background: "#f8fafc", minHeight: "100vh" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');*{box-sizing:border-box;margin:0;padding:0}`}</style>

      {/* Header */}
      <div style={{ background: "#0f172a", padding: "16px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontWeight: 800, fontSize: 20 }}>
          <span style={{ color: "#22c55e" }}>Zen</span><span style={{ color: "#fff" }}>bat</span>
        </span>
        <button onClick={() => go("/")}
          style={{ background: "transparent", border: "1px solid #334155", color: "#94a3b8", borderRadius: 8, padding: "6px 14px", fontSize: 13, cursor: "pointer" }}>
          ← Retour
        </button>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "48px 24px 80px" }}>
        <div style={{ marginBottom: 40 }}>
          <div style={{ display: "inline-block", background: "#f0fdf4", color: "#16a34a", fontSize: 11, fontWeight: 700, padding: "3px 12px", borderRadius: 20, marginBottom: 12, letterSpacing: "0.5px" }}>
            VERSION {CGU_VERSION} — 1ER JANVIER 2026
          </div>
          <h1 style={{ fontSize: 32, fontWeight: 800, color: "#0f172a", letterSpacing: "-1px", marginBottom: 8 }}>
            Conditions Générales d'Utilisation
          </h1>
          <p style={{ fontSize: 15, color: "#64748b", lineHeight: 1.7 }}>
            Veuillez lire attentivement les présentes conditions avant d'utiliser Zenbat.
          </p>
        </div>

        {articles.map(({ n, title, body }) => (
          <div key={n} style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 16, padding: "24px 28px", marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 16, marginBottom: 12 }}>
              <span style={{ background: "#0f172a", color: "#22c55e", fontWeight: 800, fontSize: 13, borderRadius: 8, padding: "4px 10px", flexShrink: 0 }}>
                Art. {n}
              </span>
              <h2 style={{ fontSize: 17, fontWeight: 700, color: "#0f172a", lineHeight: 1.3 }}>{title}</h2>
            </div>
            <p style={{ fontSize: 14, color: "#475569", lineHeight: 1.8, whiteSpace: "pre-line" }}>{body}</p>
          </div>
        ))}

        <div style={{ marginTop: 32, textAlign: "center", color: "#94a3b8", fontSize: 12 }}>
          © 2026 Zenbat · Tous droits réservés
        </div>
      </div>
    </div>
  )
}
