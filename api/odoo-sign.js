// Proxy vers Odoo Sign — authentifie, upload le PDF, crée une demande de signature
// Variables d'environnement requises côté Vercel :
//   ODOO_URL       ex: https://zenbat.odoo.com
//   ODOO_DB        ex: zenbat
//   ODOO_USERNAME  ex: admin@zenbat.fr
//   ODOO_API_KEY   ex: <API key générée dans Odoo → Préférences → Compte>

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "")
  .split(",").map(s => s.trim()).filter(Boolean);

function resolveOrigin(req) {
  const origin = req.headers.origin || "";
  if (process.env.VERCEL_ENV !== "production") return origin || "*";
  if (ALLOWED_ORIGINS.includes(origin)) return origin;
  return ALLOWED_ORIGINS[0] || "";
}

async function odooCall({ base, db, uid, password, model, method, args=[], kwargs={} }) {
  const res = await fetch(`${base}/jsonrpc`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "call",
      params: {
        service: "object",
        method: "execute_kw",
        args: [db, uid, password, model, method, args, kwargs],
      },
    }),
  });
  const json = await res.json();
  if (json.error) throw new Error(json.error?.data?.message || json.error?.message || "Odoo error");
  return json.result;
}

async function odooLogin({ base, db, username, password }) {
  const res = await fetch(`${base}/jsonrpc`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0", method: "call",
      params: { service: "common", method: "login", args: [db, username, password] },
    }),
  });
  const json = await res.json();
  if (json.error) throw new Error(json.error?.data?.message || "Odoo login failed");
  if (!json.result) throw new Error("Odoo login: identifiants invalides");
  return json.result;
}

