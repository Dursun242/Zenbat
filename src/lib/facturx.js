// Génération Factur-X (facture électronique française) :
// 1. Construit un XML CII (Cross Industry Invoice) au profil BASIC.
// 2. Embarque l'XML dans un PDF existant via pdf-lib + ajoute les métadonnées
//    XMP Factur-X pour que les logiciels compta (Pennylane, Dougs, Sage, Cegid…)
//    reconnaissent et importent automatiquement la facture.
//
// Ref : https://fnfe-mpe.org/factur-x/
// Profil BASIC : https://fnfe-mpe.org/factur-x/factur-x_en/ (conforme EN 16931)

import { PDFDocument, AFRelationship, PDFName, PDFRawStream } from "pdf-lib";

const PROFILE = "urn:cen.eu:en16931:2017#compliant#urn:factur-x.eu:1p0:basic";
const XML_FILENAME = "factur-x.xml";
const FRANCHISE_NOTICE = "TVA non applicable, art. 293 B du CGI";

// Codes d'unité UN/ECE Rec. 20 acceptés par le schématron Factur-X.
// On mappe les libellés courants du bâtiment vers les codes officiels.
const UNIT_CODE_MAP = {
  m2:    "MTK", "m²":   "MTK", m_2: "MTK",
  ml:    "MTR", m:      "MTR",
  u:     "C62", unite:  "C62", "unité": "C62", pc: "H87",
  m3:    "MTQ", "m³":   "MTQ",
  ft:    "C62",                        // forfait
  ens:   "C62",                        // ensemble
  h:     "HUR", heure:  "HUR",
  j:     "DAY", jour:   "DAY",
  kg:    "KGM",
  t:     "TNE",
  l:     "LTR",
};

