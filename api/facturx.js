// Assemblage Factur-X côté serveur :
// 1. Reçoit le PDF "visuel" (généré par html2canvas+jsPDF côté client) en base64
//    + les données invoice/client/brand.
// 2. Construit l'XML CII Factur-X profil BASIC.
// 3. Embarque l'XML dans le PDF avec pdf-lib.
// 4. Ajoute le bloc XMP Factur-X (pdfaid:part=3, fx:ConformanceLevel=BASIC).
// 5. Ajoute un OutputIntent sRGB si public/icc/sRGB.icc est présent — sinon
//    on saute cette étape mais le reste du traitement se fait.
// 6. Retourne le PDF enrichi en base64.
//
// Renvoi identique à la version client-side si le profil ICC est absent,
// mais centralise la logique pour qu'on puisse facilement ajouter des
// polices embarquées, compression, signature, etc. plus tard.

import { createClient } from "@supabase/supabase-js";
import { PDFDocument, AFRelationship, PDFName, PDFRawStream } from "pdf-lib";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { cors } from "./_cors.js"

const XML_FILENAME    = "factur-x.xml";
// Profil EN 16931 (norme européenne, obligatoire PPF/PDP à partir de 09/2026).
// Anciennement BASIC (urn:cen.eu:en16931:2017#compliant#urn:factur-x.eu:1p0:basic).
const PROFILE         = "urn:cen.eu:en16931:2017";
const CONFORMANCE_LABEL = "EN 16931";
const FRANCHISE_NOTE  = "TVA non applicable, art. 293 B du CGI";

// Codes de type de document (UNTDID 1001) :
//   380 = Commercial invoice (facture standard)
//   381 = Credit note (facture d'avoir)
//   384 = Corrective invoice (rectificative — non utilisé ici, préférer avoir)
const TYPE_INVOICE = "380";
const TYPE_CREDIT  = "381";

const UNIT_CODE_MAP = {
  m2: "MTK", "m²": "MTK",
  ml: "MTR", m: "MTR",
  u: "C62", unite: "C62", "unité": "C62", pc: "H87",
  m3: "MTQ", "m³": "MTQ",
  ft: "C62", ens: "C62",
  h: "HUR", heure: "HUR",
  j: "DAY", jour: "DAY",
  kg: "KGM", t: "TNE", l: "LTR",
};
const mapUnit = u => (u ? UNIT_CODE_MAP[String(u).trim().toLowerCase()] : null) || "C62";

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({
  "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&apos;"
})[c]);
const num = (n, d = 2) => (Number(n) || 0).toFixed(d);
const fmtDate = d => {
  if (!d) return "";
  const x = d instanceof Date ? d : new Date(d);
  return `${x.getFullYear()}${String(x.getMonth()+1).padStart(2,"0")}${String(x.getDate()).padStart(2,"0")}`;
};

