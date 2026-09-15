// Helper Super PDP (Plateforme Agréée DGFiP — facturation électronique B2B).
// Fichier préfixé _ : Vercel ne le déploie pas comme fonction serverless.
// Il est routé depuis api/facturx.js (même domaine : facturation électronique)
// pour ne pas consommer le dernier slot Vercel (limite 12 fonctions, cf CLAUDE.md).
//
// Routage (dans api/facturx.js) :
//   - GET/POST /api/facturx?route=pdp_poll        → handlePdpPoll (cron Vercel, Bearer CRON_SECRET)
//   - POST /api/facturx { action: "pdp_test_connection" }
//   - POST /api/facturx { action: "pdp_send_invoice", invoice_id, pdf_base64 }
//   - POST /api/facturx { action: "pdp_get_status",   invoice_id }
//
// V0 (étape 1 — sandbox) : compte Super PDP UNIQUE partagé, credentials en
//   variables d'env Vercel. Toutes les factures de test partent avec le SIREN
//   de la sandbox Zenbat → les actions sont réservées à ADMIN_EMAIL.
// V1 (étape 2 — prod multi-tenant) : credentials chiffrés par artisan dans
//   pdp_accounts.encrypted_client_secret, token + curseur de polling par user.
//   Le schéma DB (migration 0057) est déjà prêt pour la v1.
//
// Spec API confirmée (docs/superpdp/REPRISE.md §3) :
//   OAuth 2.1 client_credentials → POST /oauth2/token (x-www-form-urlencoded)
//   POST /v1.beta/invoices   body = PDF Factur-X binaire (Content-Type: application/pdf)
//   GET  /v1.beta/invoices/{id}                 → invoice_events[]
//   GET  /v1.beta/invoice_events?starting_after_id=<cursor>  (has_after)
//   GET  /v1.beta/companies/me                  → { number (SIREN), env }
//
// Variables d'env :
//   PDP_API_BASE                  (défaut https://api.superpdp.tech)
//   PDP_CLIENT_ID / PDP_CLIENT_SECRET   (app OAuth sandbox v0)
//   PDP_SANDBOX_RECEIVER_PEPPOL   adresse Peppol du receiver enrôlé ("0225:xxxxxxxxx_xxxx")
//   PDP_SANDBOX_RECEIVER_SIREN    fallback : construit "0225:<siren>"
//   CRON_SECRET                   auth Bearer du polling (Vercel l'injecte sur les crons)

// 50 s : OAuth (cache miss) + envoi facture (validation Peppol côté Super PDP)
// peuvent cumuler. maxDuration Vercel de facturx.js = 60 s (vercel.json).
const PDP_TIMEOUT_MS = 50_000;
const POLL_MAX_PAGES = 50;

export const PDP_ACTIONS = new Set(["pdp_test_connection", "pdp_send_invoice", "pdp_get_status"]);

// Codes AFNOR fr:200..fr:212 → statuts internes Zenbat (STATUT_FACTURE).
// fr:200 déposée, fr:201/203/210 refus, fr:202/204/206 acceptée,
// fr:212 encaissée. fr:205, fr:207, fr:208 sont intermédiaires : statut
// Zenbat inchangé (le code brut est quand même persisté dans pdp_status_raw).
export function mapStatus(code) {
  if (code === "fr:200")                                 return "envoyee";
  if (["fr:201", "fr:203", "fr:210"].includes(code))     return "rejetee";
  if (["fr:202", "fr:204", "fr:206"].includes(code))     return "recue";
  if (code === "fr:212")                                 return "payee";
  return null;
}

// V0 : sandbox partagée → réservé à l'admin. Même normalisation que
// _withAuth.js (adminOnly) et api/claude.js.
export function isAdminUser(user) {
  const adminEmail = process.env.ADMIN_EMAIL;
  const norm = (s) => String(s || "").trim().toLowerCase();
  return !!adminEmail && norm(user?.email) === norm(adminEmail);
}

function apiBase() {
  return (process.env.PDP_API_BASE || "https://api.superpdp.tech").replace(/\/$/, "");
}

// Cache OAuth en mémoire — survit entre invocations chaudes Vercel.
let _cachedToken = null;
let _cachedTokenExpiresAt = 0;

// Exposé pour les tests (reset entre cas).
export function _resetTokenCache() {
  _cachedToken = null;
  _cachedTokenExpiresAt = 0;
}

async function getAccessToken() {
  if (_cachedToken && _cachedTokenExpiresAt > Date.now() + 30_000) {
    return _cachedToken;
  }
  const id     = process.env.PDP_CLIENT_ID;
  const secret = process.env.PDP_CLIENT_SECRET;
  if (!id || !secret) {
    const e = new Error("PDP_CLIENT_ID / PDP_CLIENT_SECRET non configurés côté Vercel");
    e.status = 500;
    throw e;
  }

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), PDP_TIMEOUT_MS);
  let res;
  try {
    res = await fetch(`${apiBase()}/oauth2/token`, {
      method:  "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Accept":       "application/json",
      },
      body: new URLSearchParams({
        grant_type:    "client_credentials",
        client_id:     id,
        client_secret: secret,
      }).toString(),
      signal: ctrl.signal,
    });
  } finally {
    clearTimeout(t);
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const e = new Error(`OAuth Super PDP HTTP ${res.status}`);
    e.status = res.status;
    e.detail = text.slice(0, 300);
    throw e;
  }

  const data = await res.json();
  if (!data?.access_token) {
    const e = new Error("Réponse OAuth Super PDP sans access_token");
    e.status = 502;
    throw e;
  }
  _cachedToken = data.access_token;
  _cachedTokenExpiresAt = Date.now() + ((data.expires_in || 3600) * 1000);
  return _cachedToken;
}

