// Document PDF natif (vectoriel) pour devis et factures.
// Remplace l'ancien rendu html2canvas par @react-pdf/renderer : texte
// sélectionnable, fichier ~10× plus léger, rendu net à tout zoom.
import { Document, Page, View, Text, Image, StyleSheet } from "@react-pdf/renderer";
import { ensurePdfFontsRegistered, pdfFontFamily } from "../lib/pdfFonts.js";
import { fmt, fmtD } from "../lib/utils.js";

ensurePdfFontsRegistered();

// Intl.NumberFormat("fr-FR") insère un U+202F (NARROW NO-BREAK SPACE) entre
// les milliers et un U+00A0 avant €. Helvetica built-in PDF ne contient pas
// le glyphe U+202F → il s'affiche comme un "/". On normalise en U+00A0 pour
// que le séparateur de milliers reste un espace insécable mais visible.
const fmtPdf = (n) => fmt(n).replace(/ /g, " ");
const NAVY = "#1e3a5f";

// Conversion 1px = 0.75pt à 96dpi : on travaille en pixels pour rester
// iso-aperçu HTML (210mm × 297mm = 793 × 1122px). react-pdf accepte les
// chaînes "Npx" pour fontSize/padding/margin/border.
const px = (n) => `${n}px`;

const makeStyles = (fontFamily) => StyleSheet.create({
  page: {
    fontFamily,
    fontSize: px(11),
    color: "#1a1a1a",
    padding: "10mm",
    // react-pdf calcule la hauteur de ligne à partir des métriques
    // ascent/descent du TTF × lineHeight. DM Sans a un linegap généreux,
    // donc 1.3 dans le PDF rend visuellement comme 1.5 dans le HTML.
    lineHeight: 1.3,
  },

  // Header
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: px(8),
    paddingBottom: px(8),
    borderBottomWidth: 2,
    borderBottomColor: NAVY,
    borderBottomStyle: "solid",
  },
  logo: { height: px(44), maxWidth: px(180), objectFit: "contain", marginBottom: px(6) },
  companyFallback: { fontWeight: 800, fontSize: px(16), color: NAVY },
  docLabel: { color: "#94a3b8", fontSize: px(10), fontWeight: 600, letterSpacing: 2, textAlign: "right" },
  docNumero: { color: NAVY, fontWeight: 800, fontSize: px(20), marginTop: px(2), textAlign: "right" },
  docDate: { color: "#64748b", fontSize: px(10), marginTop: px(4), textAlign: "right" },
  docDateLine: { color: "#64748b", fontSize: px(10), textAlign: "right" },
  bold1a: { color: "#1a1a1a", fontWeight: 700 },

  // Cards entreprise / client
  twoCols: { flexDirection: "row", gap: px(8), marginBottom: px(8) },
  card: {
    flex: 1,
    borderWidth: 1, borderColor: "#d4d4d8", borderStyle: "solid",
    borderRadius: px(4),
    padding: "6px 10px",
  },
  cardLabel: { fontSize: px(8.5), color: "#6b7280", fontWeight: 700, letterSpacing: 1, marginBottom: px(3), textTransform: "uppercase" },
  cardName: { fontSize: px(12), fontWeight: 700, color: "#111", marginBottom: px(2) },
  cardLine: { fontSize: px(9.5), color: "#4b5563", lineHeight: 1.35 },

  // Banner objet/chantier
  banner: {
    backgroundColor: "#f8f9fb",
    borderWidth: 1, borderColor: "#e5e7eb", borderStyle: "solid",
    borderRadius: px(4),
    padding: "5px 10px",
    marginBottom: px(6),
    fontSize: px(9.5),
    color: "#374151",
    lineHeight: 1.3,
  },

  sectionTitle: { fontSize: px(10), fontWeight: 700, color: NAVY, marginBottom: px(4), letterSpacing: 1, textTransform: "uppercase" },

  // Table prestations
  tableBottomSpacer: { marginBottom: px(6) },
  trHead: { flexDirection: "row", backgroundColor: NAVY },
  thBase: { color: "white", fontSize: px(10), fontWeight: 600, padding: "5px 5px" },
  trLot: { flexDirection: "row", backgroundColor: "#eef2f7", borderBottomWidth: 1, borderBottomColor: `${NAVY}33`, borderBottomStyle: "solid" },
  tdLot: { fontSize: px(9.5), fontWeight: 700, color: NAVY, padding: "4px 8px", textTransform: "uppercase", letterSpacing: 0.5, flex: 1 },
  trData: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#e5e7eb", borderBottomStyle: "solid" },
  trDataAlt: { backgroundColor: "#f8f9fb" },
  tdBase: { fontSize: px(10), padding: "4px 5px", lineHeight: 1.3 },

  // Totaux
  totalsWrap: { flexDirection: "row", justifyContent: "flex-end", marginBottom: px(6) },
  totalsTable: { minWidth: px(240) },
  totalRow: { flexDirection: "row", justifyContent: "space-between", padding: "2px 8px" },
  totalLabel: { fontSize: px(10), color: "#4b5563" },
  totalValue: { fontSize: px(10), fontWeight: 600, textAlign: "right" },
  ttcRow: {
    flexDirection: "row", justifyContent: "space-between",
    backgroundColor: "#eef2f7", borderTopWidth: 2, borderTopColor: NAVY, borderTopStyle: "solid",
    padding: "5px 8px",
  },
  ttcLabel: { fontSize: px(10.5), fontWeight: 800, color: NAVY },
  ttcValue: { fontSize: px(11.5), fontWeight: 800, color: NAVY, textAlign: "right" },
  retRow: { flexDirection: "row", justifyContent: "space-between", padding: "3px 10px" },
  retLabel: { fontSize: px(10), color: "#b45309" },
  retValue: { fontSize: px(10), color: "#b45309", textAlign: "right" },
  netRow: {
    flexDirection: "row", justifyContent: "space-between",
    backgroundColor: "#fef9c3", borderTopWidth: 1, borderTopColor: "#fde68a", borderTopStyle: "solid",
    padding: "6px 10px",
  },
  netLabel: { fontSize: px(11), fontWeight: 800, color: "#92400e" },
  netValue: { fontSize: px(12), fontWeight: 800, color: "#92400e", textAlign: "right" },

  // Observations
  obsBlock: { marginBottom: px(6) },
  obsTitle: { fontSize: px(9), fontWeight: 700, color: NAVY, marginBottom: px(2), letterSpacing: 1, textTransform: "uppercase" },
  obsText: { fontSize: px(9.5), color: "#374151", lineHeight: 1.35 },

  // Conditions / Banque
  twoColsCond: { flexDirection: "row", gap: px(10), marginBottom: px(6) },
  condCard: {
    flex: 1,
    backgroundColor: "#f8f9fb",
    borderWidth: 1, borderColor: "#e5e7eb", borderStyle: "solid",
    borderRadius: px(4),
    padding: "6px 10px",
  },
  condTitle: { fontSize: px(9), fontWeight: 700, color: NAVY, marginBottom: px(3), letterSpacing: 1, textTransform: "uppercase" },
  condText: { fontSize: px(9.5), color: "#374151", lineHeight: 1.35 },
  ibanText: { fontSize: px(9), color: "#4b5563", fontFamily: "Courier", lineHeight: 1.3 },

  // Mentions BTP
  legalBlock: { marginTop: px(8), paddingTop: px(6), borderTopWidth: 1, borderTopColor: "#e5e7eb", borderTopStyle: "solid" },
  legalLabel: { fontSize: px(8), fontWeight: 700, color: "#9ca3af", letterSpacing: 1, marginBottom: px(3) },
  legalRow: { flexDirection: "row", flexWrap: "wrap", fontSize: px(9), color: "#4b5563", lineHeight: 1.4 },
  legalItem: { fontSize: px(9), color: "#4b5563", marginRight: px(14) },

  // Signature
  signWrap: { flexDirection: "row", gap: px(14), marginTop: px(8), paddingTop: px(8), borderTopWidth: 2, borderTopStyle: "solid" },
  signCol1: { flex: 2 },
  signCol2: { flex: 1 },
  signLabel: { fontSize: px(9), fontWeight: 700, letterSpacing: 1, marginBottom: px(4) },
  signLine: { height: px(28), borderBottomWidth: 1, borderBottomStyle: "solid" },

  // Footer
  footer: {
    marginTop: px(8), paddingTop: px(6),
    borderTopWidth: 1, borderTopColor: "#e5e7eb", borderTopStyle: "solid",
    flexDirection: "row", justifyContent: "space-between", gap: px(10),
  },
  footerText: { fontSize: px(8), color: "#9ca3af", lineHeight: 1.3 },
  footerStrong: { fontSize: px(8), color: "#6b7280", fontWeight: 600, marginBottom: px(1) },
  footerRight: { fontSize: px(8), color: "#9ca3af", textAlign: "right", flexShrink: 0 },
});