function buildXML({ invoice, client, brand, sourceInvoice }) {
  const ouvrages   = (invoice.lignes || []).filter(l => l.type_ligne === "ouvrage");
  const franchise  = brand.vatRegime === "franchise";
  const isAvoir    = !!invoice.avoir_of_invoice_id || !!sourceInvoice;
  const typeCode   = isAvoir ? TYPE_CREDIT : TYPE_INVOICE;

  const taxByRate = {};
  for (const l of ouvrages) {
    const rate = Number(l.tva_rate ?? (franchise ? 0 : 20));
    const ht   = (Number(l.quantite)||0) * (Number(l.prix_unitaire)||0);
    if (!taxByRate[rate]) taxByRate[rate] = { base: 0, montant: 0 };
    taxByRate[rate].base    += ht;
    taxByRate[rate].montant += ht * rate / 100;
  }
  if (!Object.keys(taxByRate).length) taxByRate[franchise ? 0 : 20] = { base: 0, montant: 0 };

  const totalHT  = Number(invoice.montant_ht)  || ouvrages.reduce((s,l)=>s+(Number(l.quantite)||0)*(Number(l.prix_unitaire)||0),0);
  const totalTVA = Number(invoice.montant_tva) || Object.values(taxByRate).reduce((s,t)=>s+t.montant,0);
  const totalTTC = Number(invoice.montant_ttc) || totalHT + totalTVA;
  const retenue  = Number(invoice.retenue_garantie_eur) || 0;
  const duePayable = totalTTC - retenue;

  const sellerSiret = (brand.siret||"").replace(/\s+/g,"").slice(0,14);
  const sellerSiren = sellerSiret.slice(0,9);
  const buyerSiret  = (client?.siret||"").replace(/\s+/g,"").slice(0,14);
  const buyerSiren  = buyerSiret.slice(0,9);

  const sellerName = esc(brand.companyName || `${brand.firstName||""} ${brand.lastName||""}`.trim());
  const buyerName  = esc(client?.raison_sociale || `${client?.prenom||""} ${client?.nom||""}`.trim() || "Client");

  const sellerAddr = {
    line: esc(brand.address||""),
    cp:   esc((brand.city||"").match(/\d{5}/)?.[0]||""),
    city: esc((brand.city||"").replace(/^\d+\s*/,"")),
  };
  const buyerAddr = {
    line: esc(client?.adresse||""),
    cp:   esc(client?.code_postal||""),
    city: esc(client?.ville||""),
  };

  const lineBlocks = ouvrages.map((l,i) => {
    const qty = Number(l.quantite)||0;
    const pu  = Number(l.prix_unitaire)||0;
    const rate= Number(l.tva_rate ?? (franchise?0:20));
    const cat = rate>0 ? "S" : "E";
    return `
    <ram:IncludedSupplyChainTradeLineItem>
      <ram:AssociatedDocumentLineDocument><ram:LineID>${i+1}</ram:LineID></ram:AssociatedDocumentLineDocument>
      <ram:SpecifiedTradeProduct><ram:Name>${esc(l.designation||"—")}</ram:Name></ram:SpecifiedTradeProduct>
      <ram:SpecifiedLineTradeAgreement><ram:NetPriceProductTradePrice><ram:ChargeAmount>${num(pu,4)}</ram:ChargeAmount></ram:NetPriceProductTradePrice></ram:SpecifiedLineTradeAgreement>
      <ram:SpecifiedLineTradeDelivery><ram:BilledQuantity unitCode="${mapUnit(l.unite)}">${num(qty,3)}</ram:BilledQuantity></ram:SpecifiedLineTradeDelivery>
      <ram:SpecifiedLineTradeSettlement>
        <ram:ApplicableTradeTax>
          <ram:TypeCode>VAT</ram:TypeCode>
          <ram:CategoryCode>${cat}</ram:CategoryCode>
          <ram:RateApplicablePercent>${num(rate)}</ram:RateApplicablePercent>
        </ram:ApplicableTradeTax>
        <ram:SpecifiedTradeSettlementLineMonetarySummation><ram:LineTotalAmount>${num(qty*pu)}</ram:LineTotalAmount></ram:SpecifiedTradeSettlementLineMonetarySummation>
      </ram:SpecifiedLineTradeSettlement>
    </ram:IncludedSupplyChainTradeLineItem>`;
  }).join("");

  const taxBlocks = Object.entries(taxByRate).map(([rate,t]) => {
    const r = Number(rate), cat = r>0 ? "S" : "E";
    const exempt = cat==="E" ? `<ram:ExemptionReason>${esc(FRANCHISE_NOTE)}</ram:ExemptionReason>` : "";
    return `
    <ram:ApplicableTradeTax>
      <ram:CalculatedAmount>${num(t.montant)}</ram:CalculatedAmount>
      <ram:TypeCode>VAT</ram:TypeCode>
      ${exempt}
      <ram:BasisAmount>${num(t.base)}</ram:BasisAmount>
      <ram:CategoryCode>${cat}</ram:CategoryCode>
      <ram:RateApplicablePercent>${num(r)}</ram:RateApplicablePercent>
    </ram:ApplicableTradeTax>`;
  }).join("");

  const issue    = fmtDate(invoice.date_emission || new Date());
  const due      = fmtDate(invoice.date_echeance);
  const iban     = (brand?.iban || "").replace(/\s+/g, "");
  const bic      = (brand?.bic || "").trim();

  const sellerTaxRegs = [
    brand.tva   ? `<ram:SpecifiedTaxRegistration><ram:ID schemeID="VA">${esc(brand.tva)}</ram:ID></ram:SpecifiedTaxRegistration>` : "",
    sellerSiret ? `<ram:SpecifiedTaxRegistration><ram:ID schemeID="FC">${esc(sellerSiret)}</ram:ID></ram:SpecifiedTaxRegistration>` : "",
  ].filter(Boolean).join("");

  // Contact vendeur (BG-6) — requis en EN 16931 si un canal d'échange est connu.
  const sellerContactParts = [
    brand.firstName || brand.lastName
      ? `<ram:PersonName>${esc(`${brand.firstName||""} ${brand.lastName||""}`.trim())}</ram:PersonName>`
      : "",
    brand.phone
      ? `<ram:TelephoneUniversalCommunication><ram:CompleteNumber>${esc(brand.phone)}</ram:CompleteNumber></ram:TelephoneUniversalCommunication>`
      : "",
    brand.email
      ? `<ram:EmailURIUniversalCommunication><ram:URIID>${esc(brand.email)}</ram:URIID></ram:EmailURIUniversalCommunication>`
      : "",
  ].filter(Boolean).join("");
  const sellerContact = sellerContactParts
    ? `<ram:DefinedTradeContact>${sellerContactParts}</ram:DefinedTradeContact>`
    : "";

  // BT-10 BuyerReference (obligatoire EN 16931 si pas de PurchaseOrderReference)
  const buyerRef = esc(invoice.buyer_reference || client?.reference || client?.raison_sociale || client?.nom || "—");

  // BT-20 : description textuelle des conditions de paiement
  const termsDesc = esc(brand.paymentTerms || "Paiement à réception de facture").slice(0, 1000);

  // Avoir : référence à la facture d'origine (BG-3)
  const sourceRefBlock = (isAvoir && sourceInvoice?.numero)
    ? `<ram:InvoiceReferencedDocument>
        <ram:IssuerAssignedID>${esc(sourceInvoice.numero)}</ram:IssuerAssignedID>
        ${sourceInvoice.date_emission ? `<ram:FormattedIssueDateTime><qdt:DateTimeString format="102">${fmtDate(sourceInvoice.date_emission)}</qdt:DateTimeString></ram:FormattedIssueDateTime>` : ""}
      </ram:InvoiceReferencedDocument>`
    : "";

  // BT-22 : note d'en-tête (description de l'avoir si applicable)
  const docNote = isAvoir && sourceInvoice?.numero
    ? `<ram:IncludedNote><ram:Content>Avoir rectificatif de la facture ${esc(sourceInvoice.numero)}.</ram:Content></ram:IncludedNote>`
    : "";

  return `<?xml version="1.0" encoding="UTF-8"?>
<rsm:CrossIndustryInvoice xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100"
                          xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100"
                          xmlns:udt="urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100"
                          xmlns:qdt="urn:un:unece:uncefact:data:standard:QualifiedDataType:100">
  <rsm:ExchangedDocumentContext>
    <ram:GuidelineSpecifiedDocumentContextParameter><ram:ID>${PROFILE}</ram:ID></ram:GuidelineSpecifiedDocumentContextParameter>
  </rsm:ExchangedDocumentContext>
  <rsm:ExchangedDocument>
    <ram:ID>${esc(invoice.numero||"")}</ram:ID>
    <ram:TypeCode>${typeCode}</ram:TypeCode>
    <ram:IssueDateTime><udt:DateTimeString format="102">${issue}</udt:DateTimeString></ram:IssueDateTime>
    ${docNote}
  </rsm:ExchangedDocument>
  <rsm:SupplyChainTradeTransaction>${lineBlocks}
    <ram:ApplicableHeaderTradeAgreement>
      <ram:BuyerReference>${buyerRef}</ram:BuyerReference>
      <ram:SellerTradeParty>
        <ram:Name>${sellerName}</ram:Name>
        ${sellerSiren ? `<ram:SpecifiedLegalOrganization><ram:ID schemeID="0002">${esc(sellerSiren)}</ram:ID></ram:SpecifiedLegalOrganization>` : ""}
        ${sellerContact}
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
      <ram:ActualDeliverySupplyChainEvent><ram:OccurrenceDateTime><udt:DateTimeString format="102">${issue}</udt:DateTimeString></ram:OccurrenceDateTime></ram:ActualDeliverySupplyChainEvent>
    </ram:ApplicableHeaderTradeDelivery>
    <ram:ApplicableHeaderTradeSettlement>
      ${sourceRefBlock}
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
      <ram:SpecifiedTradePaymentTerms>
        <ram:Description>${termsDesc}</ram:Description>
        ${due ? `<ram:DueDateDateTime><udt:DateTimeString format="102">${due}</udt:DateTimeString></ram:DueDateDateTime>` : ""}
      </ram:SpecifiedTradePaymentTerms>
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

function buildXMP({ invoice }) {
  const now = new Date().toISOString().replace(/\.\d{3}/,"");
  const isAvoir = !!invoice?.avoir_of_invoice_id;
  const docKind = isAvoir ? "Avoir" : "Facture";
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
      <dc:title><rdf:Alt><rdf:li xml:lang="x-default">${docKind} ${esc(invoice?.numero||"")}</rdf:li></rdf:Alt></dc:title>
      <xmp:CreatorTool>Zenbat</xmp:CreatorTool>
      <xmp:CreateDate>${now}</xmp:CreateDate>
      <xmp:ModifyDate>${now}</xmp:ModifyDate>
      <pdf:Producer>Zenbat Factur-X</pdf:Producer>
      <pdfaid:part>3</pdfaid:part>
      <pdfaid:conformance>B</pdfaid:conformance>
      <fx:DocumentType>INVOICE</fx:DocumentType>
      <fx:DocumentFileName>${XML_FILENAME}</fx:DocumentFileName>
      <fx:Version>1.0</fx:Version>
      <fx:ConformanceLevel>${CONFORMANCE_LABEL}</fx:ConformanceLevel>
      <pdfaExtension:schemas>
        <rdf:Bag>
          <rdf:li rdf:parseType="Resource">
            <pdfaSchema:namespaceURI>urn:factur-x:pdfa:CrossIndustryDocument:invoice:1p0#</pdfaSchema:namespaceURI>
            <pdfaSchema:prefix>fx</pdfaSchema:prefix>
            <pdfaSchema:schema>Factur-X PDFA Extension Schema</pdfaSchema:schema>
            <pdfaSchema:property>
              <rdf:Seq>
                <rdf:li rdf:parseType="Resource"><pdfaProperty:name>DocumentFileName</pdfaProperty:name><pdfaProperty:valueType>Text</pdfaProperty:valueType><pdfaProperty:category>external</pdfaProperty:category><pdfaProperty:description>Factur-X filename</pdfaProperty:description></rdf:li>
                <rdf:li rdf:parseType="Resource"><pdfaProperty:name>DocumentType</pdfaProperty:name><pdfaProperty:valueType>Text</pdfaProperty:valueType><pdfaProperty:category>external</pdfaProperty:category><pdfaProperty:description>Factur-X document type</pdfaProperty:description></rdf:li>
                <rdf:li rdf:parseType="Resource"><pdfaProperty:name>Version</pdfaProperty:name><pdfaProperty:valueType>Text</pdfaProperty:valueType><pdfaProperty:category>external</pdfaProperty:category><pdfaProperty:description>Factur-X version</pdfaProperty:description></rdf:li>
                <rdf:li rdf:parseType="Resource"><pdfaProperty:name>ConformanceLevel</pdfaProperty:name><pdfaProperty:valueType>Text</pdfaProperty:valueType><pdfaProperty:category>external</pdfaProperty:category><pdfaProperty:description>Factur-X conformance level</pdfaProperty:description></rdf:li>
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

// Profil sRGB IEC61966-2.1 minimal embarqué (fallback si le fichier disque est absent).
// Généré avec les primaires sRGB Bradford-adaptées D50 et gamma 2.2.
const SRGB_ICC_B64 = "AAAB7GxjbXMCEAAAbW50clJHQiBYWVogB9cABwAZAAAAAAAAYWNzcE1TRlQAAAAASUVDIHNSR0IAAAAAAAAAAAAAAAAAAPbcAAEAAAAA0zpsY21zAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAKZGVzYwAAAPwAAAAoY3BydAAAASQAAAA0d3RwdAAAAVgAAAAUYmtwdAAAAWwAAAAUclhZWgAAAYAAAAAUZ1hZWgAAAZQAAAAUYlhZWgAAAagAAAAUclRSQwAAAbwAAAAQZ1RSQwAAAcwAAAAQYlRSQwAAAdwAAAAQZGVzYwAAAAAAAAASc1JHQiBJRUM2MTk2Ni0yLjEAAAAAAAAAAAAAAHRleHQAAAAAQ29weXJpZ2h0IChjKSAxOTk4IEhld2xldHQtUGFja2FyZCBDb21wYW55AABYWVogAAAAAAAA9twAAQAAAADTOlhZWiAAAAAAAAAAAAAAAAAAAAAAWFlaIAAAAAAAAG+jAAA49QAAA5FYWVogAAAAAAAAYpQAALeKAAAY3FhZWiAAAAAAAAAkoQAAD4YAALbUY3VydgAAAAAAAAABAjMAAGN1cnYAAAAAAAAAAQIzAABjdXJ2AAAAAAAAAAECMwAA";

// Charge le profil sRGB : d'abord le fichier disque, puis le fallback embarqué.
async function loadSRGBProfile() {
  const candidates = [
    join(process.cwd(), "public", "icc", "sRGB.icc"),
    join(process.cwd(), "public", "icc", "srgb.icc"),
  ];
  for (const path of candidates) {
    try {
      const bytes = await readFile(path);
      return new Uint8Array(bytes);
    } catch { /* next */ }
  }
  // Fallback : profil embarqué en base64
  return new Uint8Array(Buffer.from(SRGB_ICC_B64, "base64"));
}

// Ajoute un OutputIntent sRGB au catalogue PDF (nécessaire pour PDF/A-3).
function addSRGBOutputIntent(pdfDoc, iccBytes) {
  if (!iccBytes) return;
  const iccDict = pdfDoc.context.obj({
    N:      3,
    Length: iccBytes.length,
  });
  const iccStream   = PDFRawStream.of(iccDict, iccBytes);
  const iccRef      = pdfDoc.context.register(iccStream);

  const outputIntent = pdfDoc.context.obj({
    Type:                     "OutputIntent",
    S:                        "GTS_PDFA1",
    OutputConditionIdentifier: "sRGB IEC61966-2.1",
    Info:                      "sRGB IEC61966-2.1",
    DestOutputProfile:         iccRef,
  });
  const outputIntentRef = pdfDoc.context.register(outputIntent);
  const outputIntentsArray = pdfDoc.context.obj([outputIntentRef]);
  pdfDoc.catalog.set(PDFName.of("OutputIntents"), outputIntentsArray);
}

export default async function handler(req, res) {
  cors(req, res, { methods: "POST, OPTIONS" });
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  // Authentification
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) return res.status(401).json({ error: "Non authentifié" });

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey)
    return res.status(500).json({ error: "Configuration serveur manquante" });

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: { user }, error: authErr } = await admin.auth.getUser(token);
  if (authErr || !user) return res.status(401).json({ error: "Token invalide" });

  const { pdf_base64, invoice, client, brand, sourceInvoice } = req.body || {};
  if (!pdf_base64 || !invoice) return res.status(400).json({ error: "pdf_base64 et invoice requis" });

  // Vérification propriété de la facture (si elle existe en base)
  if (invoice.id) {
    const { data: row } = await admin
      .from("invoices")
      .select("id")
      .eq("id", invoice.id)
      .eq("owner_id", user.id)
      .maybeSingle();
    if (!row) return res.status(403).json({ error: "Accès refusé à cette facture" });
  }

  try {
    const pdfBytes = Uint8Array.from(Buffer.from(pdf_base64, "base64"));
    const pdfDoc   = await PDFDocument.load(pdfBytes);

    // 1. Attache l'XML Factur-X
    const xml      = buildXML({ invoice, client, brand, sourceInvoice });
    const xmlBytes = new TextEncoder().encode(xml);
    await pdfDoc.attach(xmlBytes, XML_FILENAME, {
      mimeType:         "text/xml",
      description:      "Factur-X invoice metadata",
      creationDate:     new Date(),
      modificationDate: new Date(),
      afRelationship:   AFRelationship.Alternative,
    });

    // 2. OutputIntent sRGB si le profil ICC est disponible
    const icc = await loadSRGBProfile();
    addSRGBOutputIntent(pdfDoc, icc);

    // 3. Métadonnées classiques
    const docKind = invoice.avoir_of_invoice_id ? "Avoir" : "Facture";
    pdfDoc.setTitle(`${docKind} ${invoice.numero || ""}`.trim());
    pdfDoc.setProducer("Zenbat Factur-X");
    pdfDoc.setCreator("Zenbat");
    pdfDoc.setCreationDate(new Date());
    pdfDoc.setModificationDate(new Date());

    // 4. Bloc XMP Factur-X
    const xmpBytes = new TextEncoder().encode(buildXMP({ invoice }));
    const metaDict = pdfDoc.context.obj({
      Type:    PDFName.of("Metadata"),
      Subtype: PDFName.of("XML"),
      Length:  xmpBytes.length,
    });
    const metaRef = pdfDoc.context.register(PDFRawStream.of(metaDict, xmpBytes));
    pdfDoc.catalog.set(PDFName.of("Metadata"), metaRef);

    const out = await pdfDoc.save({ useObjectStreams: false });
    return res.status(200).json({
      pdf_base64: Buffer.from(out).toString("base64"),
      icc_applied: !!icc,
    });
  } catch (err) {
    console.error("[facturx]", err);
    return res.status(500).json({ error: err.message || "Erreur génération Factur-X" });
  }
}
