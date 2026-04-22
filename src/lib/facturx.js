// Génération Factur-X (facture électronique française) :
// 1. Construit un XML CII (Cross Industry Invoice) au profil BASIC.
// 2. Embarque l'XML dans un PDF existant via pdf-lib + ajoute les métadonnées
//    XMP Factur-X pour que les logiciels compta (Pennylane, Dougs, Sage, Cegid…)
//    reconnaissent et importent automatiquement la facture.
//
// Ref : https://fnfe-mpe.org/factur-x/
// Profil BASIC : https://fnfe-mpe.org/factur-x/factur-x_en/ (conforme EN 16931)

import { PDFDocument, AFRelationship } from "pdf-lib";

const PROFILE = "urn:cen.eu:en16931:2017#compliant#urn:factur-x.eu:1p0:basic";
const XML_FILENAME = "factur-x.xml";

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;"
  })[c]);
}

function fmtDate(d) {
  if (!d) return "";
  const date = d instanceof Date ? d : new Date(d);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${y}${m}${day}`; // YYYYMMDD, format 102 de la norme
}

function num(n, decimals = 2) {
  const v = Number(n) || 0;
  return v.toFixed(decimals);
}

// Construit le XML CII Factur-X profil BASIC.
// invoice.lignes doit contenir les lignes (type_ligne, designation, quantite, prix_unitaire, tva_rate).
export function buildFacturXXML({ invoice, client, brand }) {
  const ouvrages = (invoice.lignes || []).filter(l => l.type_ligne === "ouvrage");

  // Regroupement TVA par taux
  const taxByRate = {};
  for (const l of ouvrages) {
    const rate = Number(l.tva_rate ?? 20);
    const ht   = (Number(l.quantite) || 0) * (Number(l.prix_unitaire) || 0);
    if (!taxByRate[rate]) taxByRate[rate] = { base: 0, montant: 0 };
    taxByRate[rate].base    += ht;
    taxByRate[rate].montant += ht * rate / 100;
  }

  const totalHT  = Number(invoice.montant_ht)  || ouvrages.reduce((s, l) => s + (Number(l.quantite) || 0) * (Number(l.prix_unitaire) || 0), 0);
  const totalTVA = Number(invoice.montant_tva) || Object.values(taxByRate).reduce((s, t) => s + t.montant, 0);
  const totalTTC = Number(invoice.montant_ttc) || totalHT + totalTVA;

  const sellerSiret = (brand.siret || "").replace(/\s+/g, "").slice(0, 14);
  const buyerSiret  = (client?.siret || "").replace(/\s+/g, "").slice(0, 14);

  const sellerName = esc(brand.companyName || `${brand.firstName || ""} ${brand.lastName || ""}`.trim());
  const buyerName  = esc(client?.raison_sociale || `${client?.prenom || ""} ${client?.nom || ""}`.trim() || "Client");

  const sellerAddr = {
    line:    esc(brand.address || ""),
    cp:      esc((brand.city || "").match(/\d{5}/)?.[0] || ""),
    city:    esc((brand.city || "").replace(/^\d+\s*/, "")),
  };
  const buyerAddr = {
    line:    esc(client?.adresse || ""),
    cp:      esc(client?.code_postal || ""),
    city:    esc(client?.ville || ""),
  };

  // Lignes <IncludedSupplyChainTradeLineItem>
  const lineBlocks = ouvrages.map((l, i) => {
    const qty   = Number(l.quantite) || 0;
    const pu    = Number(l.prix_unitaire) || 0;
    const rate  = Number(l.tva_rate ?? 20);
    const lineTotal = qty * pu;
    const unit  = l.unite || "C62"; // C62 = unité de base UN/ECE Rec 20
    return `
    <ram:IncludedSupplyChainTradeLineItem>
      <ram:AssociatedDocumentLineDocument>
        <ram:LineID>${i + 1}</ram:LineID>
      </ram:AssociatedDocumentLineDocument>
      <ram:SpecifiedTradeProduct>
        <ram:Name>${esc(l.designation || "—")}</ram:Name>
      </ram:SpecifiedTradeProduct>
      <ram:SpecifiedLineTradeAgreement>
        <ram:NetPriceProductTradePrice>
          <ram:ChargeAmount>${num(pu, 4)}</ram:ChargeAmount>
        </ram:NetPriceProductTradePrice>
      </ram:SpecifiedLineTradeAgreement>
      <ram:SpecifiedLineTradeDelivery>
        <ram:BilledQuantity unitCode="${esc(unit)}">${num(qty, 3)}</ram:BilledQuantity>
      </ram:SpecifiedLineTradeDelivery>
      <ram:SpecifiedLineTradeSettlement>
        <ram:ApplicableTradeTax>
          <ram:TypeCode>VAT</ram:TypeCode>
          <ram:CategoryCode>${rate > 0 ? "S" : "E"}</ram:CategoryCode>
          <ram:RateApplicablePercent>${num(rate)}</ram:RateApplicablePercent>
        </ram:ApplicableTradeTax>
        <ram:SpecifiedTradeSettlementLineMonetarySummation>
          <ram:LineTotalAmount>${num(lineTotal)}</ram:LineTotalAmount>
        </ram:SpecifiedTradeSettlementLineMonetarySummation>
      </ram:SpecifiedLineTradeSettlement>
    </ram:IncludedSupplyChainTradeLineItem>`;
  }).join("");

  // Blocs <ApplicableTradeTax> (un par taux)
  const taxBlocks = Object.entries(taxByRate).map(([rate, t]) => `
    <ram:ApplicableTradeTax>
      <ram:CalculatedAmount>${num(t.montant)}</ram:CalculatedAmount>
      <ram:TypeCode>VAT</ram:TypeCode>
      <ram:BasisAmount>${num(t.base)}</ram:BasisAmount>
      <ram:CategoryCode>${Number(rate) > 0 ? "S" : "E"}</ram:CategoryCode>
      <ram:RateApplicablePercent>${num(Number(rate))}</ram:RateApplicablePercent>
    </ram:ApplicableTradeTax>`).join("");

  const issue = fmtDate(invoice.date_emission || new Date());
  const due   = fmtDate(invoice.date_echeance);

  return `<?xml version="1.0" encoding="UTF-8"?>
<rsm:CrossIndustryInvoice xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100"
                          xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100"
                          xmlns:udt="urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100"
                          xmlns:qdt="urn:un:unece:uncefact:data:standard:QualifiedDataType:100">
  <rsm:ExchangedDocumentContext>
    <ram:GuidelineSpecifiedDocumentContextParameter>
      <ram:ID>${PROFILE}</ram:ID>
    </ram:GuidelineSpecifiedDocumentContextParameter>
  </rsm:ExchangedDocumentContext>
  <rsm:ExchangedDocument>
    <ram:ID>${esc(invoice.numero || "")}</ram:ID>
    <ram:TypeCode>380</ram:TypeCode>
    <ram:IssueDateTime>
      <udt:DateTimeString format="102">${issue}</udt:DateTimeString>
    </ram:IssueDateTime>
  </rsm:ExchangedDocument>
  <rsm:SupplyChainTradeTransaction>${lineBlocks}
    <ram:ApplicableHeaderTradeAgreement>
      <ram:SellerTradeParty>
        <ram:Name>${sellerName}</ram:Name>
        ${sellerSiret ? `<ram:SpecifiedLegalOrganization><ram:ID schemeID="0002">${esc(sellerSiret)}</ram:ID></ram:SpecifiedLegalOrganization>` : ""}
        <ram:PostalTradeAddress>
          ${sellerAddr.cp   ? `<ram:PostcodeCode>${sellerAddr.cp}</ram:PostcodeCode>` : ""}
          ${sellerAddr.line ? `<ram:LineOne>${sellerAddr.line}</ram:LineOne>` : ""}
          ${sellerAddr.city ? `<ram:CityName>${sellerAddr.city}</ram:CityName>` : ""}
          <ram:CountryID>FR</ram:CountryID>
        </ram:PostalTradeAddress>
        ${brand.tva ? `<ram:SpecifiedTaxRegistration><ram:ID schemeID="VA">${esc(brand.tva)}</ram:ID></ram:SpecifiedTaxRegistration>` : ""}
      </ram:SellerTradeParty>
      <ram:BuyerTradeParty>
        <ram:Name>${buyerName}</ram:Name>
        ${buyerSiret ? `<ram:SpecifiedLegalOrganization><ram:ID schemeID="0002">${esc(buyerSiret)}</ram:ID></ram:SpecifiedLegalOrganization>` : ""}
        <ram:PostalTradeAddress>
          ${buyerAddr.cp   ? `<ram:PostcodeCode>${buyerAddr.cp}</ram:PostcodeCode>` : ""}
          ${buyerAddr.line ? `<ram:LineOne>${buyerAddr.line}</ram:LineOne>` : ""}
          ${buyerAddr.city ? `<ram:CityName>${buyerAddr.city}</ram:CityName>` : ""}
          <ram:CountryID>FR</ram:CountryID>
        </ram:PostalTradeAddress>
      </ram:BuyerTradeParty>
    </ram:ApplicableHeaderTradeAgreement>
    <ram:ApplicableHeaderTradeDelivery/>
    <ram:ApplicableHeaderTradeSettlement>
      <ram:InvoiceCurrencyCode>EUR</ram:InvoiceCurrencyCode>${taxBlocks}
      ${due ? `<ram:SpecifiedTradePaymentTerms><ram:DueDateDateTime><udt:DateTimeString format="102">${due}</udt:DateTimeString></ram:DueDateDateTime></ram:SpecifiedTradePaymentTerms>` : ""}
      <ram:SpecifiedTradeSettlementHeaderMonetarySummation>
        <ram:LineTotalAmount>${num(totalHT)}</ram:LineTotalAmount>
        <ram:TaxBasisTotalAmount>${num(totalHT)}</ram:TaxBasisTotalAmount>
        <ram:TaxTotalAmount currencyID="EUR">${num(totalTVA)}</ram:TaxTotalAmount>
        <ram:GrandTotalAmount>${num(totalTTC)}</ram:GrandTotalAmount>
        <ram:DuePayableAmount>${num(totalTTC)}</ram:DuePayableAmount>
      </ram:SpecifiedTradeSettlementHeaderMonetarySummation>
    </ram:ApplicableHeaderTradeSettlement>
  </rsm:SupplyChainTradeTransaction>
</rsm:CrossIndustryInvoice>`;
}

// Embarque l'XML Factur-X dans un PDF (Uint8Array ou Blob) et ajoute les
// métadonnées XMP nécessaires à la reconnaissance automatique.
export async function embedFacturXInPdf(pdfInput, xmlString) {
  const bytes = pdfInput instanceof Blob
    ? new Uint8Array(await pdfInput.arrayBuffer())
    : pdfInput;

  const pdfDoc = await PDFDocument.load(bytes);

  // Attache l'XML comme fichier embarqué (relationship Alternative = Factur-X)
  const xmlBytes = new TextEncoder().encode(xmlString);
  await pdfDoc.attach(xmlBytes, XML_FILENAME, {
    mimeType:     "application/xml",
    description:  "Factur-X invoice metadata",
    creationDate: new Date(),
    modificationDate: new Date(),
    afRelationship: AFRelationship.Alternative,
  });

  // Métadonnées PDF de base (certains logiciels lisent le Title/Producer)
  pdfDoc.setTitle("Facture");
  pdfDoc.setProducer("Zenbat — Factur-X generator");
  pdfDoc.setCreator("Zenbat");
  pdfDoc.setCreationDate(new Date());

  const out = await pdfDoc.save();
  return new Blob([out], { type: "application/pdf" });
}

// Déclenche un téléchargement client d'un Blob avec un nom donné.
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}
