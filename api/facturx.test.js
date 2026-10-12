// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { PDFDocument } from "pdf-lib";

let adminMock;
vi.mock("./_cors.js", () => ({ cors: () => {} }));
vi.mock("./_email.js", () => ({ sendEmail: vi.fn() }));
vi.mock("./_serverLog.js", () => ({ logServerError: vi.fn() }));
vi.mock("./_withAuth.js", () => ({
  authenticate: vi.fn(async () => ({ user: { id: "artisan-1" }, admin: adminMock })),
}));

import handler, { buildXML } from "./facturx.js";

const ligne = (quantite, prix_unitaire, tva_rate) => ({ type_ligne: "ouvrage", designation: "Poste", quantite, prix_unitaire, tva_rate });
const tag = (xml, name) => [...xml.matchAll(new RegExp(`<ram:${name}[^>]*>([^<]*)</ram:${name}>`, "g"))].map(m => m[1]);

describe("buildXML — TVA", () => {
  const brandNormal = { vatRegime: "normal", companyName: "ACME" };

  it("taux mixtes : un bloc par taux, totaux recalculés depuis les lignes", () => {
    const xml = buildXML({
      invoice: {
        numero: "FAC-1",
        lignes: [ligne(1, 1000, 10), ligne(2, 250, 20)],
        // montants périmés reçus du navigateur : ignorés
        montant_ht: 999, montant_tva: 1, montant_ttc: 1000,
      },
      brand: brandNormal,
    });
    expect(tag(xml, "CategoryCode")).toEqual(["S", "S", "S", "S"]);
    expect(tag(xml, "TaxBasisTotalAmount")).toEqual(["1500.00"]);
    expect(tag(xml, "GrandTotalAmount")).toEqual(["1700.00"]);
    expect(tag(xml, "CalculatedAmount")).toEqual(["100.00", "100.00"]);
  });

  it("franchise 293 B : catégorie E à 0 % avec motif d'exonération", () => {
    const xml = buildXML({
      invoice: { numero: "FAC-2", lignes: [ligne(1, 500, 20)] },
      brand: { vatRegime: "franchise" },
    });
    expect(tag(xml, "CategoryCode")).toEqual(["E", "E"]);
    expect(tag(xml, "RateApplicablePercent")).toEqual(["0.00", "0.00"]);
    expect(tag(xml, "ExemptionReason")[0]).toMatch(/293 B/);
    expect(tag(xml, "GrandTotalAmount")).toEqual(["500.00"]);
  });

  it("autoliquidation BTP : catégorie AE, pas de TVA, mention 283-2 nonies", () => {
    const xml = buildXML({
      invoice: { numero: "FAC-3", auto_liquidation_btp: true, lignes: [ligne(1, 800, 20)] },
      brand: brandNormal,
    });
    expect(tag(xml, "CategoryCode")).toEqual(["AE", "AE"]);
    expect(tag(xml, "TaxTotalAmount")).toEqual(["0.00"]);
    expect(tag(xml, "ExemptionReason")[0]).toMatch(/283-2 nonies/);
  });

  it("retenue de garantie : net à payer = TTC (BR-CO-16), retenue dans les conditions de paiement", () => {
    const xml = buildXML({
      invoice: { numero: "FAC-4", retenue_garantie_eur: 60, lignes: [ligne(1, 1000, 20)] },
      brand: brandNormal,
    });
    expect(tag(xml, "DuePayableAmount")).toEqual(["1200.00"]);
    expect(tag(xml, "Description")[0]).toMatch(/Retenue de garantie 60\.00 EUR/);
  });

  it("avoir : référence à la facture d'origine après les totaux (ordre du schéma CII)", () => {
    const xml = buildXML({
      invoice: { numero: "FAC-5", avoir_of_invoice_id: "x", lignes: [ligne(1, 100, 20)] },
      brand: brandNormal,
      sourceInvoice: { numero: "FAC-2", date_emission: "2026-10-01" },
    });
    expect(tag(xml, "TypeCode")).toContain("381");
    const settlement = xml.slice(xml.indexOf("<ram:ApplicableHeaderTradeSettlement>"));
    expect(settlement.indexOf("<ram:InvoiceCurrencyCode>")).toBeLessThan(settlement.indexOf("<ram:SpecifiedTradeSettlementHeaderMonetarySummation>"));
    expect(settlement.indexOf("</ram:SpecifiedTradeSettlementHeaderMonetarySummation>")).toBeLessThan(settlement.indexOf("<ram:InvoiceReferencedDocument>"));
  });

  it("acheteur : n° de TVA (BT-48), exigé en autoliquidation", () => {
    const xml = buildXML({
      invoice: { numero: "FAC-6", auto_liquidation_btp: true, lignes: [ligne(1, 800, 20)] },
      client: { raison_sociale: "Entreprise Générale", siret: "12345678900011", tva_intra: "FR12 345678901" },
      brand: { ...brandNormal, siret: "98765432100022", tva: "FR98987654321" },
    });
    const buyer = xml.slice(xml.indexOf("<ram:BuyerTradeParty>"), xml.indexOf("</ram:BuyerTradeParty>"));
    expect(buyer).toContain('<ram:ID schemeID="VA">FR12345678901</ram:ID>');
  });

  it("ligne à 0 % hors franchise : exonérée, sans citer l'art. 293 B", () => {
    const xml = buildXML({
      invoice: { numero: "FAC-7", lignes: [ligne(1, 100, 0), ligne(1, 100, 20)] },
      brand: brandNormal,
    });
    expect(tag(xml, "ExemptionReason")).toEqual(["Opération exonérée de TVA"]);
  });
});