// Largeurs des colonnes du tableau alignées sur l'aperçu HTML : colonnes
// chiffrées à largeur fixe (en px comme PDFViewer.jsx) et description qui
// remplit l'espace restant via flexGrow.
const COL = {
  desc:  { flexGrow: 1, flexShrink: 1, flexBasis: 0 },
  unite: { width: "44px" },
  qte:   { width: "38px" },
  pu:    { width: "66px" },
  tva:   { width: "44px" },
  total: { width: "72px" },
};

export default function DevisPDFDocument({ d, cl, brand, kind = "devis" }) {
  const fontFamily = pdfFontFamily(brand);
  const styles = makeStyles(fontFamily);

  const isAvoir  = kind === "facture" && !!d?.avoir_of_invoice_id;
  const docLabel = isAvoir ? "FACTURE D'AVOIR" : kind === "facture" ? "FACTURE" : "DEVIS";

  const lignes = d.lignes || [];
  const filteredLignes = lignes.filter((l, i) => {
    if (l.type_ligne !== "lot") return true;
    const rest = lignes.slice(i + 1);
    const nextLotIdx = rest.findIndex((x) => x.type_ligne === "lot");
    const group = nextLotIdx === -1 ? rest : rest.slice(0, nextLotIdx);
    return group.some((x) => x.type_ligne === "ouvrage");
  });

  const ouvrages = filteredLignes.filter((l) => l.type_ligne === "ouvrage");
  const rateOf = (l) => Number(l.tva_rate ?? d.tva_rate ?? 20);
  const ht = ouvrages.reduce((s, l) => s + (l.quantite || 0) * (l.prix_unitaire || 0), 0);
  const tvaGroups = ouvrages.reduce((acc, l) => {
    const r = rateOf(l);
    const lineHt = (l.quantite || 0) * (l.prix_unitaire || 0);
    acc[r] = (acc[r] || 0) + lineHt;
    return acc;
  }, {});
  const tvaRows = Object.keys(tvaGroups).map((r) => Number(r)).sort((a, b) => a - b).map((r) => ({
    rate: r, base: tvaGroups[r], montant: tvaGroups[r] * (r / 100),
  }));
  const tva = tvaRows.reduce((s, row) => s + row.montant, 0);
  const ttc = ht + tva;

  const baseDate = d.date_emission ? new Date(d.date_emission) : new Date();
  const validUntil = isNaN(baseDate.getTime()) ? new Date() : baseDate;
  validUntil.setDate(validUntil.getDate() + (brand.validityDays || 30));

  const clientName = cl?.raison_sociale || `${cl?.prenom || ""} ${cl?.nom || ""}`.trim() || "—";
  const clientLines = [
    cl?.adresse,
    [cl?.code_postal, cl?.ville].filter(Boolean).join(" "),
    cl?.email,
    cl?.telephone && `Tél : ${cl.telephone}`,
  ].filter(Boolean);

  const companyLines = [
    brand.address,
    brand.city,
    brand.phone && `Tél : ${brand.phone}`,
    brand.email,
    brand.siret && `SIRET : ${brand.siret}`,
  ].filter(Boolean);

  const isSigned = kind !== "facture" && d.statut === "accepte" && d.signed_at;
  const signerDisplay = d.signed_by || clientName;
  const signedDate = d.signed_at ? fmtD(d.signed_at) : "";

  const showFootnoteVAT = brand.vatRegime === "franchise" && !/(293\s*B|TVA\s+non\s+applicable)/i.test(brand.mentionsLegales || "");
  const identityParts = [
    brand.companyName && brand.legalForm ? `${brand.companyName} — ${brand.legalForm}` : (brand.legalForm || ""),
    brand.capital ? `au capital de ${brand.capital}` : "",
    brand.siret ? `SIRET ${brand.siret}` : "",
    brand.rcs   ? brand.rcs : "",
    brand.tva && brand.vatRegime !== "franchise" ? `TVA ${brand.tva}` : "",
  ].filter(Boolean).join(" · ");

  return (
    <Document>
      <Page size="A4" style={styles.page} wrap>
        {/* HEADER */}
        <View style={styles.header} fixed={false}>
          <View>
            {brand.logo
              ? <Image src={brand.logo} style={styles.logo} />
              : <Text style={styles.companyFallback}>{brand.companyName || "Votre Entreprise"}</Text>}
          </View>
          <View>
            <Text style={styles.docLabel}>{docLabel}</Text>
            <Text style={styles.docNumero}>{d.numero}</Text>
            <Text style={styles.docDate}>Émis le <Text style={styles.bold1a}>{fmtD(d.date_emission)}</Text></Text>
            {kind === "facture"
              ? d.date_echeance && <Text style={styles.docDateLine}>Échéance <Text style={styles.bold1a}>{fmtD(d.date_echeance)}</Text></Text>
              : <Text style={styles.docDateLine}>Valide jusqu'au <Text style={styles.bold1a}>{fmtD(validUntil.toISOString())}</Text></Text>
            }
          </View>
        </View>

        {/* ENTREPRISE / CLIENT */}
        <View style={styles.twoCols}>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Entreprise</Text>
            <Text style={styles.cardName}>{brand.companyName || "—"}</Text>
            {companyLines.map((line, i) => <Text key={i} style={styles.cardLine}>{line}</Text>)}
          </View>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Maître d'ouvrage</Text>
            <Text style={styles.cardName}>{clientName}</Text>
            {clientLines.map((line, i) => <Text key={i} style={styles.cardLine}>{line}</Text>)}
          </View>
        </View>

        {/* BANNER OBJET / CHANTIER */}
        {(d.ville_chantier || d.objet) && (
          <View style={styles.banner}>
            {d.objet && <Text><Text style={{ fontWeight: 700 }}>Objet :</Text> {d.objet}</Text>}
            {d.ville_chantier && <Text><Text style={{ fontWeight: 700 }}>Chantier :</Text> {d.ville_chantier}</Text>}
          </View>
        )}

        {/* TABLE PRESTATIONS — pas de View wrapper pour laisser react-pdf
            paginer naturellement ligne par ligne, sinon le tableau entier
            saute en page suivante et laisse du blanc page 1. */}
        <Text style={styles.sectionTitle}>Détail des prestations</Text>
        <View style={styles.trHead}>
          <Text style={[styles.thBase, COL.desc,  { textAlign: "left",   padding: "6px 8px" }]}>Description</Text>
          <Text style={[styles.thBase, COL.unite, { textAlign: "center" }]}>Unité</Text>
          <Text style={[styles.thBase, COL.qte,   { textAlign: "center" }]}>Qté</Text>
          <Text style={[styles.thBase, COL.pu,    { textAlign: "right",  padding: "6px 6px" }]}>PU HT</Text>
          <Text style={[styles.thBase, COL.tva,   { textAlign: "center" }]}>TVA</Text>
          <Text style={[styles.thBase, COL.total, { textAlign: "right",  padding: "6px 8px" }]}>Total HT</Text>
        </View>

        {filteredLignes.map((l, i) => {
          if (l.type_ligne === "lot") {
            return (
              <View key={l.id} style={styles.trLot} wrap={false}>
                <Text style={styles.tdLot}>{l.designation}</Text>
              </View>
            );
          }
          const total = (l.quantite || 0) * (l.prix_unitaire || 0);
          return (
            <View key={l.id} style={[styles.trData, i % 2 ? styles.trDataAlt : null]} wrap={false}>
              <Text style={[styles.tdBase, COL.desc,  { textAlign: "left",   padding: "5px 8px" }]}>{l.designation}</Text>
              <Text style={[styles.tdBase, COL.unite, { textAlign: "center", color: "#6b7280" }]}>{l.unite || "—"}</Text>
              <Text style={[styles.tdBase, COL.qte,   { textAlign: "center" }]}>{String(l.quantite ?? "")}</Text>
              <Text style={[styles.tdBase, COL.pu,    { textAlign: "right",  padding: "5px 6px" }]}>{fmtPdf(l.prix_unitaire)}</Text>
              <Text style={[styles.tdBase, COL.tva,   { textAlign: "center", color: "#6b7280" }]}>{rateOf(l).toString().replace(".", ",")}%</Text>
              <Text style={[styles.tdBase, COL.total, { textAlign: "right",  padding: "5px 8px", fontWeight: 600 }]}>{fmtPdf(total)}</Text>
            </View>
          );
        })}
        <View style={styles.tableBottomSpacer} />


        {/* TOTAUX — wrap={false} pour que TTC/retenue/net restent collés
            aux sous-totaux HT/TVA et ne se retrouvent pas orphelins en
            page suivante. */}
        <View style={styles.totalsWrap} wrap={false}>
          <View style={styles.totalsTable}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total HT</Text>
              <Text style={styles.totalValue}>{fmtPdf(ht)}</Text>
            </View>
            {tvaRows.map((row) => (
              <View key={row.rate} style={styles.totalRow}>
                <Text style={styles.totalLabel}>
                  TVA {row.rate.toString().replace(".", ",")}%
                  <Text style={{ color: "#9ca3af", fontSize: px(8.5) }}>  (sur {fmtPdf(row.base)})</Text>
                </Text>
                <Text style={[styles.totalValue, { fontWeight: 400 }]}>{fmtPdf(row.montant)}</Text>
              </View>
            ))}
            <View style={styles.ttcRow}>
              <Text style={styles.ttcLabel}>TOTAL TTC</Text>
              <Text style={styles.ttcValue}>{fmtPdf(ttc)}</Text>
            </View>
            {kind === "facture" && Number(d.retenue_garantie_eur) > 0 && (
              <>
                <View style={styles.retRow}>
                  <Text style={styles.retLabel}>Retenue de garantie {d.retenue_garantie_pct}%</Text>
                  <Text style={styles.retValue}>−{fmtPdf(d.retenue_garantie_eur)}</Text>
                </View>
                <View style={styles.netRow}>
                  <Text style={styles.netLabel}>NET À PAYER</Text>
                  <Text style={styles.netValue}>{fmtPdf(ttc - Number(d.retenue_garantie_eur))}</Text>
                </View>
              </>
            )}
          </View>
        </View>

        {/* OBSERVATIONS */}
        {(d.observations || brand.defaultObservations) && (
          <View style={styles.obsBlock}>
            <Text style={styles.obsTitle}>Observations</Text>
            <Text style={styles.obsText}>{d.observations || brand.defaultObservations}</Text>
          </View>
        )}

        {/* CONDITIONS / BANQUE */}
        {(brand.paymentTerms || brand.iban || brand.rib) && (
          <View style={styles.twoColsCond}>
            {brand.paymentTerms && (
              <View style={styles.condCard}>
                <Text style={styles.condTitle}>Conditions</Text>
                <Text style={styles.condText}>{brand.paymentTerms}</Text>
              </View>
            )}
            {(brand.rib || brand.iban) && (
              <View style={styles.condCard}>
                <Text style={styles.condTitle}>Coordonnées bancaires</Text>
                {brand.rib && <Text style={[styles.condText, { marginBottom: px(2) }]}>{brand.rib}</Text>}
                {brand.iban && <Text style={styles.ibanText}>IBAN : {brand.iban}</Text>}
                {brand.bic && <Text style={styles.ibanText}>BIC : {brand.bic}</Text>}
              </View>
            )}
          </View>
        )}

        {/* MENTIONS BTP (devis uniquement) */}
        {kind !== "facture" && (brand.devisGratuit !== undefined || brand.travelFees) && (
          <View style={styles.legalBlock}>
            <Text style={styles.legalLabel}>INFORMATIONS LÉGALES</Text>
            <View style={styles.legalRow}>
              {brand.devisGratuit !== false ? (
                <Text style={styles.legalItem}>• Devis <Text style={{ fontWeight: 700 }}>gratuit</Text>.</Text>
              ) : (
                <Text style={styles.legalItem}>
                  • Devis <Text style={{ fontWeight: 700 }}>payant</Text>{brand.devisTarif ? ` : ${brand.devisTarif}` : ""} (déductible en cas de signature).
                </Text>
              )}
              {brand.travelFees && <Text style={styles.legalItem}>• Frais de déplacement : {brand.travelFees}</Text>}
              {brand.validityDays && <Text style={styles.legalItem}>• Validité : {brand.validityDays} jour{brand.validityDays > 1 ? "s" : ""} à compter de l'émission.</Text>}
            </View>
          </View>
        )}

        {/* SIGNATURE (devis uniquement) */}
        {kind !== "facture" && (
          <View style={[styles.signWrap, { borderTopColor: isSigned ? "#16a34a" : "#d4d4d8" }]}>
            <View style={styles.signCol1}>
              <Text style={[styles.signLabel, { color: isSigned ? "#15803d" : "#6b7280" }]}>SIGNATURE CLIENT · Bon pour accord</Text>
              {isSigned ? (
                <View style={[styles.signLine, { borderBottomColor: "#16a34a", justifyContent: "center" }]}>
                  <Text style={{ fontSize: px(11), fontWeight: 700, color: "#15803d" }}>{signerDisplay}</Text>
                  <Text style={{ fontSize: px(8), color: "#16a34a", marginTop: px(2) }}>✓ Signé électroniquement via Odoo Sign</Text>
                </View>
              ) : (
                <View style={[styles.signLine, { borderBottomColor: "#9ca3af" }]} />
              )}
            </View>
            <View style={styles.signCol2}>
              <Text style={[styles.signLabel, { color: isSigned ? "#15803d" : "#6b7280" }]}>DATE</Text>
              {isSigned ? (
                <View style={[styles.signLine, { borderBottomColor: "#16a34a", justifyContent: "center" }]}>
                  <Text style={{ fontSize: px(11), fontWeight: 600, color: "#15803d" }}>{signedDate}</Text>
                </View>
              ) : (
                <View style={[styles.signLine, { borderBottomColor: "#9ca3af" }]} />
              )}
            </View>
          </View>
        )}

        {/* FOOTER */}
        <View style={styles.footer}>
          <View style={{ flex: 1 }}>
            {showFootnoteVAT && <Text style={styles.footerStrong}>TVA non applicable, art. 293 B du CGI</Text>}
            {/* brand.mentionsLegales peut contenir des \n → on split et on
                rend chaque ligne comme un Text distinct, pour que le flex
                column calcule la hauteur correctement (sans cette séparation
                les lignes suivantes se superposent visuellement). */}
            {(brand.mentionsLegales || "").split("\n").filter(Boolean).map((line, i) => (
              <Text key={`ml-${i}`} style={styles.footerText}>{line}</Text>
            ))}
            {(identityParts || brand.siret) && <Text style={styles.footerText}>{identityParts || `SIRET ${brand.siret}`}</Text>}
            {kind === "facture" && brand.paymentPenalties && <Text style={[styles.footerText, { marginTop: px(3) }]}>{brand.paymentPenalties}</Text>}
            {kind === "facture" && brand.escompte && <Text style={styles.footerText}>{brand.escompte}</Text>}
          </View>
          <Text style={styles.footerRight}>Généré via Zenbat</Text>
        </View>
      </Page>
    </Document>
  );
}
