export const CGU_VERSION = "1.2"
export const CGU_DATE    = "11 mai 2026"

const articles = [
  {
    n: 1, title: "Objet",
    body: `Les présentes Conditions Générales d'Utilisation et de Vente (CGU/CGV) régissent l'accès, l'utilisation et la souscription à la plateforme Zenbat, service SaaS de génération de devis et de facturation à destination des artisans, auto-entrepreneurs et PME. Toute utilisation du service implique l'acceptation pleine et entière des présentes CGU/CGV.`,
  },
  {
    n: 2, title: "Acceptation des CGU/CGV",
    body: `L'utilisateur accepte les présentes CGU/CGV lors de la création de son compte, en cochant la case prévue à cet effet. Cette acceptation est enregistrée horodatée en base de données (champ cgu_accepted_at). En cas de mise à jour des CGU/CGV, l'utilisateur sera invité à les accepter à nouveau lors de sa prochaine connexion. Le refus entraîne la déconnexion automatique du compte.`,
  },
  {
    n: 3, title: "Description du service",
    body: `Zenbat est une application web progressive (PWA) permettant de :\n• Générer des devis professionnels assistés par intelligence artificielle (IA Claude d'Anthropic)\n• Gérer un portefeuille clients\n• Émettre des factures conformes à la réglementation française (TVA, Factur-X)\n• Envoyer des documents en signature électronique via Odoo Sign\n• Accéder au service depuis tout appareil (smartphone, tablette, ordinateur)`,
  },
  {
    n: 4, title: "Inscription et accès au service",
    body: `L'inscription est ouverte à toute personne physique ou morale exerçant une activité professionnelle. L'utilisateur s'engage à fournir des informations exactes lors de la création de son compte (nom, email, SIRET). Un email de confirmation est envoyé à l'adresse fournie. Le compte n'est activé qu'après validation de cet email. L'utilisateur est seul responsable de la confidentialité de ses identifiants.`,
  },
  {
    n: 5, title: "Tarification",
    body: `Zenbat propose un plan Gratuit à vie, sans carte bancaire et sans limite de durée, donnant accès aux fonctionnalités essentielles (devis, factures, Agent IA).

Un plan Pro optionnel est disponible au tarif de 19 € TTC/mois, sans engagement. Il donne accès à des fonctionnalités avancées (exports Factur-X, signature électronique, statistiques détaillées). L'abonnement Pro est sans engagement et résiliable à tout moment depuis Mon profil.

Les tarifs sont libellés en euros TTC et peuvent être modifiés à tout moment. Tout changement tarifaire sera communiqué par email avec un préavis de 30 jours.`,
  },
  {
    n: 6, title: "Conditions de vente — Abonnement Pro",
    body: `Facturation : l'abonnement Pro est facturé mensuellement par prélèvement automatique via Stripe (prestataire de paiement sécurisé PCI-DSS). La première échéance est prélevée à la date de souscription, puis chaque mois à la même date.

Paiement : les paiements sont acceptés par carte bancaire (Visa, Mastercard, American Express). Aucune donnée de carte n'est stockée par Zenbat — la tokenisation est assurée par Stripe.

Échec de paiement : en cas d'échec de prélèvement, un email de relance est envoyé. Sans régularisation sous 7 jours, l'accès aux fonctionnalités Pro est suspendu (les données restent accessibles). Le compte n'est pas supprimé.

Remboursement : aucun remboursement n'est effectué pour une période déjà entamée. En cas de résiliation en cours de mois, l'accès Pro reste actif jusqu'à la fin de la période payée.

Droit de rétractation : conformément à l'art. L221-28 du Code de la consommation, le droit de rétractation de 14 jours ne s'applique pas aux contenus numériques dont l'exécution a commencé avec l'accord de l'utilisateur. La souscription constitue cet accord.`,
  },
  {
    n: 7, title: "Données personnelles et droits RGPD",
    body: `Zenbat collecte les données strictement nécessaires au service : identité, email, coordonnées professionnelles (SIRET, adresse, téléphone), données clients/devis/factures saisies par l'utilisateur, et journal d'utilisation de l'Agent IA (voir art. 8).

Hébergement : Supabase (Union européenne). Aucune donnée n'est revendue à des tiers.

Conformément au RGPD (règlement UE 2016/679), l'utilisateur dispose à tout moment des droits suivants, exerçables EN LIBRE-SERVICE depuis l'application (Mon profil → Vos données) :\n• Droit d'accès et portabilité : téléchargement d'une archive JSON complète\n• Droit à l'effacement (art. 17) : suppression définitive du compte et de toutes les données associées\n• Droit de rectification : modification directe depuis Mon profil

Pour les autres demandes (limitation, opposition, plainte), utiliser le formulaire de contact disponible sur zenbat.fr/contact. À défaut de réponse satisfaisante, l'utilisateur peut saisir la CNIL (cnil.fr).`,
  },
  {
    n: 8, title: "Utilisation de l'intelligence artificielle",
    body: `Le service utilise l'API Claude (Anthropic, via infrastructure UE/US conforme aux clauses contractuelles types). Les données transmises à l'IA (description des prestations, métiers déclarés, montants) sont traitées dans le seul but de générer le devis demandé.

Journalisation : pour le support, le débogage et l'amélioration du service, Zenbat enregistre les conversations avec l'Agent IA (message utilisateur + réponse IA visible, hors PDF), les erreurs techniques et les refus de l'IA. Ces journaux sont consultables uniquement par l'administrateur Zenbat et par l'utilisateur lui-même via l'export RGPD. Conservation : 12 mois glissants, puis suppression automatique.

L'utilisateur reste seul responsable de la vérification, de la validation et de l'exactitude des devis générés avant tout envoi à un client. Zenbat ne garantit pas l'exactitude des montants ou descriptions suggérés par l'IA.`,
  },
  {
    n: 9, title: "Conservation et archivage des documents",
    body: `Conformément aux obligations fiscales françaises (LPF art. L102 B et CGI art. 286), les factures émises sont conservées pendant 10 ans à compter de leur émission, sans modification possible (CGI art. 289). Une facture émise est verrouillée automatiquement et ne peut plus être modifiée ni supprimée — toute correction passe par une facture d'avoir.

Les devis acceptés ou en cours de signature sont conservés 5 ans en tant que pièces contractuelles (code civil) et ne peuvent être supprimés tant qu'ils sont liés à un contrat actif.

Les brouillons de devis et factures, ainsi que les devis refusés, peuvent être supprimés à tout moment par l'utilisateur.

À l'issue des durées légales, les documents sont automatiquement purgés de la base de données.`,
  },
  {
    n: 10, title: "Propriété intellectuelle",
    body: `La plateforme Zenbat, son code source, son design et ses contenus sont la propriété exclusive de l'éditeur. Toute reproduction, diffusion ou utilisation à des fins commerciales sans autorisation écrite est interdite. Les documents (devis, factures) générés par l'utilisateur via le service lui appartiennent intégralement.`,
  },
  {
    n: 11, title: "Responsabilité",
    body: `Zenbat s'engage à maintenir le service disponible au mieux mais ne peut garantir une disponibilité ininterrompue. La responsabilité de Zenbat ne saurait être engagée en cas de perte de données, de dysfonctionnement lié à un tiers (Supabase, Anthropic, Odoo, Stripe), ou d'utilisation non conforme du service par l'utilisateur. L'utilisateur est seul responsable de la conformité fiscale et légale de ses documents.`,
  },
  {
    n: 12, title: "Disponibilité et maintenance",
    body: `Zenbat se réserve le droit d'interrompre le service pour des opérations de maintenance, avec un préavis de 24 h sauf urgence. Les mises à jour sont déployées régulièrement et peuvent modifier les fonctionnalités disponibles. L'utilisateur sera informé des changements significatifs par email ou notification dans l'application.`,
  },
  {
    n: 13, title: "Résiliation et suppression du compte",
    body: `Résiliation de l'abonnement Pro : l'utilisateur peut résilier son abonnement à tout moment depuis Mon profil → Abonnement. L'accès Pro reste actif jusqu'à la fin de la période mensuelle payée. Aucun remboursement prorata n'est effectué.

Suppression du compte : l'utilisateur peut supprimer son compte à tout moment depuis Mon profil → Vos données → Supprimer mon compte. La suppression entraîne l'effacement immédiat des données personnelles et clients ; les factures émises sont conservées en archive anonymisée pour la durée légale (10 ans).

En cas de non-respect des présentes CGU/CGV, Zenbat se réserve le droit de suspendre ou supprimer le compte sans préavis ni remboursement.`,
  },
  {
    n: 14, title: "Droit applicable et contact",
    body: `Les présentes CGU/CGV sont soumises au droit français. Tout litige sera porté devant les tribunaux compétents du ressort du siège social de l'éditeur, à défaut d'accord amiable préalable.\n\nPour toute question :\nFormulaire : zenbat.fr/contact\nWhatsApp : 06 79 11 60 85\nVersion en vigueur : 1.2 — 11 mai 2026`,
  },
]