// Mock minimal de supabase-js : chaque table renvoie ses données ; les
// méthodes de filtre se chaînent, maybeSingle() rend une ligne, await rend
// la liste.
function makeAdmin({ invoice, lignes = [], profile = { brand_data: { vatRegime: "normal" } }, rpc }) {
  const updates = [];
  const upload = vi.fn(async () => ({ error: null }));
  const chain = (table) => {
    const rows = table === "invoices" ? invoice : table === "lignes_invoices" ? lignes : profile;
    const c = {
      then: (r, j) => Promise.resolve({ data: rows, error: null }).then(r, j),
      maybeSingle: vi.fn(async () => ({ data: rows, error: null })),
      update: vi.fn((patch) => { updates.push({ table, patch }); return chain(table); }),
    };
    for (const m of ["select", "eq", "is", "order"]) c[m] = vi.fn(() => c);
    return c;
  };
  return {
    admin: { from: vi.fn(chain), rpc: rpc || vi.fn(), storage: { from: () => ({ upload }) } },
    updates, upload,
  };
}

async function callHandler(body) {
  const res = { statusCode: 0, body: null };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  res.setHeader = () => {};
  res.end = () => res;
  await handler({ method: "POST", headers: {}, body }, res);
  return res;
}

async function blankPdf() {
  const doc = await PDFDocument.create();
  doc.addPage();
  return Buffer.from(await doc.save()).toString("base64");
}

