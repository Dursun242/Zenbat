// Endpoint Super PDP — proxy OAuth + envoi factures + polling statuts.
//
// Routage interne :
//   - URL avec ?route=poll → cron de polling (auth Bearer CRON_SECRET)
//   - Sinon → POST authentifié { action, payload } pour les actions utilisateur
//
// V0 : single shared sandbox account (credentials en variables d'environnement).
//      Toutes les factures de test partent avec le SIREN de la sandbox.
// V1 (à venir) : multi-tenant — credentials chiffrés par utilisateur dans
//      pdp_accounts.encrypted_client_secret.
//
// Variables d'env :
//   PDP_API_BASE       (défaut https://api.superpdp.tech)
//   PDP_CLIENT_ID      (sandbox v0)
//   PDP_CLIENT_SECRET  (sandbox v0)
//   CRON_SECRET    (auth de l'endpoint /api/superpdp?route=poll)

import { createClient } from "@supabase/supabase-js";
import { cors } from "./_cors.js";
import { authenticate } from "./_withAuth.js";

// 50s : OAuth (token cache miss) + envoi facture (validation Peppol par
// Super PDP) peuvent cumuler. La maxDuration Vercel des fonctions est 60s
// (vercel.json), on garde une marge pour formuler la réponse JSON.
const PDP_TIMEOUT_MS = 50_000;
const POLL_MAX_PAGES = 50;

// Codes AFNOR fr:200..fr:212 → statuts internes Zenbat.
// fr:200 déposée, fr:201/203/210 refus, fr:202/204/206 acceptée,
// fr:212 encaissée. fr:205, fr:207, fr:208 sont intermédiaires : on
// laisse le statut Zenbat inchangé.
export function mapStatus(code) {
  if (code === "fr:200")                                 return "envoyee";
  if (["fr:201", "fr:203", "fr:210"].includes(code))     return "rejetee";
  if (["fr:202", "fr:204", "fr:206"].includes(code))     return "recue";
  if (code === "fr:212")                                 return "payee";
  return null;
}

// Cache OAuth en mémoire — survit entre invocations chaudes Vercel.
let _cachedToken = null;
let _cachedTokenExpiresAt = 0;

async function getAccessToken() {
  if (_cachedToken && _cachedTokenExpiresAt > Date.now() + 30_000) {
    return _cachedToken;
  }
  const base   = (process.env.PDP_API_BASE || "https://api.superpdp.tech").replace(/\/$/, "");
  const id     = process.env.PDP_CLIENT_ID;
  const secret = process.env.PDP_CLIENT_SECRET;
  if (!id || !secret) {
    const e = new Error("PDP_CLIENT_ID / PDP_CLIENT_SECRET non configurés");
    e.status = 500;
    throw e;
  }

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), PDP_TIMEOUT_MS);
  let res;
  try {
    res = await fetch(`${base}/oauth2/token`, {
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
  const base  = (process.env.PDP_API_BASE || "https://api.superpdp.tech").replace(/\/$/, "");
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept:        "application/json",
  };
  if (body !== undefined && body !== null) headers["Content-Type"] = contentType;

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), PDP_TIMEOUT_MS);
  let res;
  try {
    res = await fetch(`${base}${path}`, { method, headers, body, signal: ctrl.signal });
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

function makeAdmin() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

// ─── Polling /v1.beta/invoice_events ────────────────────────────────
async function handlePoll(req, res) {
  const expected = process.env.CRON_SECRET;
  if (!expected) return res.status(500).json({ error: "CRON_SECRET non configuré" });
  const auth = req.headers.authorization || "";
  if (auth !== `Bearer ${expected}`) return res.status(401).json({ error: "unauthorized" });

  const admin = makeAdmin();
  if (!admin) return res.status(500).json({ error: "Supabase non configuré" });

  const { data: state } = await admin
    .from("pdp_state")
    .select("last_event_id")
    .eq("id", 1)
    .single();
  let cursor   = state?.last_event_id || 0;
  let lastSeen = cursor;
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

    if (lastSeen !== (state?.last_event_id || 0)) {
      await admin.from("pdp_state").update({
        last_event_id:  lastSeen,
        last_synced_at: new Date().toISOString(),
      }).eq("id", 1);
    }

    return res.status(200).json({
      ok:             true,
      pages,
      updated,
      last_event_id:  lastSeen,
    });
  } catch (err) {
    return res.status(err.status && err.status < 600 ? err.status : 502).json({
      error:  err.message || "Polling Super PDP error",
      detail: err.detail || null,
      pages,
      updated,
    });
  }
}

