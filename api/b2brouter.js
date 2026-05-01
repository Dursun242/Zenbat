// Endpoint B2Brouter unifié — proxy eDocExchange + webhook entrant.
// Routage interne :
//   - Header `x-b2b-signature` ou `x-b2brouter-signature` présent → webhook (HMAC + maj statut facture)
//   - Sinon → POST authentifié { action, payload } : ensure_account | send_invoice | get_invoice_status | list_received
//
// Variables d'env :
//   B2B_API_KEY, B2B_API_URL, B2B_API_VERSION  (proxy)
//   B2B_WEBHOOK_SECRET                          (validation HMAC)
//
// URL externe préservée via vercel.json :
//   /api/b2brouter-webhook → /api/b2brouter

import { createClient } from "@supabase/supabase-js";
import crypto from "node:crypto";
import { cors } from "./_cors.js";

// Le webhook a besoin du body brut pour valider la signature HMAC.
// Pour les actions authentifiées on parse manuellement le JSON.
export const config = { api: { bodyParser: false } };

const B2B_TIMEOUT_MS = 10000;

async function readRawBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  return Buffer.concat(chunks).toString("utf8");
}

async function b2b(method, path, body) {
  const base    = (process.env.B2B_API_URL || "https://api-staging.b2brouter.net").replace(/\/$/, "");
  const apiKey  = process.env.B2B_API_KEY;
  const version = process.env.B2B_API_VERSION || "2026-03-02";
  if (!apiKey) throw new Error("B2B_API_KEY non configurée");

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), B2B_TIMEOUT_MS);
  const res = await fetch(`${base}${path}`, {
    method,
    headers: {
      "Content-Type":      "application/json",
      "Accept":            "application/json",
      "X-B2B-API-Key":     apiKey,
      "X-B2B-API-Version": version,
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: ctrl.signal,
  }).finally(() => clearTimeout(t));

  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text }; }

  if (!res.ok) {
    const err = data?.error || data?.message || `B2Brouter HTTP ${res.status}`;
    const e = new Error(err);
    e.status = res.status;
    e.detail = data;
    throw e;
  }
  return data;
}

function mapStatus(b2bStatus) {
  const s = String(b2bStatus || "").toLowerCase();
  if (/(sent|dispatched|transmitted)/.test(s)) return "envoyee";
  if (/(delivered|received)/.test(s))          return "recue";
  if (/(paid|settled)/.test(s))                return "payee";
  if (/(rejected|failed|error)/.test(s))       return "rejetee";
  if (/(cancel)/.test(s))                      return "annulee";
  return null;
}

// ─── Webhook B2Brouter ───────────────────────────────────────────────
async function handleWebhook(req, res, raw) {
  const secret = process.env.B2B_WEBHOOK_SECRET;
  if (!secret) return res.status(500).json({ error: "B2B_WEBHOOK_SECRET non configuré" });

  const sig = req.headers["x-b2b-signature"] || req.headers["x-b2brouter-signature"];
  if (!sig) return res.status(401).json({ error: "signature manquante" });

  const expected = crypto.createHmac("sha256", secret).update(raw).digest("hex");
  const received = String(sig).replace(/^sha256=/, "");
  if (!/^[0-9a-f]{64}$/i.test(received))
    return res.status(401).json({ error: "signature invalide" });
  const expectedBuf = Buffer.from(expected, "hex");
  const receivedBuf = Buffer.from(received, "hex");
  if (!crypto.timingSafeEqual(expectedBuf, receivedBuf))
    return res.status(401).json({ error: "signature invalide" });

  let event;
  try { event = JSON.parse(raw); } catch { return res.status(400).json({ error: "JSON invalide" }); }

  const b2bId     = event?.invoice_id || event?.id || event?.data?.id;
  const b2bStatus = event?.status || event?.data?.status || event?.type;
  if (!b2bId) return res.status(400).json({ error: "invoice_id manquant dans l'event" });

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey)
    return res.status(500).json({ error: "Supabase non configuré" });

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const patch = {
    b2brouter_status:     String(b2bStatus || "").slice(0, 60),
    b2brouter_last_event: new Date().toISOString(),
  };
  const mapped = mapStatus(b2bStatus);
  if (mapped) patch.statut = mapped;

  const { error } = await admin
    .from("invoices")
    .update(patch)
    .eq("b2brouter_invoice_id", b2bId);

  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json({ ok: true });
}

