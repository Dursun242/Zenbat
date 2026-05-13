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

// Template HTML — palette chaude Zenbat (#1A1612 / #22c55e / #FAF7F2)
function welcomeHtml({ firstName, companyName }: { firstName: string; companyName: string }): string {
  const greeting = firstName ? `Bonjour ${escapeHtml(firstName)},` : "Bonjour,";
  const intro = companyName
    ? `Bienvenue chez Zenbat — ravi de vous accompagner, vous et ${escapeHtml(companyName)}.`
    : "Bienvenue chez Zenbat — ravi de vous accompagner sur la gestion de vos devis et factures.";

  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#FAF7F2;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#1A1612">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#FAF7F2;padding:32px 16px">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.06)">

  <!-- Header -->
  <tr><td style="background:#1A1612;padding:28px 32px;text-align:center">
    <div style="font-size:26px;font-weight:800;letter-spacing:-1px">
      <span style="color:#C97B5C">Zen</span><span style="color:#ffffff">bat</span>
    </div>
    <div style="color:#9A8E82;font-size:11px;margin-top:6px;letter-spacing:1.5px;text-transform:uppercase">Devis &amp; factures pour artisans</div>
  </td></tr>

  <!-- Body -->
  <tr><td style="padding:36px 36px 8px">
    <p style="margin:0 0 6px;font-size:22px;font-weight:700;color:#1A1612;line-height:1.3">${greeting}</p>
    <p style="margin:0 0 24px;font-size:15px;color:#3D3028;line-height:1.6">${intro}</p>
  </td></tr>

  <!-- Mini-tutoriel -->
  <tr><td style="padding:0 36px">
    <div style="font-size:11px;font-weight:700;color:#9A8E82;letter-spacing:1.5px;margin-bottom:14px">DÉMARRAGE EN 4 ÉTAPES</div>

    <table width="100%" cellpadding="0" cellspacing="0">
      ${[
        { n: 1, t: "Complétez votre profil", d: "SIRET, adresse, coordonnées bancaires — ces informations sont obligatoires sur vos devis et factures (art. L441-9 du Code de commerce)." },
        { n: 2, t: "Créez votre premier devis avec l'Agent IA", d: "Décrivez votre prestation en français courant. L'IA structure les lignes, calcule les totaux et applique la TVA. Vous gardez la main sur tout." },
        { n: 3, t: "Envoyez-le pour signature électronique", d: "Votre client reçoit un lien sécurisé, signe en ligne avec OTP par email, et reçoit le PDF signé automatiquement." },
        { n: 4, t: "Convertissez en facture en un clic", d: "Une fois le devis accepté, générez la facture au format Factur-X (PDF avec XML CII embarqué), conforme aux exigences fiscales françaises." },
      ].map(s => `
      <tr><td style="padding:0 0 14px">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td valign="top" width="36" style="padding-right:14px">
              <div style="width:32px;height:32px;background:#22c55e;color:#ffffff;border-radius:50%;text-align:center;line-height:32px;font-weight:800;font-size:14px">${s.n}</div>
            </td>
            <td valign="top">
              <div style="font-size:14px;font-weight:700;color:#1A1612;margin-bottom:3px">${s.t}</div>
              <div style="font-size:13px;color:#6B6358;line-height:1.55">${s.d}</div>
            </td>
          </tr>
        </table>
      </td></tr>`).join("")}
    </table>
  </td></tr>

  <!-- CTA -->
  <tr><td style="padding:14px 36px 28px;text-align:center">
    <a href="${APP_URL}" style="display:inline-block;background:#22c55e;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:14px;font-weight:700;letter-spacing:-0.2px">
      Accéder à mon tableau de bord →
    </a>
  </td></tr>

  <!-- Conformité légale -->
  <tr><td style="padding:0 36px 28px">
    <div style="background:#FAF7F2;border-left:3px solid #C97B5C;border-radius:6px;padding:16px 18px">
      <div style="font-size:11px;font-weight:700;color:#C97B5C;letter-spacing:1.5px;margin-bottom:8px">CONFORMITÉ FACTURATION ÉLECTRONIQUE 2026</div>
      <p style="margin:0;font-size:13px;color:#3D3028;line-height:1.6">
        Zenbat génère vos devis et factures au format <strong>Factur-X</strong> (PDF/A-3 avec XML CII embarqué) — la norme française hybride homologuée pour la réforme de la facturation électronique B2B (échéances 2026-2027).
        Vos documents sont donc d'ores et déjà <strong>structurés pour transiter</strong> via le futur portail public de facturation et les plateformes de dématérialisation partenaires (PDP).
      </p>
    </div>
  </td></tr>

  <!-- Support -->
  <tr><td style="padding:0 36px 32px;border-top:1px solid #F0EBE3;padding-top:24px">
    <p style="margin:0 0 6px;font-size:13px;color:#3D3028;line-height:1.55">
      Une question ? Répondez simplement à cet email, nous lisons tout.
    </p>
    <p style="margin:0;font-size:12px;color:#9A8E82;line-height:1.55">
      Bonne route avec Zenbat 🍻
    </p>
  </td></tr>

</table>

  <!-- Footer -->
  <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%">
    <tr><td style="padding:20px 0;text-align:center;font-size:11px;color:#9A8E82;line-height:1.6">
      Zenbat · SaaS de devis et facturation pour artisans français<br>
      Vous recevez cet email parce que vous venez de créer un compte sur <a href="${APP_URL}" style="color:#9A8E82;text-decoration:underline">zenbat.vercel.app</a>.
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
      subject: "Bienvenue sur Zenbat 🎉",
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