async function pdpFetch(method, path, { body = undefined, contentType = "application/json" } = {}) {
  const token = await getAccessToken();
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept:        "application/json",
  };
  if (body !== undefined && body !== null) headers["Content-Type"] = contentType;

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), PDP_TIMEOUT_MS);
  let res;
  try {
    res = await fetch(`${apiBase()}${path}`, { method, headers, body, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }

  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text }; }

  if (!res.ok) {
    const e = new Error(data?.error || data?.message || `Super PDP HTTP ${res.status}`);
    e.status = res.status;
    e.detail = data;
    throw e;
  }
  return data;
}

function errorResponse(res, err, extra = {}) {
  const status = err?.status && err.status >= 400 && err.status < 600 ? err.status : 502;
  return res.status(status).json({
    error:  err?.message || "Super PDP error",
    detail: err?.detail || null,
    ...extra,
  });
}

// ─── Polling /v1.beta/invoice_events (cron) ──────────────────────────
// Super PDP n'expose pas de webhook : on tire les événements avec un
// curseur monotone (pdp_state.last_event_id, row sentinelle id=1) et on
// propage chaque code AFNOR sur invoices.pdp_status_raw (+ statut si mappé).
export async function handlePdpPoll(req, res, { admin }) {
  const expected = process.env.CRON_SECRET;
  if (!expected) return res.status(500).json({ error: "CRON_SECRET non configuré" });
  const auth = req.headers.authorization || "";
  if (auth !== `Bearer ${expected}`) return res.status(401).json({ error: "unauthorized" });
  if (!admin) return res.status(500).json({ error: "Supabase non configuré" });

  const { data: state } = await admin
    .from("pdp_state")
    .select("last_event_id")
    .eq("id", 1)
    .single();
  const startCursor = Number(state?.last_event_id) || 0;
  let cursor   = startCursor;
  let lastSeen = startCursor;
  let pages    = 0;
  let updated  = 0;
  let hasAfter = true;

  try {
    while (hasAfter && pages < POLL_MAX_PAGES) {
      pages++;
      const resp = await pdpFetch("GET", `/v1.beta/invoice_events?starting_after_id=${encodeURIComponent(cursor)}`);
      const events = Array.isArray(resp?.data) ? resp.data : [];
      hasAfter = !!resp?.has_after;

      for (const ev of events) {
        if (!ev?.id || !ev?.invoice_id || !ev?.status_code) continue;
        const evId = Number(ev.id) || 0;
        if (evId > lastSeen) lastSeen = evId;

        const patch = {
          pdp_status_raw: String(ev.status_code).slice(0, 60),
          pdp_last_event: new Date().toISOString(),
        };
        const mapped = mapStatus(ev.status_code);
        if (mapped) patch.statut = mapped;

        const { count } = await admin
          .from("invoices")
          .update(patch, { count: "exact" })
          .eq("pdp_invoice_id", String(ev.invoice_id));
        if (count) updated += count;
      }

      if (events.length === 0) break;
      cursor = lastSeen;
    }

    if (lastSeen !== startCursor) {
      await admin.from("pdp_state").update({
        last_event_id:  lastSeen,
        last_synced_at: new Date().toISOString(),
      }).eq("id", 1);
    }

    return res.status(200).json({ ok: true, pages, updated, last_event_id: lastSeen });
  } catch (err) {
    console.error("[superpdp/poll]", err?.message || err, err?.detail || "");
    return errorResponse(res, err, { pages, updated });
  }
}

