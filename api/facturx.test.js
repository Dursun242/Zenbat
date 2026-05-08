// Tests unitaires de buildXML — valide la conformité EN 16931 / Peppol BIS 3.0
// du XML CII produit pour chaque scénario fiscal :
//   - facture standard 20%
//   - multi-taux (5.5% / 10% / 20%)
//   - franchise art. 293 B (cat E)
//   - auto-liquidation BTP art. 283-2 (cat AE)
//   - avoir TypeCode=381 + InvoiceReferencedDocument
//   - mix avoir + auto-liq

import { describe, expect, it } from "vitest";
import { buildXML } from "./facturx.js";

const baseBrand = {
  companyName: "ID MAITRISE",
  firstName: "Dursun",
  lastName: "OZKAN",
  siret: "92153618100024",
  tva: "FR12921536181",
  address: "9 Rue Henry Genestal",
  city: "76600 LE HAVRE",
  email: "contact@id-maitrise.com",
  phone: "0679116085",
  vatRegime: "normal",
};

const baseClient = {
  raison_sociale: "ACME Corp",
  siret: "53224519400028",
  adresse: "1 rue de la Paix",
  code_postal: "75001",
  ville: "Paris",
  email: "client@acme.fr",
};

const mkLine = (overrides = {}) => ({
  type_ligne: "ouvrage",
  designation: "Prestation",
  unite: "u",
  quantite: 1,
  prix_unitaire: 100,
  tva_rate: 20,
  ...overrides,
});

const baseInvoice = (overrides = {}) => ({
  numero: "FAC-2026-0001",
  date_emission: "2026-05-08",
  date_echeance: "2026-06-08",
  objet: "Test",
  lignes: [mkLine()],
  montant_ht: 100,
  montant_tva: 20,
  montant_ttc: 120,
  ...overrides,
});

describe("buildXML — facture standard 20%", () => {
  it("produit TypeCode=380, cat=S, rate=20, total cohérent", () => {
    const xml = buildXML({ invoice: baseInvoice(), client: baseClient, brand: baseBrand });
    expect(xml).toContain("<ram:TypeCode>380</ram:TypeCode>");
    expect(xml).toContain('<ram:CategoryCode>S</ram:CategoryCode>');
    expect(xml).toContain("<ram:RateApplicablePercent>20.00</ram:RateApplicablePercent>");
    expect(xml).toContain("<ram:LineTotalAmount>100.00</ram:LineTotalAmount>");
    expect(xml).toContain("<ram:GrandTotalAmount>120.00</ram:GrandTotalAmount>");
    expect(xml).not.toContain("<ram:CategoryCode>AE</ram:CategoryCode>");
    expect(xml).not.toContain("<ram:CategoryCode>E</ram:CategoryCode>");
  });
});

describe("buildXML — multi-taux TVA", () => {
  it("ventile 5.5% / 10% / 20% en 3 ApplicableTradeTax séparés", () => {
    const inv = baseInvoice({
      lignes: [
        mkLine({ designation: "Travaux 20%",  prix_unitaire: 1000, tva_rate: 20  }),
        mkLine({ designation: "Travaux 10%",  prix_unitaire: 500,  tva_rate: 10  }),
        mkLine({ designation: "Travaux 5.5%", prix_unitaire: 200,  tva_rate: 5.5 }),
      ],
      montant_ht:  1700,
      montant_tva: 261,   // 200 + 50 + 11
      montant_ttc: 1961,
    });
    const xml = buildXML({ invoice: inv, client: baseClient, brand: baseBrand });
    expect(xml).toContain("<ram:RateApplicablePercent>20.00</ram:RateApplicablePercent>");
    expect(xml).toContain("<ram:RateApplicablePercent>10.00</ram:RateApplicablePercent>");
    expect(xml).toContain("<ram:RateApplicablePercent>5.50</ram:RateApplicablePercent>");
    // BasisAmount par taux
    expect(xml).toContain("<ram:BasisAmount>1000.00</ram:BasisAmount>");
    expect(xml).toContain("<ram:BasisAmount>500.00</ram:BasisAmount>");
    expect(xml).toContain("<ram:BasisAmount>200.00</ram:BasisAmount>");
    // CalculatedAmount par taux
    expect(xml).toContain("<ram:CalculatedAmount>200.00</ram:CalculatedAmount>");
    expect(xml).toContain("<ram:CalculatedAmount>50.00</ram:CalculatedAmount>");
    expect(xml).toContain("<ram:CalculatedAmount>11.00</ram:CalculatedAmount>");
  });
});