// ─── Actions authentifiées (proxy B2Brouter) ─────────────────────────
async function handleAction(req, res, raw) {
  cors(req, res, { methods: "POST, OPTIONS" });
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) return res.status(401).json({ error: "Non authentifié" });

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey)
    return res.status(500).json({ error: "Supabase non configuré" });

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: { user }, error: authErr } = await admin.auth.getUser(token);
  if (authErr || !user) return res.status(401).json({ error: "Token invalide" });

  let body = {};
  if (raw && raw.length) {
    try { body = JSON.parse(raw); } catch { return res.status(400).json({ error: "JSON invalide" }); }
  }
  const { action, payload = {} } = body;
  if (!action) return res.status(400).json({ error: "action requise" });

  try {
    switch (action) {
      case "ensure_account": {
        const { data: existing } = await admin
          .from("b2b_accounts")
          .select("*")
          .eq("owner_id", user.id)
          .maybeSingle();
        if (existing) return res.status(200).json({ account: existing, created: false });

        const { siren, name, email, address, city, postal_code } = payload;
        if (!siren || !name) return res.status(400).json({ error: "siren et name requis" });

        const created = await b2b("POST", "/accounts", {
          name,
          siren,
          email: email || user.email,
          address: { street: address, city, postal_code, country: "FR" },
          country: "FR",
        });
        const accountId = created?.id || created?.account_id || created?.uuid;
        if (!accountId) throw new Error("Réponse B2Brouter sans id de compte");

        const { data: row, error: insertErr } = await admin
          .from("b2b_accounts")
          .insert({
            owner_id: user.id,
            b2brouter_account_id: accountId,
            siren,
            environment: process.env.B2B_API_URL?.includes("staging") ? "staging" : "production",
          })
          .select()
          .single();
        if (insertErr) throw insertErr;
        return res.status(200).json({ account: row, created: true });
      }

      case "send_invoice": {
        const { invoice_id } = payload;
        if (!invoice_id) return res.status(400).json({ error: "invoice_id requis" });

        const { data: account } = await admin
          .from("b2b_accounts")
          .select("b2brouter_account_id")
          .eq("owner_id", user.id)
          .maybeSingle();
        if (!account) return res.status(400).json({ error: "Compte B2Brouter non initialisé" });

        const { data: inv, error: invErr } = await admin
          .from("invoices")
          .select("*")
          .eq("id", invoice_id)
          .eq("owner_id", user.id)
          .single();
        if (invErr || !inv) return res.status(404).json({ error: "Facture introuvable" });
        if (inv.locked) return res.status(400).json({ error: "Facture déjà verrouillée" });

        const { data: lignes } = await admin
          .from("lignes_invoices")
          .select("*")
          .eq("invoice_id", invoice_id)
          .order("position");

        const { data: client } = inv.client_id
          ? await admin.from("clients").select("*").eq("id", inv.client_id).maybeSingle()
          : { data: null };

        const b2bPayload = buildInvoicePayload({ inv, lignes, client, account });
        const response   = await b2b("POST", "/invoices", b2bPayload);
        const b2bId      = response?.id || response?.invoice_id || response?.uuid;

        await admin.from("invoices")
          .update({
            b2brouter_invoice_id: b2bId,
            b2brouter_status:     response?.status || "sent",
            b2brouter_last_event: new Date().toISOString(),
            statut:               "envoyee",
            locked:               true,
          })
          .eq("id", invoice_id);

        return res.status(200).json({ ok: true, b2brouter_id: b2bId, response });
      }

      case "get_invoice_status": {
        const { b2brouter_id } = payload;
        if (!b2brouter_id) return res.status(400).json({ error: "b2brouter_id requis" });
        const data = await b2b("GET", `/invoices/${encodeURIComponent(b2brouter_id)}`);
        return res.status(200).json({ data });
      }

      case "list_received": {
        const { data: account } = await admin
          .from("b2b_accounts")
          .select("b2brouter_account_id")
          .eq("owner_id", user.id)
          .maybeSingle();
        if (!account) return res.status(200).json({ data: [] });
        const data = await b2b("GET", `/accounts/${account.b2brouter_account_id}/received`);
        return res.status(200).json({ data });
      }

      default:
        return res.status(400).json({ error: `action inconnue : ${action}` });
    }
  } catch (err) {
    return res.status(err.status && err.status < 600 ? err.status : 502).json({
      error:  err.message || "B2Brouter error",
      detail: err.detail || null,
    });
  }
}

function isWebhookRequest(req) {
  // Le webhook arrive via la rewrite Vercel `/api/b2brouter-webhook` → `/api/b2brouter?route=webhook`,
  // ou directement avec un header de signature B2Brouter.
  if (req.url) {
    const idx = req.url.indexOf("?");
    if (idx >= 0) {
      const params = new URLSearchParams(req.url.slice(idx + 1));
      if (params.get("route") === "webhook") return true;
    }
  }
  return !!(req.headers["x-b2b-signature"] || req.headers["x-b2brouter-signature"]);
}

export default async function handler(req, res) {
  if (isWebhookRequest(req)) {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    const raw = await readRawBody(req);
    return handleWebhook(req, res, raw);
  }

  if (req.method === "OPTIONS") return handleAction(req, res, "");
  const raw = await readRawBody(req);
  return handleAction(req, res, raw);
}

function buildInvoicePayload({ inv, lignes, client, account }) {
  const ouvrages = (lignes || []).filter(l => l.type_ligne === "ouvrage");
  return {
    account_id:     account.b2brouter_account_id,
    invoice_number: inv.numero,
    issue_date:     inv.date_emission,
    due_date:       inv.date_echeance,
    operation_type: inv.operation_type,
    objet:          inv.objet,
    buyer: client ? {
      name:    client.raison_sociale || `${client.prenom || ""} ${client.nom || ""}`.trim(),
      siren:   client.siret?.slice(0, 9),
      address: [client.adresse, client.code_postal, client.ville].filter(Boolean).join(", "),
      email:   client.email,
    } : null,
    lines: ouvrages.map(l => ({
      description:  l.designation,
      quantity:     Number(l.quantite) || 0,
      unit:         l.unite || "u",
      unit_price:   Number(l.prix_unitaire) || 0,
      vat_rate:     Number(l.tva_rate ?? 20),
      lot:          l.lot || undefined,
    })),
    total_ht:            Number(inv.montant_ht) || 0,
    total_vat:           Number(inv.montant_tva) || 0,
    total_ttc:           Number(inv.montant_ttc) || 0,
    retenue_garantie:    Number(inv.retenue_garantie_eur) || 0,
    retenue_garantie_pct:Number(inv.retenue_garantie_pct) || 0,
  };
}
