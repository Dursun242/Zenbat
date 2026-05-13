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

function escapeHtml(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Template HTML — style aligné sur la landing page : palette cream/terra,
// typo Syne pour les titres (avec fallback système si le client mail ne
// charge pas Google Fonts), Playfair Display italic en accent décoratif,
// numéros "01..04" en terra, maximum de whitespace, zéro carte/bordure.
function welcomeHtml({ firstName, companyName }: { firstName: string; companyName: string }): string {
  const greetingName = firstName ? `, ${escapeHtml(firstName)}` : "";
  const introCompany = companyName
    ? `Ravi de vous accompagner, vous et <strong style="color:#1A1612">${escapeHtml(companyName)}</strong>, sur la gestion de vos devis et factures.`
    : "Ravi de vous accompagner sur la gestion de vos devis et factures.";

  const steps = [
    { n: "01", t: "Complétez votre profil", d: "SIRET, adresse, coordonnées bancaires. Ces informations sont obligatoires sur vos devis et factures (art. L441-9 du Code de commerce)." },
    { n: "02", t: "Dictez votre premier devis", d: "Décrivez votre prestation à l'Agent IA, en français, anglais, espagnol… L'IA structure les lignes, calcule les totaux et applique la TVA." },
    { n: "03", t: "Envoyez pour signature", d: "Votre client reçoit un lien sécurisé, signe en ligne avec un code reçu par email, et le PDF signé arrive automatiquement dans vos boîtes." },
    { n: "04", t: "Convertissez en facture", d: "Une fois le devis accepté, générez la facture au format Factur-X (PDF/A-3 avec XML CII embarqué), conforme aux exigences fiscales françaises." },
  ];

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Bienvenue sur Zenbat</title>
<link href="https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700&family=Playfair+Display:ital,wght@1,400&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background:#FAF7F2;font-family:'Inter','Helvetica Neue',Helvetica,Arial,sans-serif;color:#1A1612;-webkit-font-smoothing:antialiased">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#FAF7F2">
<tr><td align="center" style="padding:64px 24px">
<table width="520" cellpadding="0" cellspacing="0" style="max-width:520px;width:100%">

  <!-- Wordmark -->
  <tr><td style="padding:0 0 56px">
    <div style="font-family:'Syne','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:22px;font-weight:700;letter-spacing:-0.5px;color:#1A1612">
      <span style="color:#C97B5C">Zen</span>bat
    </div>
  </td></tr>

  <!-- Hero -->
  <tr><td>
    <h1 style="margin:0 0 18px;font-family:'Syne','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:40px;font-weight:400;line-height:1.15;letter-spacing:-0.8px;color:#1A1612">
      <em style="font-family:'Playfair Display',Georgia,serif;font-style:italic;font-weight:400;color:#C97B5C">Bienvenue</em>${greetingName}.
    </h1>
    <p style="margin:0 0 56px;font-size:16px;line-height:1.65;color:#6B6358">
      ${introCompany}
    </p>
  </td></tr>

  <!-- Steps -->
  <tr><td style="padding:0 0 48px">
    <table width="100%" cellpadding="0" cellspacing="0">
      ${steps.map(s => `
      <tr><td style="padding:0 0 36px">
        <div style="font-family:'Syne','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:13px;font-weight:600;color:#C97B5C;letter-spacing:1.5px;margin-bottom:8px">${s.n}</div>
        <div style="font-family:'Syne','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:20px;font-weight:400;color:#1A1612;letter-spacing:-0.3px;margin-bottom:8px;line-height:1.3">${s.t}</div>
        <div style="font-size:15px;color:#6B6358;line-height:1.65">${s.d}</div>
      </td></tr>`).join("")}
    </table>
  </td></tr>

  <!-- CTA -->
  <tr><td style="padding:0 0 56px">
    <a href="${APP_URL}" style="display:inline-block;background:#1A1612;color:#FAF7F2;text-decoration:none;padding:16px 28px;border-radius:4px;font-size:15px;font-weight:600;letter-spacing:-0.2px;font-family:'Syne','Helvetica Neue',Helvetica,Arial,sans-serif">
      Accéder à mon tableau de bord →
    </a>
  </td></tr>

  <!-- Conformité -->
  <tr><td style="padding:48px 0 0;border-top:1px solid #E8E2D8">
    <div style="font-family:'Syne','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:11px;font-weight:600;color:#9A8E82;letter-spacing:1.5px;margin-bottom:14px">CONFORMITÉ 2026</div>
    <p style="margin:0;font-size:14px;line-height:1.7;color:#6B6358">
      Zenbat génère vos devis et factures au format <em style="font-family:'Playfair Display',Georgia,serif;font-style:italic;color:#1A1612">Factur-X</em> — la norme française hybride PDF/A-3 homologuée pour la réforme de la facturation électronique B2B. Vos documents sont d'ores et déjà structurés pour transiter via le futur portail public et les plateformes de dématérialisation partenaires.
    </p>
  </td></tr>

  <!-- Footer -->
  <tr><td style="padding:64px 0 0">
    <p style="margin:0 0 4px;font-size:13px;color:#9A8E82;line-height:1.65">
      Une question ? Répondez à cet email.
    </p>
    <p style="margin:0;font-size:12px;color:#C5BAA8;line-height:1.65">
      Zenbat · SaaS de devis &amp; facturation pour artisans
    </p>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}

async function sendWelcome(email: string, firstName: string, companyName: string): Promise<{ ok: boolean; error?: string }> {
  if (!RESEND_API_KEY) return { ok: false, error: "RESEND_API_KEY missing" };
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: RESEND_FROM,
      to: [email],
      subject: "Bienvenue chez Zenbat — voici par où commencer",
      html: welcomeHtml({ firstName, companyName }),
    }),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    return { ok: false, error: `Resend ${res.status}: ${txt.slice(0, 200)}` };
  }
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

  const profileId   = String(payload.record?.id || "");
  const companyName = String(payload.record?.company_name || "");
  const fullName    = String(payload.record?.full_name || "");
  if (!profileId) {
    return new Response(JSON.stringify({ error: "Missing profile.id" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const auth = await getUserEmail(profileId);
  if (!auth?.email) {
    return new Response(JSON.stringify({ error: "User email not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }
  // Fallback firstName : sur le profile.full_name si pas en metadata auth
  const firstName = auth.firstName || fullName.split(/\s+/)[0] || "";

  const result = await sendWelcome(auth.email, firstName, companyName);
  return new Response(JSON.stringify(result), {
    status: result.ok ? 200 : 502,
    headers: { "Content-Type": "application/json" },
  });
});