describe("buildXML — franchise art. 293 B", () => {
  it("force cat=E, rate=0, ExemptionReason franchise sur toutes les lignes", () => {
    const xml = buildXML({
      invoice: baseInvoice({ lignes: [mkLine({ tva_rate: 0 })], montant_tva: 0, montant_ttc: 100 }),
      client: baseClient,
      brand: { ...baseBrand, vatRegime: "franchise" },
    });
    expect(xml).toContain("<ram:CategoryCode>E</ram:CategoryCode>");
    expect(xml).toContain("<ram:ExemptionReason>TVA non applicable, art. 293 B du CGI</ram:ExemptionReason>");
    expect(xml).not.toContain("<ram:CategoryCode>S</ram:CategoryCode>");
    // Pas de TVA calculée
    expect(xml).toContain("<ram:CalculatedAmount>0.00</ram:CalculatedAmount>");
  });

  it("force rate=0 même si une ligne a tva_rate=20 stocké en DB (régression)", () => {
    // Cas du seller qui passe en franchise APRÈS avoir saisi des lignes à 20%
    const xml = buildXML({
      invoice: baseInvoice({
        lignes: [mkLine({ tva_rate: 20, prix_unitaire: 100 })],
      }),
      client: baseClient,
      brand: { ...baseBrand, vatRegime: "franchise" },
    });
    // La ligne ET le breakdown doivent être cat=E rate=0, pas S 20%
    expect(xml).not.toContain("<ram:RateApplicablePercent>20.00</ram:RateApplicablePercent>");
    expect(xml).toContain("<ram:CategoryCode>E</ram:CategoryCode>");
    expect(xml).toContain("<ram:RateApplicablePercent>0.00</ram:RateApplicablePercent>");
  });
});

describe("buildXML — auto-liquidation BTP art. 283-2", () => {
  it("force cat=AE, rate=0, ExemptionReason auto-liq", () => {
    const xml = buildXML({
      invoice: baseInvoice({ auto_liquidation_btp: true, lignes: [mkLine({ tva_rate: 0 })], montant_tva: 0, montant_ttc: 100 }),
      client: baseClient,
      brand: baseBrand,
    });
    expect(xml).toContain("<ram:CategoryCode>AE</ram:CategoryCode>");
    expect(xml).toContain("<ram:ExemptionReason>Autoliquidation — TVA due par le preneur, art. 283-2 nonies CGI</ram:ExemptionReason>");
    expect(xml).not.toContain("<ram:CategoryCode>S</ram:CategoryCode>");
    expect(xml).not.toContain("<ram:CategoryCode>E</ram:CategoryCode>");
  });

  it("force rate=0 même si lignes ont tva_rate=20 (cas BTP qui coche la case)", () => {
    const xml = buildXML({
      invoice: baseInvoice({ auto_liquidation_btp: true, lignes: [mkLine({ tva_rate: 20 })] }),
      client: baseClient,
      brand: baseBrand,
    });
    expect(xml).not.toContain("<ram:RateApplicablePercent>20.00</ram:RateApplicablePercent>");
    expect(xml).toContain("<ram:CategoryCode>AE</ram:CategoryCode>");
  });

  it("auto-liq prime sur franchise (un sous-traitant en franchise reste AE)", () => {
    const xml = buildXML({
      invoice: baseInvoice({ auto_liquidation_btp: true }),
      client: baseClient,
      brand: { ...baseBrand, vatRegime: "franchise" },
    });
    expect(xml).toContain("<ram:CategoryCode>AE</ram:CategoryCode>");
    expect(xml).not.toContain("<ram:CategoryCode>E</ram:CategoryCode>");
    expect(xml).toContain("<ram:ExemptionReason>Autoliquidation");
  });
});