function mapUnit(u) {
  if (!u) return "C62";
  const k = String(u).trim().toLowerCase();
  return UNIT_CODE_MAP[k] || "C62";
}

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
export function buildFacturXXML({ invoice, client, brand }) {
  const ouvrages = (invoice.lignes || []).filter(l => l.type_ligne === "ouvrage");
  const franchise = brand.vatRegime === "franchise";

  // Regroupement TVA par taux
  const taxByRate = {};
  for (const l of ouvrages) {
    const rate = Number(l.tva_rate ?? (franchise ? 0 : 20));
    const ht   = (Number(l.quantite) || 0) * (Number(l.prix_unitaire) || 0);
    if (!taxByRate[rate]) taxByRate[rate] = { base: 0, montant: 0 };
    taxByRate[rate].base    += ht;
    taxByRate[rate].montant += ht * rate / 100;
  }
  // Cas dégénéré : aucune ligne → au moins un bloc TVA à 0 sinon le schéma râle
  if (!Object.keys(taxByRate).length) taxByRate[franchise ? 0 : 20] = { base: 0, montant: 0 };

  const totalHT  = Number(invoice.montant_ht)  || ouvrages.reduce((s, l) => s + (Number(l.quantite) || 0) * (Number(l.prix_unitaire) || 0), 0);
  const totalTVA = Number(invoice.montant_tva) || Object.values(taxByRate).reduce((s, t) => s + t.montant, 0);
  const totalTTC = Number(invoice.montant_ttc) || totalHT + totalTVA;
  const retenue  = Number(invoice.retenue_garantie_eur) || 0;
  const duePayable = totalTTC - retenue;

  const sellerSiret = (brand.siret || "").replace(/\s+/g, "").slice(0, 14);
  const sellerSiren = sellerSiret.slice(0, 9);
  const buyerSiret  = (client?.siret || "").replace(/\s+/g, "").slice(0, 14);
  const buyerSiren  = buyerSiret.slice(0, 9);

  const sellerName = esc(brand.companyName || `${brand.firstName || ""} ${brand.lastName || ""}`.trim());
  const buyerName  = esc(client?.raison_sociale || `${client?.prenom || ""} ${client?.nom || ""}`.trim() || "Client");

  const sellerAddr = {
    line: esc(brand.address || ""),
    cp:   esc((brand.city || "").match(/\d{5}/)?.[0] || ""),
    city: esc((brand.city || "").replace(/^\d+\s*/, "")),
  };
  const buyerAddr = {
    line: esc(client?.adresse || ""),
    cp:   esc(client?.code_postal || ""),
    city: esc(client?.ville || ""),
  };

  // Lignes <IncludedSupplyChainTradeLineItem>
  const lineBlocks = ouvrages.map((l, i) => {
    const qty   = Number(l.quantite) || 0;
    const pu    = Number(l.prix_unitaire) || 0;
    const rate  = Number(l.tva_rate ?? (franchise ? 0 : 20));
    const lineTotal = qty * pu;
    const unitCode  = mapUnit(l.unite);
    const category  = rate > 0 ? "S" : "E"; // S = Standard, E = Exempt
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
        <ram:BilledQuantity unitCode="${unitCode}">${num(qty, 3)}</ram:BilledQuantity>
      </ram:SpecifiedLineTradeDelivery>
      <ram:SpecifiedLineTradeSettlement>
        <ram:ApplicableTradeTax>
          <ram:TypeCode>VAT</ram:TypeCode>
          <ram:CategoryCode>${category}</ram:CategoryCode>
          <ram:RateApplicablePercent>${num(rate)}</ram:RateApplicablePercent>
        </ram:ApplicableTradeTax>
        <ram:SpecifiedTradeSettlementLineMonetarySummation>
          <ram:LineTotalAmount>${num(lineTotal)}</ram:LineTotalAmount>
        </ram:SpecifiedTradeSettlementLineMonetarySummation>
      </ram:SpecifiedLineTradeSettlement>
    </ram:IncludedSupplyChainTradeLineItem>`;
  }).join("");

  // Blocs <ApplicableTradeTax> (un par taux).
  // Règle BR-E-10 : si CategoryCode = E, ExemptionReason obligatoire.
  const taxBlocks = Object.entries(taxByRate).map(([rate, t]) => {
    const r = Number(rate);
    const category = r > 0 ? "S" : "E";
    const exemption = category === "E"
      ? `<ram:ExemptionReason>${esc(FRANCHISE_NOTICE)}</ram:ExemptionReason>`
      : "";
    return `
    <ram:ApplicableTradeTax>
      <ram:CalculatedAmount>${num(t.montant)}</ram:CalculatedAmount>
      <ram:TypeCode>VAT</ram:TypeCode>
      ${exemption}
      <ram:BasisAmount>${num(t.base)}</ram:BasisAmount>
      <ram:CategoryCode>${category}</ram:CategoryCode>
      <ram:RateApplicablePercent>${num(r)}</ram:RateApplicablePercent>
    </ram:ApplicableTradeTax>`;
  }).join("");

  const issue    = fmtDate(invoice.date_emission || new Date());
  const due      = fmtDate(invoice.date_echeance);
  const iban     = (brand.iban || "").replace(/\s+/g, "");
  const bic      = (brand.bic || "").trim();

  // Enregistrements fiscaux du vendeur :
  // - schemeID="VA" pour le n° de TVA intracom
  // - schemeID="FC" pour l'identifiant fiscal (SIRET en France) — requis par
  //   BR-E-02 quand des lignes sont en exemption (franchise en base).
  const sellerTaxRegs = [
    brand.tva    ? `<ram:SpecifiedTaxRegistration><ram:ID schemeID="VA">${esc(brand.tva)}</ram:ID></ram:SpecifiedTaxRegistration>` : "",
    sellerSiret  ? `<ram:SpecifiedTaxRegistration><ram:ID schemeID="FC">${esc(sellerSiret)}</ram:ID></ram:SpecifiedTaxRegistration>` : "",
  ].filter(Boolean).join("");

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
        ${sellerSiren ? `<ram:SpecifiedLegalOrganization><ram:ID schemeID="0002">${esc(sellerSiren)}</ram:ID></ram:SpecifiedLegalOrganization>` : ""}
        <ram:PostalTradeAddress>
          ${sellerAddr.cp   ? `<ram:PostcodeCode>${sellerAddr.cp}</ram:PostcodeCode>` : ""}
          ${sellerAddr.line ? `<ram:LineOne>${sellerAddr.line}</ram:LineOne>` : ""}
          ${sellerAddr.city ? `<ram:CityName>${sellerAddr.city}</ram:CityName>` : ""}
          <ram:CountryID>FR</ram:CountryID>
        </ram:PostalTradeAddress>
        ${sellerTaxRegs}
      </ram:SellerTradeParty>
      <ram:BuyerTradeParty>
        <ram:Name>${buyerName}</ram:Name>
        ${buyerSiren ? `<ram:SpecifiedLegalOrganization><ram:ID schemeID="0002">${esc(buyerSiren)}</ram:ID></ram:SpecifiedLegalOrganization>` : ""}
        <ram:PostalTradeAddress>
          ${buyerAddr.cp   ? `<ram:PostcodeCode>${buyerAddr.cp}</ram:PostcodeCode>` : ""}
          ${buyerAddr.line ? `<ram:LineOne>${buyerAddr.line}</ram:LineOne>` : ""}
          ${buyerAddr.city ? `<ram:CityName>${buyerAddr.city}</ram:CityName>` : ""}
          <ram:CountryID>FR</ram:CountryID>
        </ram:PostalTradeAddress>
      </ram:BuyerTradeParty>
    </ram:ApplicableHeaderTradeAgreement>
    <ram:ApplicableHeaderTradeDelivery>
      <ram:ActualDeliverySupplyChainEvent>
        <ram:OccurrenceDateTime>
          <udt:DateTimeString format="102">${issue}</udt:DateTimeString>
        </ram:OccurrenceDateTime>
      </ram:ActualDeliverySupplyChainEvent>
    </ram:ApplicableHeaderTradeDelivery>
    <ram:ApplicableHeaderTradeSettlement>
      <ram:InvoiceCurrencyCode>EUR</ram:InvoiceCurrencyCode>
      ${iban ? `
      <ram:SpecifiedTradeSettlementPaymentMeans>
        <ram:TypeCode>58</ram:TypeCode>
        <ram:PayeePartyCreditorFinancialAccount><ram:IBANID>${esc(iban)}</ram:IBANID></ram:PayeePartyCreditorFinancialAccount>
      </ram:SpecifiedTradeSettlementPaymentMeans>` : ""}${taxBlocks}
      ${retenue > 0 ? `
      <ram:SpecifiedTradeAllowanceCharge>
        <ram:ChargeIndicator><udt:Indicator>false</udt:Indicator></ram:ChargeIndicator>
        <ram:ActualAmount>${num(retenue)}</ram:ActualAmount>
        <ram:Reason>Retenue de garantie</ram:Reason>
        <ram:CategoryTradeTax><ram:TypeCode>VAT</ram:TypeCode><ram:CategoryCode>S</ram:CategoryCode><ram:RateApplicablePercent>0.00</ram:RateApplicablePercent></ram:CategoryTradeTax>
      </ram:SpecifiedTradeAllowanceCharge>` : ""}
      ${due ? `<ram:SpecifiedTradePaymentTerms><ram:DueDateDateTime><udt:DateTimeString format="102">${due}</udt:DateTimeString></ram:DueDateDateTime></ram:SpecifiedTradePaymentTerms>` : ""}
      <ram:SpecifiedTradeSettlementHeaderMonetarySummation>
        <ram:LineTotalAmount>${num(totalHT)}</ram:LineTotalAmount>
        <ram:TaxBasisTotalAmount>${num(totalHT)}</ram:TaxBasisTotalAmount>
        <ram:TaxTotalAmount currencyID="EUR">${num(totalTVA)}</ram:TaxTotalAmount>
        <ram:GrandTotalAmount>${num(totalTTC)}</ram:GrandTotalAmount>
        <ram:DuePayableAmount>${num(duePayable)}</ram:DuePayableAmount>
      </ram:SpecifiedTradeSettlementHeaderMonetarySummation>
    </ram:ApplicableHeaderTradeSettlement>
  </rsm:SupplyChainTradeTransaction>
</rsm:CrossIndustryInvoice>`;
}

// Construit le bloc XMP Factur-X que le validateur attend.
// pdfaid:part=3 + conformance=B + namespace fx: avec profil BASIC.
function buildFacturXXMP({ invoice }) {
  const now = new Date().toISOString().replace(/\.\d{3}/, "");
  const docId = esc(invoice?.numero || "invoice");
  return `<?xpacket begin="﻿" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
    <rdf:Description rdf:about=""
        xmlns:dc="http://purl.org/dc/elements/1.1/"
        xmlns:xmp="http://ns.adobe.com/xap/1.0/"
        xmlns:pdf="http://ns.adobe.com/pdf/1.3/"
        xmlns:pdfaid="http://www.aiim.org/pdfa/ns/id/"
        xmlns:pdfaExtension="http://www.aiim.org/pdfa/ns/extension/"
        xmlns:pdfaSchema="http://www.aiim.org/pdfa/ns/schema#"
        xmlns:pdfaProperty="http://www.aiim.org/pdfa/ns/property#"
        xmlns:fx="urn:factur-x:pdfa:CrossIndustryDocument:invoice:1p0#">
      <dc:title>
        <rdf:Alt><rdf:li xml:lang="x-default">Facture ${docId}</rdf:li></rdf:Alt>
      </dc:title>
      <xmp:CreatorTool>Zenbat</xmp:CreatorTool>
      <xmp:CreateDate>${now}</xmp:CreateDate>
      <xmp:ModifyDate>${now}</xmp:ModifyDate>
      <pdf:Producer>Zenbat Factur-X</pdf:Producer>
      <pdfaid:part>3</pdfaid:part>
      <pdfaid:conformance>B</pdfaid:conformance>
      <fx:DocumentType>INVOICE</fx:DocumentType>
      <fx:DocumentFileName>${XML_FILENAME}</fx:DocumentFileName>
      <fx:Version>1.0</fx:Version>
      <fx:ConformanceLevel>BASIC</fx:ConformanceLevel>
      <pdfaExtension:schemas>
        <rdf:Bag>
          <rdf:li rdf:parseType="Resource">
            <pdfaSchema:namespaceURI>urn:factur-x:pdfa:CrossIndustryDocument:invoice:1p0#</pdfaSchema:namespaceURI>
            <pdfaSchema:prefix>fx</pdfaSchema:prefix>
            <pdfaSchema:schema>Factur-X PDFA Extension Schema</pdfaSchema:schema>
            <pdfaSchema:property>
              <rdf:Seq>
                <rdf:li rdf:parseType="Resource">
                  <pdfaProperty:name>DocumentFileName</pdfaProperty:name>
                  <pdfaProperty:valueType>Text</pdfaProperty:valueType>
                  <pdfaProperty:category>external</pdfaProperty:category>
                  <pdfaProperty:description>Factur-X filename</pdfaProperty:description>
                </rdf:li>
                <rdf:li rdf:parseType="Resource">
                  <pdfaProperty:name>DocumentType</pdfaProperty:name>
                  <pdfaProperty:valueType>Text</pdfaProperty:valueType>
                  <pdfaProperty:category>external</pdfaProperty:category>
                  <pdfaProperty:description>Factur-X document type</pdfaProperty:description>
                </rdf:li>
                <rdf:li rdf:parseType="Resource">
                  <pdfaProperty:name>Version</pdfaProperty:name>
                  <pdfaProperty:valueType>Text</pdfaProperty:valueType>
                  <pdfaProperty:category>external</pdfaProperty:category>
                  <pdfaProperty:description>Factur-X version</pdfaProperty:description>
                </rdf:li>
                <rdf:li rdf:parseType="Resource">
                  <pdfaProperty:name>ConformanceLevel</pdfaProperty:name>
                  <pdfaProperty:valueType>Text</pdfaProperty:valueType>
                  <pdfaProperty:category>external</pdfaProperty:category>
                  <pdfaProperty:description>Factur-X conformance level</pdfaProperty:description>
                </rdf:li>
              </rdf:Seq>
            </pdfaSchema:property>
          </rdf:li>
        </rdf:Bag>
      </pdfaExtension:schemas>
    </rdf:Description>
  </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`;
}

// Embarque l'XML Factur-X dans un PDF et injecte les métadonnées XMP.
// Le mimeType est "text/xml" comme exigé par le validateur FNFE-MPE.
export async function embedFacturXInPdf(pdfInput, xmlString, invoice = {}) {
  const bytes = pdfInput instanceof Blob
    ? new Uint8Array(await pdfInput.arrayBuffer())
    : pdfInput;

  const pdfDoc = await PDFDocument.load(bytes);

  // Pièce jointe XML (relation Alternative = Factur-X, mimeType text/xml)
  const xmlBytes = new TextEncoder().encode(xmlString);
  await pdfDoc.attach(xmlBytes, XML_FILENAME, {
    mimeType:         "text/xml",
    description:      "Factur-X invoice metadata",
    creationDate:     new Date(),
    modificationDate: new Date(),
    afRelationship:   AFRelationship.Alternative,
  });

  // Métadonnées classiques
  pdfDoc.setTitle(`Facture ${invoice.numero || ""}`.trim());
  pdfDoc.setProducer("Zenbat Factur-X");
  pdfDoc.setCreator("Zenbat");
  pdfDoc.setCreationDate(new Date());
  pdfDoc.setModificationDate(new Date());

  // Injection du bloc XMP Factur-X via le catalogue.
  // On construit un PDFRawStream NON compressé (PDF/A exige que le flux
  // Metadata soit lisible sans filtre).
  const xmpString = buildFacturXXMP({ invoice });
  const xmpBytes  = new TextEncoder().encode(xmpString);
  const metaDict  = pdfDoc.context.obj({
    Type:    PDFName.of("Metadata"),
    Subtype: PDFName.of("XML"),
    Length:  xmpBytes.length,
  });
  const metadataStream = PDFRawStream.of(metaDict, xmpBytes);
  const metadataRef    = pdfDoc.context.register(metadataStream);
  pdfDoc.catalog.set(PDFName.of("Metadata"), metadataRef);

  // Les validateurs PDF/A stricts vérifient que le catalog expose
  // /Names/EmbeddedFiles. pdf-lib l'ajoute via attach() mais parfois
  // sous une forme que le validateur FNFE-MPE ne traverse pas → on
  // garantit explicitement sa présence en "touchant" le dict.
  const namesEntry = pdfDoc.catalog.get(PDFName.of("Names"));
  if (namesEntry && typeof namesEntry.set === "function") {
    // Force une re-sérialisation du Names dict
    const ef = namesEntry.get(PDFName.of("EmbeddedFiles"));
    if (ef) namesEntry.set(PDFName.of("EmbeddedFiles"), ef);
  }

  // useObjectStreams: false garantit que la stream Metadata reste
  // en objet indirect distinct (requis par PDF/A).
  const out = await pdfDoc.save({ useObjectStreams: false });
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
