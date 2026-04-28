import { createClient } from "@supabase/supabase-js";
import { cors } from "./_cors.js";

// Proxy vers Odoo Sign — authentifie, upload le PDF, crée une demande de signature
// Le client doit envoyer un Authorization: Bearer <supabase_access_token>.
// Variables d'environnement requises côté Vercel :
//   ODOO_URL       ex: https://zenbat.odoo.com
//   ODOO_DB        ex: zenbat
//   ODOO_USERNAME  ex: admin@zenbat.fr
//   ODOO_API_KEY   ex: <API key générée dans Odoo → Préférences → Compte>

const ODOO_CALL_TIMEOUT_MS = 10000;

function odooFetch(url, init) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ODOO_CALL_TIMEOUT_MS);
  return fetch(url, { ...init, signal: ctrl.signal }).finally(() => clearTimeout(t));
}

async function odooCall({ base, db, uid, password, model, method, args=[], kwargs={} }) {
  const res = await odooFetch(`${base}/jsonrpc`, {
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
  const res = await odooFetch(`${base}/jsonrpc`, {
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
  cors(req, res, { methods: "POST, OPTIONS", auth: true });

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) return res.status(401).json({ error: "Non authentifié" });

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey)
    return res.status(500).json({ error: "Supabase non configuré" });

  const supaAdmin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: { user }, error: authErr } = await supaAdmin.auth.getUser(token);
  if (authErr || !user) return res.status(401).json({ error: "Token invalide" });

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
      company_name = "", company_email = "", company_phone = "",
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

    // Partner "entreprise émettrice" (pour copie), distinct du signataire.
    let companyPartnerId = null;
    if (company_email && company_email !== signer_email) {
      const foundCo = await odooCall({
        ...ctx,
        model: "res.partner",
        method: "search_read",
        args: [[["email", "=", company_email]], ["id"]],
        kwargs: { limit: 1 },
      });
      if (foundCo?.length) {
        companyPartnerId = foundCo[0].id;
      } else {
        companyPartnerId = await odooCall({
          ...ctx,
          model: "res.partner",
          method: "create",
          args: [{ name: company_name || company_email, email: company_email, phone: company_phone }],
        });
      }
    }

    const roleIds = await odooCall({
      ...ctx,
      model: "sign.item.role",
      method: "search",
      args: [[]],
      kwargs: { limit: 1 },
    });
    const roleId = roleIds?.[0];

    // Introspecte sign.request pour n'envoyer que les champs supportés
    const reqFields = await odooCall({
      ...ctx,
      model: "sign.request",
      method: "fields_get",
      args: [],
      kwargs: { attributes: ["type"] },
    });

    const reqPayload = {
      template_id: templateId,
      reference: reference || filename,
      subject,
      message,
      request_item_ids: [[0, 0, {
        partner_id: partnerId,
        role_id: roleId,
        mail_sent_order: 1,
      }]],
    };
    // L'entreprise émettrice est ajoutée en COPIE, pas en tant que signataire.
    // Selon la version d'Odoo, le champ peut s'appeler cc_partner_ids ou message_partner_ids.
    if (companyPartnerId) {
      const ccField = ["cc_partner_ids", "message_partner_ids"].find(f => reqFields[f]);
      if (ccField) reqPayload[ccField] = [[6, 0, [companyPartnerId]]];
    }
    // Bonus : pousse l'email de l'entreprise en reply_to si le champ existe
    if (company_email && reqFields.reply_to) reqPayload.reply_to = company_email;
    // Suffixe le sujet avec le nom d'entreprise pour maximiser la visibilité
    if (company_name && !String(subject).includes(company_name)) {
      reqPayload.subject = `${subject} [${company_name}]`;
    }

    const requestId = await odooCall({
      ...ctx,
      model: "sign.request",
      method: "create",
      args: [reqPayload],
    });

    // Abonne l'entreprise comme follower (reçoit les notifs : signé, refusé, etc.)
    // sans être signataire. Fallback si cc_partner_ids n'est pas supporté.
    if (companyPartnerId) {
      try {
        await odooCall({
          ...ctx,
          model: "sign.request",
          method: "message_subscribe",
          args: [[requestId], [companyPartnerId]],
        });
      } catch { /* best effort */ }
    }

    // Essaie plusieurs noms de méthode pour l'envoi (varie selon version Odoo).
    // Sur Odoo récent, la request est envoyée automatiquement à la création.
    const sendCandidates = ["action_sent", "action_send", "send_signature_accesses"];
    for (const method of sendCandidates) {
      try {
        await odooCall({ ...ctx, model: "sign.request", method, args: [[requestId]] });
        break;
      } catch (e) {
        if (!/does not exist|Invalid method/i.test(String(e.message || ""))) throw e;
      }
    }

    // Récupère l'access_token pour construire le lien de signature
    const items = await odooCall({
      ...ctx,
      model: "sign.request.item",
      method: "search_read",
      args: [[["sign_request_id", "=", requestId]], ["id", "access_token", "partner_id"]],
    });
    const accessToken = items?.[0]?.access_token;
    const itemIds = (items || []).map(i => i.id);
    const signUrl = accessToken
      ? `${base}/sign/document/${requestId}/${accessToken}`
      : `${base}/web#id=${requestId}&model=sign.request`;

    // Réécrit entièrement les mails sortants : nouvel expéditeur (entreprise qui
    // édite le devis) + corps HTML propre sans la mention Odoo du créateur.
    if (company_email) {
      const safeCompany = (company_name || "").replace(/"/g, "'");
      const fromFormatted = safeCompany
        ? `"${safeCompany}" <${company_email}>`
        : company_email;
      const esc = (s) => String(s || "").replace(/[&<>"']/g, c => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
      })[c]);
      const contactLine = [
        company_phone ? `au <strong>${esc(company_phone)}</strong>` : "",
        company_email ? `ou par mail à <a href="mailto:${esc(company_email)}">${esc(company_email)}</a>` : "",
      ].filter(Boolean).join(" ");
      const bodyHtml = `
<div style="font-family:Arial,sans-serif;font-size:14px;color:#0f172a;line-height:1.6;max-width:600px">
  <p>Bonjour ${esc(signer_name || "")},</p>
  <p>Votre devis <strong>${esc(reference || filename)}</strong> est prêt. <strong>${esc(company_name || "Notre entreprise")}</strong> vous invite à le consulter en ligne.</p>
  <p style="margin:24px 0">
    <a href="${esc(signUrl)}" style="display:inline-block;background:#22c55e;color:white;padding:14px 28px;border-radius:10px;text-decoration:none;font-weight:700;font-size:15px">Consulter votre devis</a>
  </p>
  ${contactLine ? `<p>Pour toute question, n'hésitez pas à nous contacter ${contactLine}.</p>` : ""}
  <p>Cordialement,<br/><strong>${esc(company_name || "")}</strong></p>
</div>`.trim();

      try {
        // Ne touche QUE les mails encore en file (state='outgoing'), pour éviter
        // de renvoyer un mail déjà parti (double email).
        const mailDomain = itemIds.length
          ? [
              ["state", "=", "outgoing"],
              "|",
              "&", ["model", "=", "sign.request"], ["res_id", "=", requestId],
              "&", ["model", "=", "sign.request.item"], ["res_id", "in", itemIds],
            ]
          : [
              ["state", "=", "outgoing"],
              ["model", "=", "sign.request"],
              ["res_id", "=", requestId],
            ];
        const mailIds = await odooCall({
          ...ctx,
          model: "mail.mail",
          method: "search",
          args: [mailDomain],
        });
        if (mailIds?.length) {
          await odooCall({
            ...ctx,
            model: "mail.mail",
            method: "write",
            args: [mailIds, {
              email_from: fromFormatted,
              reply_to: company_email,
              body_html: bodyHtml,
              subject: subject,
            }],
          });
          // Pas de mail.mail.send() ici : Odoo dispatche via son cron,
          // un send manuel provoquerait un double envoi si le mail est
          // déjà parti entre-temps.
        }
      } catch (_) { /* best effort */ }
    }

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
