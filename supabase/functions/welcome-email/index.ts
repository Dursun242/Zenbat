// Welcome email — déclenché par un Database Webhook Supabase sur INSERT
// dans public.profiles (i.e. à chaque nouvelle inscription après que
// le trigger handle_new_user() a créé la ligne profile).
//
// Source qui appelle cette fonction :
//   • DB Webhook Supabase : table=profiles, event=INSERT
//     Voir Project Dashboard → Database → Webhooks.
//
// Auth : `verify_jwt: true` côté Supabase (par défaut). Le DB Webhook
// envoie automatiquement le service_role key dans Authorization.
//
// Variables d'env requises (Project Settings → Edge Functions secrets) :
//   RESEND_API_KEY        — clé API Resend (resend.com/api-keys)
//   RESEND_FROM           — expéditeur (ex: "Zenbat <onboarding@zenbat.fr>")
//                           — fallback "Zenbat <onboarding@resend.dev>"
//   SUPABASE_URL          — URL du projet (déjà injecté par Supabase)
//   SUPABASE_SERVICE_ROLE_KEY — clé service (déjà injecté par Supabase)
//   ZENBAT_APP_URL        — URL du dashboard (ex: "https://zenbat.vercel.app")
//                           — fallback "https://zenbat.vercel.app"
//
// Payload reçu (DB Webhook v1) :
//   { type: "INSERT", table: "profiles", record: { id, full_name, ... },
//     schema: "public", old_record: null }

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const RESEND_FROM    = Deno.env.get("RESEND_FROM")    ?? "Zenbat <onboarding@resend.dev>";
const SUPABASE_URL   = Deno.env.get("SUPABASE_URL")   ?? "";
const SERVICE_ROLE   = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const APP_URL        = Deno.env.get("ZENBAT_APP_URL") ?? "https://zenbat.vercel.app";

// Récupère l'email de l'user via l'admin REST API. Le profile vient d'être
// créé par le trigger handle_new_user() AFTER INSERT sur auth.users, donc
// l'user existe forcément à ce stade.
async function getUserEmail(userId: string): Promise<{ email: string; firstName: string } | null> {
  if (!SUPABASE_URL || !SERVICE_ROLE) return null;
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
    headers: {
      Authorization: `Bearer ${SERVICE_ROLE}`,
      apikey: SERVICE_ROLE,
    },
  });
  if (!res.ok) return null;
  const u = await res.json();
  const meta = u?.user_metadata || {};
  const firstName =
    String(meta.first_name || "").trim() ||
    String(meta.full_name || "").trim().split(/\s+/)[0] ||
    "";
  return { email: String(u?.email || "").trim(), firstName };
}

const ZENBAT_LINK = `<a href="${APP_URL}" style="color:#C97B5C;text-decoration:none;font-weight:700;">Zenbat</a>`;

function linkifyZenbat(html: string): string {
  return html.replace(/Zenbat/g, ZENBAT_LINK);
}

// Convertit texte plat (paragraphes, • listes, **gras**) en blocs HTML email.
// Doit rester identique à src/pages/CRM.jsx pour cohérence avec le template
// envoyé manuellement depuis le CRM.
function textToHtmlBlocks(text: string): string {
  const paragraphs = text.split(/\n\n+/);
  return paragraphs.map((para) => {
    const lines = para.split("\n");
    const isList = lines.every((l) => l.trim().startsWith("•") || l.trim() === "");
    if (isList) {
      const items = lines.filter((l) => l.trim().startsWith("•")).map((l) => {
        const content = l.replace(/^•\s*/, "").replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
        return `<tr>
          <td style="padding:4px 0;vertical-align:top;color:#C97B5C;font-size:16px;padding-right:10px;">•</td>
          <td style="padding:4px 0;font-size:15px;color:#3D3832;line-height:1.65;">${content}</td>
        </tr>`;
      }).join("");
      return `<table cellpadding="0" cellspacing="0" style="margin:0 0 4px 0;">${items}</table>`;
    }
    const html = para.replace(/\*\*(.*?)\*\*/g, '<strong style="color:#1A1612;">$1</strong>');
    return `<p style="margin:0 0 18px 0;font-size:15px;color:#3D3832;line-height:1.75;">${html.replace(/\n/g, "<br>")}</p>`;
  }).join("");
}

