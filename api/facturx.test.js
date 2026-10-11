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

  it("retenue de garantie déduite du net à payer", () => {
    const xml = buildXML({
      invoice: { numero: "FAC-4", retenue_garantie_eur: 60, lignes: [ligne(1, 1000, 20)] },
      brand: brandNormal,
    });
    expect(tag(xml, "DuePayableAmount")).toEqual(["1140.00"]);
  });
});

describe("handler — archivage du Factur-X", () => {
  let upload, update;

  async function call(locked) {
    const doc = await PDFDocument.create();
    doc.addPage();
    const pdf_base64 = Buffer.from(await doc.save()).toString("base64");
    upload = vi.fn(async () => ({ error: null }));
    update = vi.fn(() => chain({ data: [{ statut: "envoyee", locked: true }], error: null }));
    function chain(result) {
      const c = { then: (r, j) => Promise.resolve(result).then(r, j) };
      for (const m of ["select", "eq", "maybeSingle"]) c[m] = vi.fn(() => (m === "maybeSingle" ? Promise.resolve(result) : c));
      return c;
    }
    adminMock = {
      from: vi.fn(() => {
        const c = chain({ data: { id: "inv-1", locked, statut: locked ? "envoyee" : "brouillon" }, error: null });
        c.update = update;
        return c;
      }),
      storage: { from: () => ({ upload }) },
    };
    const res = { statusCode: 0, body: null };
    res.status = (c) => { res.statusCode = c; return res; };
    res.json = (b) => { res.body = b; return res; };
    res.setHeader = () => {};
    res.end = () => res;
    await handler({
      method: "POST",
      headers: {},
      body: {
        pdf_base64,
        invoice: { id: "inv-1", numero: "FAC-9", lignes: [ligne(1, 100, 10)] },
        brand: { vatRegime: "normal" },
      },
    }, res);
    return res;
  }

  beforeEach(() => vi.clearAllMocks());

  it("brouillon : archive le PDF et fige les montants recalculés à l'émission", async () => {
    const res = await call(false);
    expect(res.statusCode).toBe(200);
    expect(upload.mock.calls[0][2]).toMatchObject({ upsert: true });
    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      statut: "envoyee", locked: true, montant_ht: 100, montant_tva: 10, montant_ttc: 110,
    }));
  });

  it("facture déjà émise : n'écrase pas le Factur-X archivé", async () => {
    const res = await call(true);
    expect(res.statusCode).toBe(200);
    expect(upload.mock.calls[0][2]).toMatchObject({ upsert: false });
    expect(update).not.toHaveBeenCalled();
  });
});
