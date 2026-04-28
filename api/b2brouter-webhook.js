// Webhook B2Brouter → met à jour le statut des factures dans Supabase.
// Variable d'env obligatoire : B2B_WEBHOOK_SECRET (validation HMAC).

import { createClient } from "@supabase/supabase-js";
import crypto from "node:crypto";

export const config = { api: { bodyParser: false } };

async function readRawBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  return Buffer.concat(chunks).toString("utf8");
}

// Map les statuts B2Brouter vers nos statuts internes.
function mapStatus(b2bStatus) {
  const s = String(b2bStatus || "").toLowerCase();
  if (/(sent|dispatched|transmitted)/.test(s)) return "envoyee";
  if (/(delivered|received)/.test(s))          return "recue";
  if (/(paid|settled)/.test(s))                return "payee";
  if (/(rejected|failed|error)/.test(s))       return "rejetee";
  if (/(cancel)/.test(s))                      return "annulee";
  return null;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const raw = await readRawBody(req);

  // Validation HMAC obligatoire
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