// ─── Actions authentifiées ──────────────────────────────────────────
async function handleAction(req, res) {
  cors(req, res, { methods: "POST, OPTIONS" });
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST")    return res.status(405).json({ error: "Method not allowed" });

  const auth = await authenticate(req, res);
  if (!auth) return;
  const { user, admin } = auth;

  const { action, payload = {} } = req.body || {};
  if (!action) return res.status(400).json({ error: "action requise" });

  try {
    switch (action) {
      case "test_connection": {
        const data = await pdpFetch("GET", "/v1.beta/companies/me");
        // Persist en local pour suivi du SIREN/env Super PDP de la sandbox.
        await admin.from("pdp_accounts").upsert({
          owner_id:      user.id,
          provider:      "superpdp",
          company_siren: data?.number || null,
          company_env:   data?.env || null,
          updated_at:    new Date().toISOString(),
        }, { onConflict: "owner_id" });
        // Adresse Peppol complète du receiver enrôlé dans Super PDP sandbox.
        // Format attendu : "<scheme>:<id>", ex : "0225:315143296_6591".
        // Récupéré dans Super PDP → "lignes d'annuaire" (status receiver OK).
        // Le scheme 0225 n'est pas standard Peppol — c'est l'identifiant
        // FR-SIRENE Super PDP avec suffixe interne.
        // Fallback rétrocompat : si seulement PDP_SANDBOX_RECEIVER_SIREN est posé,
        // on construit "0225:<siren>" — utile pendant la transition.
        const peppolEnv = (process.env.PDP_SANDBOX_RECEIVER_PEPPOL || "").trim();
        const sirenEnv  = (process.env.PDP_SANDBOX_RECEIVER_SIREN  || "").replace(/\D/g, "");
        const sandboxReceiverPeppol = peppolEnv || (sirenEnv ? `0225:${sirenEnv}` : "");
        return res.status(200).json({
          ok: true,
          ...data,
          sandbox_receiver_peppol: sandboxReceiverPeppol || null,
          // legacy — laissé pour compat éphémère, à retirer au prochain commit propre
          sandbox_receiver_siren:  sirenEnv || null,
        });
      }

      case "send_invoice": {
        const { invoice_id, pdf_base64 } = payload;
        if (!invoice_id) return res.status(400).json({ error: "invoice_id requis" });
        if (!pdf_base64) return res.status(400).json({ error: "pdf_base64 (Factur-X) requis" });

        const { data: inv, error: invErr } = await admin
          .from("invoices")
          .select("id, owner_id, locked, pdp_invoice_id, numero")
          .eq("id", invoice_id)
          .eq("owner_id", user.id)
          .single();
        if (invErr || !inv) return res.status(404).json({ error: "Facture introuvable" });
        if (inv.pdp_invoice_id) {
          return res.status(400).json({
            error: "Facture déjà transmise à Super PDP",
            pdp_invoice_id: inv.pdp_invoice_id,
          });
        }

        const pdfBuffer = Buffer.from(pdf_base64, "base64");
        if (pdfBuffer.length < 100) {
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

        await admin.from("invoices").update({
          pdp_invoice_id: String(pdpId),
          pdp_status:     "sent",
          pdp_status_raw: "fr:200",
          pdp_last_event: new Date().toISOString(),
          statut:         "envoyee",
          locked:         true,
        }).eq("id", invoice_id);

        return res.status(200).json({
          ok:             true,
          pdp_invoice_id: String(pdpId),
          response,
        });
      }

      case "get_invoice_status": {
        const { invoice_id } = payload;
        if (!invoice_id) return res.status(400).json({ error: "invoice_id requis" });

        const { data: inv } = await admin
          .from("invoices")
          .select("pdp_invoice_id")
          .eq("id", invoice_id)
          .eq("owner_id", user.id)
          .single();
        if (!inv?.pdp_invoice_id) {
          return res.status(404).json({ error: "Facture pas encore transmise à Super PDP" });
        }

        const data = await pdpFetch("GET", `/v1.beta/invoices/${encodeURIComponent(inv.pdp_invoice_id)}`);
        // Met à jour le statut local depuis le dernier event reçu, si présent.
        const events = Array.isArray(data?.invoice_events) ? data.invoice_events : [];
        if (events.length) {
          const last = events[events.length - 1];
          const patch = {
            pdp_status_raw: String(last?.status_code || "").slice(0, 60),
            pdp_last_event: new Date().toISOString(),
          };
          const mapped = mapStatus(last?.status_code);
          if (mapped) patch.statut = mapped;
          await admin.from("invoices").update(patch).eq("id", invoice_id);
        }
        return res.status(200).json({ ok: true, data });
      }

      default:
        return res.status(400).json({ error: `action inconnue : ${action}` });
    }
  } catch (err) {
    return res.status(err.status && err.status < 600 ? err.status : 502).json({
      error:  err.message || "Super PDP error",
      detail: err.detail || null,
    });
  }
}

function isPollRequest(req) {
  if (!req.url) return false;
  const idx = req.url.indexOf("?");
  if (idx < 0) return false;
  return new URLSearchParams(req.url.slice(idx + 1)).get("route") === "poll";
}

export default async function handler(req, res) {
  if (isPollRequest(req)) {
    if (req.method !== "POST" && req.method !== "GET") {
      return res.status(405).json({ error: "Method not allowed" });
    }
    return handlePoll(req, res);
  }
  return handleAction(req, res);
}