// ─── Actions utilisateur (authentifiées, admin-only en v0) ───────────
export async function handlePdpAction(req, res, { user, admin }) {
  const body   = req.body || {};
  const action = body.action;

  if (!isAdminUser(user)) {
    return res.status(403).json({
      error: "Envoi Super PDP réservé à l'administrateur pendant la phase sandbox (v0).",
    });
  }

  try {
    switch (action) {
      case "pdp_test_connection": {
        const data = await pdpFetch("GET", "/v1.beta/companies/me");
        // Trace locale du SIREN / env Super PDP de la sandbox pour cet admin.
        const { error: upErr } = await admin.from("pdp_accounts").upsert({
          owner_id:      user.id,
          provider:      "superpdp",
          company_siren: data?.number ? String(data.number) : null,
          company_env:   data?.env ? String(data.env) : null,
          updated_at:    new Date().toISOString(),
        }, { onConflict: "owner_id" });
        if (upErr) console.warn("[superpdp/test_connection] upsert pdp_accounts:", upErr.message);

        // Adresse Peppol complète du receiver enrôlé dans l'annuaire sandbox.
        // Format "<scheme>:<id>", ex "0225:315143296_6591" (0225 = FR-SIRENE
        // Super PDP avec suffixe interne, pas un SIRET classique).
        const peppolEnv = (process.env.PDP_SANDBOX_RECEIVER_PEPPOL || "").trim();
        const sirenEnv  = (process.env.PDP_SANDBOX_RECEIVER_SIREN  || "").replace(/\D/g, "");
        const sandboxReceiverPeppol = peppolEnv || (sirenEnv ? `0225:${sirenEnv}` : "");
        return res.status(200).json({
          ok: true,
          ...data,
          sandbox_receiver_peppol: sandboxReceiverPeppol || null,
        });
      }

      case "pdp_send_invoice": {
        const { invoice_id, pdf_base64 } = body;
        if (!invoice_id) return res.status(400).json({ error: "invoice_id requis" });
        if (!pdf_base64) return res.status(400).json({ error: "pdf_base64 (Factur-X) requis" });

        const { data: inv, error: invErr } = await admin
          .from("invoices")
          .select("id, owner_id, locked, statut, pdp_invoice_id, numero")
          .eq("id", invoice_id)
          .eq("owner_id", user.id)
          .maybeSingle();
        if (invErr || !inv) return res.status(404).json({ error: "Facture introuvable" });
        if (inv.pdp_invoice_id) {
          return res.status(400).json({
            error:          "Facture déjà transmise à Super PDP",
            pdp_invoice_id: inv.pdp_invoice_id,
          });
        }

        const pdfBuffer = Buffer.from(String(pdf_base64).replace(/\s/g, ""), "base64");
        if (pdfBuffer.length < 1024) {
          return res.status(400).json({ error: "PDF Factur-X invalide ou vide" });
        }

        const response = await pdpFetch("POST", "/v1.beta/invoices", {
          body:        pdfBuffer,
          contentType: "application/pdf",
        });
        const pdpId = response?.id;
        if (!pdpId) {
          const e = new Error("Réponse Super PDP sans id de facture");
          e.status = 502;
          e.detail = response;
          throw e;
        }

        // L'émission (brouillon → envoyee + locked) a normalement déjà été
        // faite par le flux Factur-X. On la garantit ici aussi (service_role,
        // bypass RLS) pour qu'une facture transmise à la PA soit forcément
        // verrouillée (CGI art. 289).
        const { data: updatedRows, error: upErr } = await admin.from("invoices").update({
          pdp_invoice_id: String(pdpId),
          pdp_status:     "sent",
          pdp_status_raw: "fr:200",
          pdp_last_event: new Date().toISOString(),
          statut:         inv.statut === "brouillon" ? "envoyee" : inv.statut,
          locked:         true,
        }).eq("id", invoice_id).eq("owner_id", user.id).select("statut, locked");
        if (upErr) console.error("[superpdp/send_invoice] update invoices:", upErr.message);

        return res.status(200).json({
          ok:             true,
          pdp_invoice_id: String(pdpId),
          statut:         updatedRows?.[0]?.statut ?? (inv.statut === "brouillon" ? "envoyee" : inv.statut),
          locked:         updatedRows?.[0]?.locked ?? true,
          response,
        });
      }

      case "pdp_get_status": {
        const { invoice_id } = body;
        if (!invoice_id) return res.status(400).json({ error: "invoice_id requis" });

        const { data: inv } = await admin
          .from("invoices")
          .select("pdp_invoice_id")
          .eq("id", invoice_id)
          .eq("owner_id", user.id)
          .maybeSingle();
        if (!inv?.pdp_invoice_id) {
          return res.status(404).json({ error: "Facture pas encore transmise à Super PDP" });
        }

        const data = await pdpFetch("GET", `/v1.beta/invoices/${encodeURIComponent(inv.pdp_invoice_id)}`);
        const events = Array.isArray(data?.invoice_events) ? data.invoice_events : [];
        if (events.length) {
          const last = events[events.length - 1];
          const patch = {
            pdp_status_raw: String(last?.status_code || "").slice(0, 60),
            pdp_last_event: new Date().toISOString(),
          };
          const mapped = mapStatus(last?.status_code);
          if (mapped) patch.statut = mapped;
          await admin.from("invoices").update(patch).eq("id", invoice_id).eq("owner_id", user.id);
        }
        return res.status(200).json({ ok: true, data });
      }

      default:
        return res.status(400).json({ error: `action inconnue : ${action}` });
    }
  } catch (err) {
    console.error("[superpdp/action]", action, err?.message || err, err?.detail || "");
    return errorResponse(res, err);
  }
}

// Route ?route=pdp_poll (cron). Lu depuis req.url (Vercel Node runtime).
export function isPdpPollRequest(req) {
  if (!req?.url) return false;
  const idx = req.url.indexOf("?");
  if (idx < 0) return false;
  return new URLSearchParams(req.url.slice(idx + 1)).get("route") === "pdp_poll";
}
