// Proxy vers B2Brouter eDocExchange — création compte artisan, envoi facture, suivi.
// Variables d'environnement Vercel :
//   B2B_API_KEY     clé API B2Brouter (staging ou prod)
//   B2B_API_URL     défaut: https://api-staging.b2brouter.net
//   B2B_API_VERSION défaut: 2026-03-02
//
// Le client doit envoyer un Authorization: Bearer <supabase_access_token>
// pour que l'utilisateur soit authentifié via Supabase.

import { createClient } from "@supabase/supabase-js";

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "")
  .split(",").map(s => s.trim()).filter(Boolean);

function cors(req, res) {
  const origin = req.headers.origin || "";
  const isProd  = process.env.VERCEL_ENV === "production";
  const allowed = isProd
    ? (ALLOWED_ORIGINS.includes(origin) ? origin : (ALLOWED_ORIGINS[0] || ""))
    : origin;
  if (allowed) res.setHeader("Access-Control-Allow-Origin", allowed);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
}

async function b2b(method, path, body) {
  const base    = (process.env.B2B_API_URL || "https://api-staging.b2brouter.net").replace(/\/$/, "");
  const apiKey  = process.env.B2B_API_KEY;
  const version = process.env.B2B_API_VERSION || "2026-03-02";
  if (!apiKey) throw new Error("B2B_API_KEY non configurée");

  const res = await fetch(`${base}${path}`, {
    method,
    headers: {
      "Content-Type":    "application/json",
      "Accept":          "application/json",
      "X-B2B-API-Key":   apiKey,
      "X-B2B-API-Version": version,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

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

export default async function handler(req, res) {
  cors(req, res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) return res.status(401).json({ error: "Non authentifié" });

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey)
    return res.status(500).json({ error: "Supabase non configuré" });

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: { user }, error: authErr } = await admin.auth.getUser(token);
  if (authErr || !user) return res.status(401).json({ error: "Token invalide" });

  const { action, payload = {} } = req.body || {};
  if (!action) return res.status(400).json({ error: "action requise" });

  try {
    switch (action) {
      // ─── Création / récupération du compte B2Brouter de l'artisan ───
      case "ensure_account": {
        // 1. Déjà existant en DB ?
        const { data: existing } = await admin
          .from("b2b_accounts")
          .select("*")
          .eq("owner_id", user.id)
          .maybeSingle();
        if (existing) return res.status(200).json({ account: existing, created: false });

        // 2. Crée le compte côté B2Brouter
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

        // 3. Stocke en DB
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

      // ─── Envoi d'une facture à B2Brouter ───
      case "send_invoice": {
        const { invoice_id } = payload;
        if (!invoice_id) return res.status(400).json({ error: "invoice_id requis" });

        // Compte artisan
        const { data: account } = await admin
          .from("b2b_accounts")
          .select("b2brouter_account_id")
          .eq("owner_id", user.id)
          .maybeSingle();
        if (!account) return res.status(400).json({ error: "Compte B2Brouter non initialisé" });

        // Charge la facture + lignes + client
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

        // Construit le payload B2Brouter
        const b2bPayload = buildInvoicePayload({ inv, lignes, client, account });
        const response   = await b2b("POST", "/invoices", b2bPayload);
        const b2bId      = response?.id || response?.invoice_id || response?.uuid;

        // Verrouille et met à jour la facture
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

      // ─── Statut d'une facture ───
      case "get_invoice_status": {
        const { b2brouter_id } = payload;
        if (!b2brouter_id) return res.status(400).json({ error: "b2brouter_id requis" });
        const data = await b2b("GET", `/invoices/${encodeURIComponent(b2brouter_id)}`);
        return res.status(200).json({ data });
      }

      // ─── Factures reçues (fournisseurs de l'artisan) ───
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