export default async function handler(req, res) {
  const origin = resolveOrigin(req);
  if (origin) res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { ODOO_URL, ODOO_DB, ODOO_USERNAME, ODOO_API_KEY } = process.env;
  if (!ODOO_URL || !ODOO_DB || !ODOO_USERNAME || !ODOO_API_KEY) {
    return res.status(500).json({
      error: "Configuration Odoo manquante",
      detail: "ODOO_URL, ODOO_DB, ODOO_USERNAME, ODOO_API_KEY doivent être définis.",
    });
  }

  try {
    const {
      pdf_base64, filename, reference,
      signer_email, signer_name, signer_phone = "",
      subject = "Signature du devis",
      message = "Merci de signer le devis ci-joint.",
    } = req.body || {};

    if (!pdf_base64 || !signer_email || !signer_name || !filename) {
      return res.status(400).json({ error: "pdf_base64, filename, signer_email, signer_name requis" });
    }

    const base = ODOO_URL.replace(/\/$/, "");
    const uid = await odooLogin({ base, db: ODOO_DB, username: ODOO_USERNAME, password: ODOO_API_KEY });
    const ctx = { base, db: ODOO_DB, uid, password: ODOO_API_KEY };

    // Introspecte sign.template
    const tmplFields = await odooCall({
      ...ctx,
      model: "sign.template",
      method: "fields_get",
      args: [],
      kwargs: { attributes: ["type", "relation"] },
    });

    // Stratégie 1 : champ direct vers ir.attachment (Odoo 16/17)
    // Stratégie 2 : champ vers sign.document (Odoo SaaS récent) → chaîne ir.attachment → sign.document → sign.template
    const directAttach = Object.entries(tmplFields).find(
      ([, d]) => d.relation === "ir.attachment"
    );
    const docsFieldEntry = Object.entries(tmplFields).find(
      ([, d]) => d.relation === "sign.document"
    );

    let templateId;

    if (directAttach) {
      const [fieldName, def] = directAttach;
      const isMany = ["many2many", "one2many"].includes(def.type);
      const attId = await odooCall({
        ...ctx,
        model: "ir.attachment",
        method: "create",
        args: [{
          name: filename,
          datas: pdf_base64,
          mimetype: "application/pdf",
          res_model: "sign.template",
          type: "binary",
        }],
      });
      const payload = { name: reference || filename };
      payload[fieldName] = isMany ? [[6, 0, [attId]]] : attId;
      templateId = await odooCall({
        ...ctx, model: "sign.template", method: "create", args: [payload],
      });
    } else if (docsFieldEntry) {
      // sign.document a un template_id requis → on crée le template d'abord,
      // puis le document qui pointe vers lui.
      templateId = await odooCall({
        ...ctx,
        model: "sign.template",
        method: "create",
        args: [{ name: reference || filename }],
      });

      // Introspecte sign.document pour trouver son champ ir.attachment
      const docFields = await odooCall({
        ...ctx,
        model: "sign.document",
        method: "fields_get",
        args: [],
        kwargs: { attributes: ["type", "relation"] },
      });
      const docAttach = Object.entries(docFields).find(
        ([, d]) => d.relation === "ir.attachment"
      );
      if (!docAttach) {
        const names = Object.keys(docFields).sort().join(", ");
        throw new Error(`sign.document n'a aucun champ ir.attachment. Champs : ${names}`);
      }
      const [docAttFieldName, docAttFieldDef] = docAttach;
      const docAttIsMany = ["many2many", "one2many"].includes(docAttFieldDef.type);

      const attId = await odooCall({
        ...ctx,
        model: "ir.attachment",
        method: "create",
        args: [{
          name: filename,
          datas: pdf_base64,
          mimetype: "application/pdf",
          res_model: "sign.document",
          type: "binary",
        }],
      });

      const docPayload = { template_id: templateId, name: filename };
      docPayload[docAttFieldName] = docAttIsMany ? [[6, 0, [attId]]] : attId;
      await odooCall({
        ...ctx, model: "sign.document", method: "create", args: [docPayload],
      });
    } else {
      const allFields = Object.keys(tmplFields).sort().join(", ");
      throw new Error(
        `Schéma sign.template non supporté. Champs disponibles : ${allFields}`
      );
    }

    let partnerId;
    const found = await odooCall({
      ...ctx,
      model: "res.partner",
      method: "search_read",
      args: [[["email", "=", signer_email]], ["id"]],
      kwargs: { limit: 1 },
    });
    if (found?.length) {
      partnerId = found[0].id;
    } else {
      partnerId = await odooCall({
        ...ctx,
        model: "res.partner",
        method: "create",
        args: [{ name: signer_name, email: signer_email, phone: signer_phone }],
      });
    }

    const roleIds = await odooCall({
      ...ctx,
      model: "sign.item.role",
      method: "search",
      args: [[]],
      kwargs: { limit: 1 },
    });
    const roleId = roleIds?.[0];

    const requestId = await odooCall({
      ...ctx,
      model: "sign.request",
      method: "create",
      args: [{
        template_id: templateId,
        reference: reference || filename,
        subject,
        message,
        request_item_ids: [[0, 0, {
          partner_id: partnerId,
          role_id: roleId,
          mail_sent_order: 1,
        }]],
      }],
    });

    await odooCall({
      ...ctx,
      model: "sign.request",
      method: "action_sent",
      args: [[requestId]],
    });

    const items = await odooCall({
      ...ctx,
      model: "sign.request.item",
      method: "search_read",
      args: [[["sign_request_id", "=", requestId]], ["access_token", "partner_id"]],
    });
    const accessToken = items?.[0]?.access_token;
    const signUrl = accessToken
      ? `${base}/sign/document/${requestId}/${accessToken}`
      : `${base}/web#id=${requestId}&model=sign.request`;

    return res.status(200).json({
      request_id: requestId,
      template_id: templateId,
      partner_id: partnerId,
      sign_url: signUrl,
    });
  } catch (err) {
    return res.status(502).json({ error: "Odoo Sign unreachable", detail: String(err?.message || err) });
  }
}