export default function CGU() {
  const go = (href) => { window.location.href = href }

  return (
    <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", background: "#FAF7F2", minHeight: "100vh" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');*{box-sizing:border-box;margin:0;padding:0}`}</style>

      {/* Header */}
      <div style={{ background: "#1A1612", padding: "16px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontWeight: 800, fontSize: 20 }}>
          <span style={{ color: "#22c55e" }}>Zen</span><span style={{ color: "#fff" }}>bat</span>
        </span>
        <button onClick={() => go("/")}
          style={{ background: "transparent", border: "1px solid #3D3028", color: "#9A8E82", borderRadius: 8, padding: "6px 14px", fontSize: 13, cursor: "pointer" }}>
          ← Retour
        </button>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "48px 24px 80px" }}>
        <div style={{ marginBottom: 40 }}>
          <div style={{ display: "inline-block", background: "#f0fdf4", color: "#16a34a", fontSize: 11, fontWeight: 700, padding: "3px 12px", borderRadius: 20, marginBottom: 12, letterSpacing: "0.5px" }}>
            VERSION 1.2 — 11 MAI 2026
          </div>
          <h1 style={{ fontSize: 32, fontWeight: 800, color: "#1A1612", letterSpacing: "-1px", marginBottom: 8 }}>
            Conditions Générales d'Utilisation et de Vente
          </h1>
          <p style={{ fontSize: 15, color: "#6B6358", lineHeight: 1.7 }}>
            CGU / CGV — Veuillez lire attentivement les présentes conditions avant d'utiliser Zenbat.
          </p>
        </div>

        {articles.map(({ n, title, body }) => (
          <div key={n} style={{ background: "#fff", border: "1px solid #E8E2D8", borderRadius: 16, padding: "24px 28px", marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 16, marginBottom: 12 }}>
              <span style={{ background: "#1A1612", color: "#22c55e", fontWeight: 800, fontSize: 13, borderRadius: 8, padding: "4px 10px", flexShrink: 0 }}>
                Art. {n}
              </span>
              <h2 style={{ fontSize: 17, fontWeight: 700, color: "#1A1612", lineHeight: 1.3 }}>{title}</h2>
            </div>
            <p style={{ fontSize: 14, color: "#6B6358", lineHeight: 1.8, whiteSpace: "pre-line" }}>{body}</p>
          </div>
        ))}

        <div style={{ marginTop: 32, textAlign: "center", color: "#9A8E82", fontSize: 12 }}>
          © 2026 Zenbat · Tous droits réservés · Édité par ID Maîtrise, Le Havre
        </div>
      </div>
    </div>
  )
}