describe("handler — génération et archivage du Factur-X", () => {
  beforeEach(() => vi.clearAllMocks());
  const emitted = { id: "inv-1", owner_id: "artisan-1", statut: "envoyee", locked: true, numero: "FAC-2026-0007", date_emission: "2026-10-12" };

  it("brouillon : refusé, l'émission doit passer d'abord (ancienne version de l'app)", async () => {
    const m = makeAdmin({ invoice: { id: "inv-1", statut: "brouillon", locked: false, numero: null } });
    adminMock = m.admin;
    const res = await callHandler({ pdf_base64: await blankPdf(), invoice: { id: "inv-1", numero: "FAC-2026-0099" } });
    expect(res.statusCode).toBe(409);
    expect(res.body.code).toBe("emit_first");
    expect(m.upload).not.toHaveBeenCalled();
  });

  it("première archive : numéro lu en base (pas celui du navigateur), PDF de travail remplacé, archivage noté", async () => {
    const m = makeAdmin({ invoice: { ...emitted, facturx_archived_at: null }, lignes: [ligne(1, 100, 10)] });
    adminMock = m.admin;
    const res = await callHandler({
      pdf_base64: await blankPdf(),
      invoice: { id: "inv-1", numero: "FAC-2026-0001", lignes: [ligne(1, 999, 20)] },
      brand: { vatRegime: "normal" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.body.numero).toBe("FAC-2026-0007");
    expect(m.upload.mock.calls[0][0]).toBe("artisan-1/invoices/FAC-2026-0007.pdf");
    expect(m.upload.mock.calls[0][2]).toMatchObject({ upsert: true });
    expect(m.updates).toEqual([{ table: "invoices", patch: { facturx_archived_at: expect.any(String) } }]);
  });

  it("archive déjà faite : jamais écrasée", async () => {
    const m = makeAdmin({ invoice: { ...emitted, facturx_archived_at: "2026-10-12T08:00:00Z" }, lignes: [ligne(1, 100, 10)] });
    adminMock = m.admin;
    const res = await callHandler({ pdf_base64: await blankPdf(), invoice: { id: "inv-1" }, brand: { vatRegime: "normal" } });
    expect(res.statusCode).toBe(200);
    expect(m.upload.mock.calls[0][2]).toMatchObject({ upsert: false });
    expect(m.updates).toEqual([]);
  });
});

describe("handler — émission (numéro attribué par le serveur)", () => {
  beforeEach(() => vi.clearAllMocks());
  const draft = { id: "inv-1", statut: "brouillon", locked: false, deleted_at: null, auto_liquidation_btp: false };

  it("brouillon : montants recalculés depuis les lignes en base, numéro et date pris par emit_invoice", async () => {
    const rpc = vi.fn(async () => ({ data: { numero: "FAC-2026-0008", date_emission: "2026-10-12", date_echeance: "2026-11-11", statut: "envoyee", locked: true }, error: null }));
    const m = makeAdmin({ invoice: draft, lignes: [ligne(1, 100, 10)], rpc });
    adminMock = m.admin;
    const res = await callHandler({ action: "emit", invoice_id: "inv-1" });
    expect(res.statusCode).toBe(200);
    expect(rpc).toHaveBeenCalledWith("emit_invoice", { p_invoice_id: "inv-1", p_owner_id: "artisan-1", p_ht: 100, p_tva: 10, p_ttc: 110 });
    expect(res.body).toMatchObject({ numero: "FAC-2026-0008", locked: true, montant_ttc: 110 });
  });

  it("franchise en base : pas de TVA, quel que soit le taux des lignes", async () => {
    const rpc = vi.fn(async () => ({ data: { numero: "FAC-2026-0009", locked: true }, error: null }));
    const m = makeAdmin({ invoice: draft, lignes: [ligne(2, 50, 20)], profile: { brand_data: { vatRegime: "franchise" } }, rpc });
    adminMock = m.admin;
    await callHandler({ action: "emit", invoice_id: "inv-1" });
    expect(rpc.mock.calls[0][1]).toMatchObject({ p_ht: 100, p_tva: 0, p_ttc: 100 });
  });

  it("sans ligne : refusé, aucun numéro consommé", async () => {
    const rpc = vi.fn();
    const m = makeAdmin({ invoice: draft, lignes: [], rpc });
    adminMock = m.admin;
    const res = await callHandler({ action: "emit", invoice_id: "inv-1" });
    expect(res.statusCode).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("facture d'un autre artisan : 403", async () => {
    const rpc = vi.fn();
    const m = makeAdmin({ invoice: null, rpc });
    adminMock = m.admin;
    const res = await callHandler({ action: "emit", invoice_id: "inv-x" });
    expect(res.statusCode).toBe(403);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("migration 0060 absente : message clair, pas d'erreur brute", async () => {
    const rpc = vi.fn(async () => ({ data: null, error: { code: "PGRST202", message: "Could not find the function" } }));
    const m = makeAdmin({ invoice: draft, lignes: [ligne(1, 100, 10)], rpc });
    adminMock = m.admin;
    const res = await callHandler({ action: "emit", invoice_id: "inv-1" });
    expect(res.statusCode).toBe(503);
  });
});