function buildWelcomeText(firstName: string): string {
  const prenom = firstName.trim();
  return `Bonjour ${prenom},

Bienvenue sur **Zenbat** — et merci de nous faire confiance pour vos devis et factures.

Pas envie de lire un manuel ? Pas besoin. **En 2 minutes chrono**, vous allez sortir votre premier devis. Voici la marche à suivre :

**Étape 1 — Ajoutez votre premier client (15 secondes)**
Onglet **Contacts** → **+ Nouveau contact**. Saisissez juste un nom et une ville. Vous compléterez le reste plus tard si besoin.
Astuce : vous pouvez aussi prendre en photo une carte de visite, l'IA remplit tout pour vous.

**Étape 2 — Lancez l'Agent IA (30 secondes)**
Onglet **Agent IA** (le bouton vert au centre en bas). Décrivez votre chantier en langage naturel, comme si vous parliez à votre apprenti :
• "Réfection toiture 80 m² ardoise + zinguerie + échafaudage"
• "Salle de bain complète 6 m², carrelage mural et sol, douche italienne"
L'IA structure les lignes, calcule la TVA et applique les bons taux automatiquement.

**Étape 3 — Vérifiez et ajustez (45 secondes)**
Relisez les lignes, ajustez les prix ou les quantités si besoin. Choisissez le client à l'étape précédente. Cliquez sur **Enregistrer**.

**Étape 4 — Envoyez pour signature (20 secondes)**
Bouton **Envoyer au client** → votre client reçoit un lien sécurisé, signe depuis son téléphone avec un code à 8 chiffres. Vous êtes notifié dès qu'il signe. Zéro impression, zéro renvoi par email.

Et c'est tout. Vous venez de faire en 2 minutes ce qui vous prenait une demi-heure.

**Quelques bonus que vous découvrirez vite :**
• Conversion devis → facture en 1 clic
• Factures Factur-X conformes 2026 (envoi DGFiP automatique)
• Suivi des paiements et relances pré-rédigées
• Statistiques CA / marge en temps réel

Si vous bloquez quelque part, répondez simplement à ce mail ou utilisez le **chat support** intégré (bouton en bas à droite). On répond personnellement.

Bonne route avec Zenbat,
L'équipe Zenbat`;
}