describe("buildXML — avoir (TypeCode=381)", () => {
  const sourceInvoice = { numero: "FAC-2026-0002", date_emission: "2026-05-01" };

  it("produit TypeCode=381 et InvoiceReferencedDocument à la fin de TradeSettlement", () => {
    const xml = buildXML({
      invoice: baseInvoice({ numero: "FAC-2026-0003", avoir_of_invoice_id: "uuid-source" }),
      client: baseClient, brand: baseBrand, sourceInvoice,
    });
    expect(xml).toContain("<ram:TypeCode>381</ram:TypeCode>");
    expect(xml).toContain("<ram:InvoiceReferencedDocument>");
    expect(xml).toContain("<ram:IssuerAssignedID>FAC-2026-0002</ram:IssuerAssignedID>");
    expect(xml).toContain('format="102">20260501</qdt:DateTimeString>');
    // Doit être APRÈS Summation, AVANT </ApplicableHeaderTradeSettlement>
    const idxSummation = xml.indexOf("</ram:SpecifiedTradeSettlementHeaderMonetarySummation>");
    const idxRefDoc   = xml.indexOf("<ram:InvoiceReferencedDocument>");
    const idxEndSettl = xml.indexOf("</ram:ApplicableHeaderTradeSettlement>");
    expect(idxSummation).toBeGreaterThan(0);
    expect(idxRefDoc).toBeGreaterThan(idxSummation);
    expect(idxEndSettl).toBeGreaterThan(idxRefDoc);
  });

  it("force valeur absolue sur lignes négatives (Peppol BIS rule)", () => {
    const xml = buildXML({
      invoice: baseInvoice({
        avoir_of_invoice_id: "uuid",
        lignes: [mkLine({ quantite: -1, prix_unitaire: 2000 })],
        montant_ht: -2000, montant_tva: -400, montant_ttc: -2400,
      }),
      client: baseClient, brand: baseBrand, sourceInvoice,
    });
    expect(xml).toContain("<ram:LineTotalAmount>2000.00</ram:LineTotalAmount>");
    expect(xml).toContain("<ram:GrandTotalAmount>2400.00</ram:GrandTotalAmount>");
    expect(xml).not.toContain("-2000.00");
    expect(xml).not.toContain("-2400.00");
  });

  it("recalcule totalHT depuis lignes abs (cas mix +/- saisi par user)", () => {
    // 22 - 22 + 2 - 2 + 50 = 50 signé, mais 22+22+2+2+50 = 98 abs
    const xml = buildXML({
      invoice: baseInvoice({
        avoir_of_invoice_id: "uuid",
        lignes: [
          mkLine({ prix_unitaire: 22 }),
          mkLine({ prix_unitaire: -22 }),
          mkLine({ prix_unitaire: 2 }),
          mkLine({ prix_unitaire: -2 }),
          mkLine({ prix_unitaire: 50 }),
        ],
        montant_ht: 50, // somme signée stockée
      }),
      client: baseClient, brand: baseBrand, sourceInvoice,
    });
    // Sum lignes abs = 22+22+2+2+50 = 98 ; document.LineTotalAmount doit
    // matcher (cohérence sum lines = TaxBasis = TotalHT). On extrait le
    // bloc Summation pour vérifier sans confondre avec les LineTotalAmount
    // des lignes individuelles.
    const summationStart = xml.indexOf("<ram:SpecifiedTradeSettlementHeaderMonetarySummation>");
    const summationEnd   = xml.indexOf("</ram:SpecifiedTradeSettlementHeaderMonetarySummation>");
    const summation      = xml.slice(summationStart, summationEnd);
    expect(summation).toContain("<ram:LineTotalAmount>98.00</ram:LineTotalAmount>");
    expect(summation).toContain("<ram:TaxBasisTotalAmount>98.00</ram:TaxBasisTotalAmount>");
    expect(summation).not.toContain("50.00"); // pas la somme signée stockée
  });
});

describe("buildXML — Electronic Address (BT-34/BT-49)", () => {
  it("seller : SIRET → schemeID=0009 par défaut", () => {
    const xml = buildXML({ invoice: baseInvoice(), client: baseClient, brand: baseBrand });
    expect(xml).toContain('<ram:URIID schemeID="0009">92153618100024</ram:URIID>');
  });

  it("override Peppol address sur seller via brand.peppolAddress", () => {
    const xml = buildXML({
      invoice: baseInvoice(), client: baseClient,
      brand: { ...baseBrand, peppolAddress: "0225:315143296_6591" },
    });
    expect(xml).toContain('<ram:URIID schemeID="0225">315143296_6591</ram:URIID>');
    // Pas le schemeID 0009 du SIRET pour le seller
    const sellerStart = xml.indexOf("<ram:SellerTradeParty>");
    const sellerEnd   = xml.indexOf("</ram:SellerTradeParty>");
    const sellerBlock = xml.slice(sellerStart, sellerEnd);
    expect(sellerBlock).toContain('schemeID="0225"');
    expect(sellerBlock).not.toContain('schemeID="0009"');
  });

  it("override Peppol sur buyer via client.peppolAddress", () => {
    const xml = buildXML({
      invoice: baseInvoice(), brand: baseBrand,
      client: { ...baseClient, peppolAddress: "0225:315143296_6591" },
    });
    const buyerStart = xml.indexOf("<ram:BuyerTradeParty>");
    const buyerEnd   = xml.indexOf("</ram:BuyerTradeParty>");
    const buyerBlock = xml.slice(buyerStart, buyerEnd);
    expect(buyerBlock).toContain('schemeID="0225">315143296_6591');
  });
});
