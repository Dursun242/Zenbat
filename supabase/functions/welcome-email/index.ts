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

// Template HTML — fond blanc, accent sur la proposition de valeur (IA,
// temps, compétitivité, conformité, confiance client) via une grille
// 2×2 en table HTML. Typo Syne + Playfair Display via Google Fonts CDN
// avec fallbacks système pour les clients mail qui ne chargent pas les
// webfonts (Outlook desktop, mobile basique).
function welcomeHtml({ firstName, companyName }: { firstName: string; companyName: string }): string {
  const greetingName = firstName ? `, ${escapeHtml(firstName)}` : "";
  const introCompany = companyName
    ? `Ravi de vous accompagner, vous et <strong style="color:#1A1612">${escapeHtml(companyName)}</strong>.`
    : "Ravi de vous accompagner.";

  // 4 piliers présentés en grille 2×2.
  const pillars = [
    {
      mark: "IA",
      title: "L'agent IA qui structure",
      desc:  "Dictez votre prestation en français. L'IA assemble le devis (lignes, unités, TVA, totaux) en quelques secondes — vous gardez la main sur tout.",
    },
    {
      mark: "→",
      title: "Gain de temps, compétitivité",
      desc:  "Ce qui prenait 30 minutes prend 2 minutes. Vous répondez aux appels d'offres plus vite, vous remportez plus de chantiers.",
    },
    {
      mark: "✓",
      title: "Conformité 2026",
      desc:  "Factur-X PDF/A-3 prêt pour la réforme de la facturation électronique B2B. Vos documents transiteront sans friction via le portail public et les PDP.",
    },
    {
      mark: "✦",
      title: "Confiance client",
      desc:  "Signature électronique avec code OTP, audit trail légal (IP, horodatage, hash). Vos devis ont la valeur juridique d'un engagement signé.",
    },
  ];

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Bienvenue sur Zenbat</title>
<link href="https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700&family=Playfair+Display:ital,wght@1,400&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background:#ffffff;font-family:'Inter','Helvetica Neue',Helvetica,Arial,sans-serif;color:#1A1612;-webkit-font-smoothing:antialiased">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff">
<tr><td align="center" style="padding:64px 24px">
<table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%">

  <!-- Wordmark -->
  <tr><td style="padding:0 0 56px">
    <div style="font-family:'Syne','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:22px;font-weight:700;letter-spacing:-0.5px;color:#1A1612">
      <span style="color:#C97B5C">Zen</span>bat
    </div>
  </td></tr>

  <!-- Hero -->
  <tr><td style="padding:0 0 18px">
    <h1 style="margin:0;font-family:'Syne','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:40px;font-weight:400;line-height:1.15;letter-spacing:-0.8px;color:#1A1612">
      <em style="font-family:'Playfair Display',Georgia,serif;font-style:italic;font-weight:400;color:#C97B5C">Bienvenue</em>${greetingName}.
    </h1>
  </td></tr>

  <tr><td style="padding:0 0 48px">
    <p style="margin:0;font-size:17px;line-height:1.6;color:#3D3028">
      ${introCompany} Zenbat met l'IA au service de vos devis — pour que vous gagniez du <em style="font-family:'Playfair Display',Georgia,serif;font-style:italic;color:#C97B5C">temps</em>, des <em style="font-family:'Playfair Display',Georgia,serif;font-style:italic;color:#C97B5C">chantiers</em> et la <em style="font-family:'Playfair Display',Georgia,serif;font-style:italic;color:#C97B5C">confiance</em> de vos clients.
    </p>
  </td></tr>

  <!-- Grille 2×2 des piliers de valeur -->
  <tr><td style="padding:0 0 48px">
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">
      <tr>
        <td width="50%" valign="top" style="border:1px solid #E8E2D8;padding:24px 22px">
          <div style="font-family:'Syne','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:13px;font-weight:700;color:#C97B5C;letter-spacing:1.5px;margin-bottom:10px">${pillars[0].mark}</div>
          <div style="font-family:'Syne','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:17px;font-weight:600;color:#1A1612;letter-spacing:-0.3px;margin-bottom:8px;line-height:1.3">${pillars[0].title}</div>
          <div style="font-size:13.5px;color:#6B6358;line-height:1.6">${pillars[0].desc}</div>
        </td>
        <td width="50%" valign="top" style="border:1px solid #E8E2D8;border-left:none;padding:24px 22px">
          <div style="font-family:'Syne','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:13px;font-weight:700;color:#C97B5C;letter-spacing:1.5px;margin-bottom:10px">${pillars[1].mark}</div>
          <div style="font-family:'Syne','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:17px;font-weight:600;color:#1A1612;letter-spacing:-0.3px;margin-bottom:8px;line-height:1.3">${pillars[1].title}</div>
          <div style="font-size:13.5px;color:#6B6358;line-height:1.6">${pillars[1].desc}</div>
        </td>
      </tr>
      <tr>
        <td width="50%" valign="top" style="border:1px solid #E8E2D8;border-top:none;padding:24px 22px">
          <div style="font-family:'Syne','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:13px;font-weight:700;color:#C97B5C;letter-spacing:1.5px;margin-bottom:10px">${pillars[2].mark}</div>
          <div style="font-family:'Syne','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:17px;font-weight:600;color:#1A1612;letter-spacing:-0.3px;margin-bottom:8px;line-height:1.3">${pillars[2].title}</div>
          <div style="font-size:13.5px;color:#6B6358;line-height:1.6">${pillars[2].desc}</div>
        </td>
        <td width="50%" valign="top" style="border:1px solid #E8E2D8;border-top:none;border-left:none;padding:24px 22px">
          <div style="font-family:'Syne','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:13px;font-weight:700;color:#C97B5C;letter-spacing:1.5px;margin-bottom:10px">${pillars[3].mark}</div>
          <div style="font-family:'Syne','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:17px;font-weight:600;color:#1A1612;letter-spacing:-0.3px;margin-bottom:8px;line-height:1.3">${pillars[3].title}</div>
          <div style="font-size:13.5px;color:#6B6358;line-height:1.6">${pillars[3].desc}</div>
        </td>
      </tr>
    </table>
  </td></tr>

  <!-- CTA -->
  <tr><td style="padding:0 0 56px">
    <a href="${APP_URL}" style="display:inline-block;background:#1A1612;color:#ffffff;text-decoration:none;padding:16px 30px;border-radius:4px;font-size:15px;font-weight:600;letter-spacing:-0.2px;font-family:'Syne','Helvetica Neue',Helvetica,Arial,sans-serif">
      Créer mon premier devis →
    </a>
  </td></tr>

  <!-- Footer -->
  <tr><td style="padding:48px 0 0;border-top:1px solid #E8E2D8">
    <p style="margin:0 0 4px;font-size:13px;color:#6B6358;line-height:1.65">
      Une question ? Répondez à cet email — nous lisons tout.
    </p>
    <p style="margin:0;font-size:12px;color:#9A8E82;line-height:1.65">
      Zenbat · SaaS de devis &amp; facturation pour artisans français.
    </p>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}

async function sendWelcome(email: string, firstName: string, companyName: string): Promise<{ ok: boolean; error?: string }> {
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
      subject: "Bienvenue chez Zenbat — voici par où commencer",
      html: welcomeHtml({ firstName, companyName }),
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
    console.error(`[welcome-email] User email not found for profile ${profileId}`);
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