// Template HTML — bandeau vert "Bienvenue", timeline 4 étapes chronométrées,
// CTA unique "Ouvrir Zenbat". Strictement aligné avec le template envoyé
// manuellement depuis le CRM (src/pages/CRM.jsx :: buildWelcomeHtmlEmail).
function welcomeHtml({ firstName }: { firstName: string }): string {
  const bodyHtml = linkifyZenbat(textToHtmlBlocks(buildWelcomeText(firstName || "")));
  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Bienvenue sur Zenbat</title>
</head>
<body style="margin:0;padding:0;background:#F0ECE4;font-family:Inter,Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#F0ECE4;">
<tr><td align="center" style="padding:40px 16px;">

  <table width="600" cellpadding="0" cellspacing="0" role="presentation" style="max-width:600px;width:100%;">

    <!-- HEADER -->
    <tr><td style="background:#FAF7F2;border-radius:16px 16px 0 0;padding:22px 36px;border-bottom:1px solid #E8E2D8;">
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
        <tr>
          <td>
            <span style="font-family:Arial,Helvetica,sans-serif;font-size:26px;font-weight:800;color:#1A1612;letter-spacing:-1px;">Zen<span style="color:#C97B5C;">bat</span></span>
          </td>
          <td align="right" style="vertical-align:middle;">
            <span style="font-size:10px;color:#9A9088;letter-spacing:1px;text-transform:uppercase;font-weight:600;">Bienvenue à bord</span>
          </td>
        </tr>
      </table>
    </td></tr>

    <!-- WELCOME BANNER -->
    <tr><td style="background:#16a34a;padding:18px 36px;text-align:center;">
      <p style="margin:0;font-size:13px;color:#fff;font-weight:700;letter-spacing:0.8px;text-transform:uppercase;">
        🎉&nbsp; Votre compte est prêt &nbsp;·&nbsp; Premier devis en 2 minutes
      </p>
    </td></tr>

    <!-- BODY -->
    <tr><td style="background:#FFFCF7;padding:40px 36px 24px;">

      ${bodyHtml}

      <!-- STEPS TIMELINE -->
      <table cellpadding="0" cellspacing="0" role="presentation" style="width:100%;margin:32px 0 8px;border-radius:12px;overflow:hidden;border:1px solid #E8E2D8;">
        <tr><td style="background:#FAF7F2;padding:16px 20px;border-bottom:1px solid #E8E2D8;">
          <p style="margin:0;font-size:11px;font-weight:700;color:#6B6358;letter-spacing:1px;text-transform:uppercase;">⏱ Récapitulatif — 2 minutes chrono</p>
        </td></tr>
        ${[
          ["1", "Ajouter un client",          "15 sec", "Onglet Contacts → + Nouveau contact"],
          ["2", "Lancer l'Agent IA",          "30 sec", "Décrivez le chantier en langage naturel"],
          ["3", "Vérifier & ajuster",         "45 sec", "Relisez, ajustez les prix, enregistrez"],
          ["4", "Envoyer pour signature",     "20 sec", "Le client signe depuis son téléphone"],
        ].map(([num, title, duration, desc]) => `
        <tr><td style="padding:16px 20px;border-bottom:1px solid #F0ECE4;">
          <table cellpadding="0" cellspacing="0" role="presentation" style="width:100%;">
            <tr>
              <td style="width:38px;vertical-align:top;padding-right:14px;">
                <div style="width:32px;height:32px;border-radius:50%;background:#C97B5C;color:#fff;font-size:14px;font-weight:800;text-align:center;line-height:32px;font-family:Arial,Helvetica,sans-serif;">${num}</div>
              </td>
              <td>
                <table cellpadding="0" cellspacing="0" role="presentation" style="width:100%;">
                  <tr>
                    <td><p style="margin:0;font-size:14px;font-weight:700;color:#1A1612;">${title}</p></td>
                    <td align="right" style="white-space:nowrap;"><span style="font-size:11px;background:#F0ECE4;color:#6B6358;padding:2px 8px;border-radius:10px;font-weight:600;">${duration}</span></td>
                  </tr>
                </table>
                <p style="margin:4px 0 0;font-size:13px;color:#6B6358;line-height:1.5;">${desc}</p>
              </td>
            </tr>
          </table>
        </td></tr>`).join("")}
      </table>

      <!-- PRIMARY CTA -->
      <table cellpadding="0" cellspacing="0" role="presentation" style="width:100%;margin:28px 0 8px;">
        <tr><td align="center">
          <a href="${APP_URL}" style="display:inline-block;background:#C97B5C;color:#ffffff;text-decoration:none;font-size:16px;font-weight:700;padding:16px 40px;border-radius:10px;width:300px;text-align:center;">
            🚀 Ouvrir Zenbat et démarrer →
          </a>
          <p style="margin:8px 0 0;font-size:11px;color:#9A9088;">Pas besoin de mot de passe — vous êtes déjà connecté</p>
        </td></tr>
      </table>

      <!-- SUPPORT NOTE -->
      <table cellpadding="0" cellspacing="0" role="presentation" style="width:100%;margin:28px 0 0;background:#FAF7F2;border-radius:10px;border-left:3px solid #C97B5C;">
        <tr><td style="padding:14px 18px;">
          <p style="margin:0;font-size:12px;color:#6B6358;line-height:1.6;">
            <strong style="color:#1A1612;">Besoin d'aide ?</strong> Répondez à ce mail ou utilisez le chat support en bas à droite de l'app. On répond personnellement, en français, dans la journée.
          </p>
        </td></tr>
      </table>

    </td></tr>

    <!-- FOOTER -->
    <tr><td style="background:#F0ECE4;border-radius:0 0 16px 16px;padding:22px 36px;border-top:1px solid #E8E2D8;">
      <p style="margin:0 0 4px;font-size:13px;font-weight:600;color:#3D3832;">${ZENBAT_LINK} — Devis &amp; Facturation IA</p>
      <p style="margin:0;font-size:12px;color:#9A9088;">Le Havre &nbsp;·&nbsp; <a href="${APP_URL}" style="color:#C97B5C;text-decoration:none;">zenbat.vercel.app</a></p>
      <p style="margin:14px 0 0;font-size:11px;color:#B0A898;line-height:1.6;">
        Vous recevez ce mail de bienvenue car vous avez activé votre compte Zenbat.<br>
        Pour ne plus recevoir de communications, répondez « Désinscription » à ce mail.
      </p>
    </td></tr>

  </table>
</td></tr>
</table>
</body>
</html>`;
}

async function sendWelcome(email: string, firstName: string): Promise<{ ok: boolean; error?: string }> {
  if (!RESEND_API_KEY) {
    console.error("[welcome-email] RESEND_API_KEY missing in env");
    return { ok: false, error: "RESEND_API_KEY missing" };
  }
  console.log(`[welcome-email] Sending to=${email} from=${RESEND_FROM}`);
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: RESEND_FROM,
      to: [email],
      subject: "Bienvenue sur Zenbat — votre premier devis en 2 minutes ⚡",
      html: welcomeHtml({ firstName }),
    }),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    const err = `Resend ${res.status}: ${txt.slice(0, 500)}`;
    console.error(`[welcome-email] ${err}`);
    return { ok: false, error: err };
  }
  console.log("[welcome-email] Resend accepted");
  return { ok: true };
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Format payload DB Webhook Supabase v1
  // { type, table, schema, record, old_record }
  const payload = body as { type?: string; table?: string; record?: Record<string, unknown> };
  if (payload?.type !== "INSERT" || payload?.table !== "profiles") {
    return new Response(JSON.stringify({ ok: true, skipped: "not_profiles_insert" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  const profileId = String(payload.record?.id || "");
  const fullName  = String(payload.record?.full_name || "");
  if (!profileId) {
    return new Response(JSON.stringify({ error: "Missing profile.id" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const auth = await getUserEmail(profileId);
  if (!auth?.email) {
    console.error(`[welcome-email] User email not found for profile ${profileId}`);
    return new Response(JSON.stringify({ error: "User email not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }
  // Fallback firstName : sur le profile.full_name si pas en metadata auth
  const firstName = auth.firstName || fullName.split(/\s+/)[0] || "";

  const result = await sendWelcome(auth.email, firstName);
  return new Response(JSON.stringify(result), {
    status: result.ok ? 200 : 502,
    headers: { "Content-Type": "application/json" },
  });
});
