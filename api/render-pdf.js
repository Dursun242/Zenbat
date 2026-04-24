// Rendu PDF natif via Chromium headless.
// Le HTML produit ici est strictement aligné sur le composant
// PDFViewer.jsx (mêmes styles inline, mêmes Google Fonts) → le PDF
// imprimé par Chromium est pixel-identique à l'aperçu HTML.
//
// On utilise @sparticuz/chromium-min (bundle ~5 Mo) qui télécharge
// le binaire Chromium au cold start depuis une release GitHub :
// ça tient sous la limite 50 Mo des fonctions Vercel Hobby.

import { createClient } from '@supabase/supabase-js'
import puppeteer from 'puppeteer-core'
import chromium from '@sparticuz/chromium-min'

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '')
  .split(',').map(s => s.trim()).filter(Boolean)

// Binaire Chromium hébergé par Sparticuz. Aligner la version sur celle
// du package @sparticuz/chromium-min (cf. package.json).
const CHROMIUM_PACK_URL =
  process.env.CHROMIUM_PACK_URL ||
  'https://github.com/Sparticuz/chromium/releases/download/v147.0.2/chromium-v147.0.2-pack.x64.tar'

function cors(req, res) {
  const origin = req.headers.origin || ''
  const allow = process.env.VERCEL_ENV !== 'production' || ALLOWED_ORIGINS.includes(origin)
    ? origin
    : (ALLOWED_ORIGINS[0] || '')
  if (allow) res.setHeader('Access-Control-Allow-Origin', allow)
  res.setHeader('Vary', 'Origin')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
}

const fmt = n => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n || 0)
const fmtD = d => d ? new Date(d).toLocaleDateString('fr-FR') : '—'

function escape(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function buildHtml({ d, cl, brand, kind = 'devis' }) {
  const isAvoir = kind === 'facture' && !!d?.avoir_of_invoice_id
  const docLabel = isAvoir ? "FACTURE D'AVOIR" : kind === 'facture' ? 'FACTURE' : 'DEVIS'
  const NAVY = '#1e3a5f'

  const lignes = d.lignes || []
  const filteredLignes = lignes.filter((l, i) => {
    if (l.type_ligne !== 'lot') return true
    const rest = lignes.slice(i + 1)
    const nextLotIdx = rest.findIndex(x => x.type_ligne === 'lot')
    const group = nextLotIdx === -1 ? rest : rest.slice(0, nextLotIdx)
    return group.some(x => x.type_ligne === 'ouvrage')
  })
  const ouvrages = filteredLignes.filter(l => l.type_ligne === 'ouvrage')
  const rateOf = l => Number(l.tva_rate ?? d.tva_rate ?? 20)
  const ht = ouvrages.reduce((s, l) => s + (l.quantite || 0) * (l.prix_unitaire || 0), 0)
  const tvaGroups = ouvrages.reduce((acc, l) => {
    const r = rateOf(l)
    const lineHt = (l.quantite || 0) * (l.prix_unitaire || 0)
    acc[r] = (acc[r] || 0) + lineHt
    return acc
  }, {})
  const tvaRows = Object.keys(tvaGroups).map(r => Number(r)).sort((a, b) => a - b).map(r => ({
    rate: r, base: tvaGroups[r], montant: tvaGroups[r] * (r / 100),
  }))
  const tva = tvaRows.reduce((s, row) => s + row.montant, 0)
  const ttc = ht + tva

  const fontFamily = brand.fontStyle === 'elegant' ? 'Playfair Display'
                  : brand.fontStyle === 'tech'    ? 'Space Grotesk'
                  : 'DM Sans'
  const baseDate = d.date_emission ? new Date(d.date_emission) : new Date()
  const validUntil = isNaN(baseDate.getTime()) ? new Date() : baseDate
  validUntil.setDate(validUntil.getDate() + (brand.validityDays || 30))

  const clientName = cl?.raison_sociale || `${cl?.prenom || ''} ${cl?.nom || ''}`.trim() || '—'
  const clientLines = [
    cl?.adresse,
    [cl?.code_postal, cl?.ville].filter(Boolean).join(' '),
    cl?.email,
    cl?.telephone && `Tél : ${cl.telephone}`,
  ].filter(Boolean)
  const companyLines = [
    brand.address,
    brand.city,
    brand.phone && `Tél : ${brand.phone}`,
    brand.email,
    brand.siret && `SIRET : ${brand.siret}`,
  ].filter(Boolean)

  const isSigned = kind !== 'facture' && d.statut === 'accepte' && d.signed_at
  const signerDisplay = d.signed_by || clientName
  const signedDate = d.signed_at ? fmtD(d.signed_at) : ''
  const showFootnoteVAT = brand.vatRegime === 'franchise' &&
    !/(293\s*B|TVA\s+non\s+applicable)/i.test(brand.mentionsLegales || '')
  const identityParts = [
    brand.companyName && brand.legalForm ? `${brand.companyName} — ${brand.legalForm}` : (brand.legalForm || ''),
    brand.capital ? `au capital de ${brand.capital}` : '',
    brand.siret ? `SIRET ${brand.siret}` : '',
    brand.rcs ? brand.rcs : '',
    brand.tva && brand.vatRegime !== 'franchise' ? `TVA ${brand.tva}` : '',
  ].filter(Boolean).join(' · ')

  // Lignes du tableau
  const tableRows = filteredLignes.map((l, i) => {
    if (l.type_ligne === 'lot') {
      return `<tr><td colspan="6" style="padding:6px 8px;font-weight:700;font-size:9.5px;color:${NAVY};text-transform:uppercase;letter-spacing:.5px;border-bottom:1px solid ${NAVY}33;background:#eef2f7">${escape(l.designation)}</td></tr>`
    }
    const total = (l.quantite || 0) * (l.prix_unitaire || 0)
    const bg = i % 2 ? '#f8f9fb' : 'white'
    return `<tr style="background:${bg};border-bottom:1px solid #e5e7eb">
      <td style="padding:5px 8px">${escape(l.designation)}</td>
      <td style="padding:5px 5px;text-align:center;color:#6b7280">${escape(l.unite || '—')}</td>
      <td style="padding:5px 5px;text-align:center">${escape(l.quantite)}</td>
      <td style="padding:5px 6px;text-align:right">${fmt(l.prix_unitaire)}</td>
      <td style="padding:5px 5px;text-align:center;color:#6b7280">${escape(rateOf(l).toString().replace('.', ','))}%</td>
      <td style="padding:5px 8px;text-align:right;font-weight:600">${fmt(total)}</td>
    </tr>`
  }).join('')

  const tvaRowsHtml = tvaRows.map(row => `
    <tr>
      <td style="padding:3px 8px;color:#4b5563">TVA ${escape(row.rate.toString().replace('.', ','))}%<span style="color:#9ca3af;font-size:8.5px;margin-left:4px">(sur ${fmt(row.base)})</span></td>
      <td style="padding:3px 8px;text-align:right">${fmt(row.montant)}</td>
    </tr>`).join('')

  const retenueHtml = kind === 'facture' && Number(d.retenue_garantie_eur) > 0 ? `
    <tr>
      <td style="padding:4px 10px;color:#b45309">Retenue de garantie ${escape(d.retenue_garantie_pct)}%</td>
      <td style="padding:4px 10px;text-align:right;color:#b45309">−${fmt(d.retenue_garantie_eur)}</td>
    </tr>
    <tr style="background:#fef9c3;border-top:1px solid #fde68a">
      <td style="padding:8px 10px;font-weight:800;color:#92400e;font-size:11px">NET À PAYER</td>
      <td style="padding:8px 10px;text-align:right;font-weight:800;color:#92400e;font-size:12px">${fmt(ttc - Number(d.retenue_garantie_eur))}</td>
    </tr>` : ''

  const objetBanner = (d.ville_chantier || d.objet) ? `
    <div style="background:#f8f9fb;border:1px solid #e5e7eb;border-radius:4px;padding:6px 10px;margin-bottom:10px;font-size:9.5px;color:#374151">
      ${d.objet ? `<div><strong>Objet :</strong> ${escape(d.objet)}</div>` : ''}
      ${d.ville_chantier ? `<div><strong>Chantier :</strong> ${escape(d.ville_chantier)}</div>` : ''}
    </div>` : ''

  const observations = (d.observations || brand.defaultObservations) ? `
    <div style="margin-bottom:10px">
      <div style="font-size:9px;font-weight:700;color:${NAVY};margin-bottom:3px;letter-spacing:1px;text-transform:uppercase">Observations</div>
      <div style="font-size:9.5px;color:#374151;line-height:1.55">${escape(d.observations || brand.defaultObservations)}</div>
    </div>` : ''

  const conditionsBlock = (brand.paymentTerms || brand.iban || brand.rib) ? `
    <div style="display:grid;grid-template-columns:${brand.paymentTerms && (brand.rib || brand.iban) ? '1fr 1fr' : '1fr'};gap:10px;margin-bottom:10px">
      ${brand.paymentTerms ? `
        <div style="background:#f8f9fb;border-radius:4px;padding:8px 10px;border:1px solid #e5e7eb">
          <div style="font-size:9px;font-weight:700;color:${NAVY};margin-bottom:4px;letter-spacing:1px;text-transform:uppercase">Conditions</div>
          <div style="font-size:9.5px;color:#374151;line-height:1.55">${escape(brand.paymentTerms)}</div>
        </div>` : ''}
      ${(brand.rib || brand.iban) ? `
        <div style="background:#f8f9fb;border-radius:4px;padding:8px 10px;border:1px solid #e5e7eb">
          <div style="font-size:9px;font-weight:700;color:${NAVY};margin-bottom:4px;letter-spacing:1px;text-transform:uppercase">Coordonnées bancaires</div>
          ${brand.rib ? `<div style="font-size:9.5px;color:#374151;margin-bottom:2px">${escape(brand.rib)}</div>` : ''}
          ${brand.iban ? `<div style="font-size:9px;color:#4b5563;font-family:monospace;line-height:1.5">IBAN : ${escape(brand.iban)}</div>` : ''}
          ${brand.bic ? `<div style="font-size:9px;color:#4b5563;font-family:monospace">BIC : ${escape(brand.bic)}</div>` : ''}
        </div>` : ''}
    </div>` : ''

  const legalBlock = kind !== 'facture' && (brand.devisGratuit !== undefined || brand.travelFees) ? `
    <div style="margin-top:14px;padding-top:10px;border-top:1px solid #e5e7eb;font-size:9px;color:#4b5563;line-height:1.6">
      <div style="font-size:8px;font-weight:700;color:#9ca3af;letter-spacing:1px;margin-bottom:4px">INFORMATIONS LÉGALES</div>
      <div style="display:flex;flex-wrap:wrap;gap:14px">
        ${brand.devisGratuit !== false
          ? `<span>• Devis <strong>gratuit</strong>.</span>`
          : `<span>• Devis <strong>payant</strong>${brand.devisTarif ? ` : ${escape(brand.devisTarif)}` : ''} (déductible en cas de signature).</span>`}
        ${brand.travelFees ? `<span>• Frais de déplacement : ${escape(brand.travelFees)}</span>` : ''}
        ${brand.validityDays ? `<span>• Validité : ${escape(brand.validityDays)} jour${brand.validityDays > 1 ? 's' : ''} à compter de l'émission.</span>` : ''}
      </div>
    </div>` : ''

  const signatureBlock = kind !== 'facture' ? `
    <div style="display:grid;grid-template-columns:2fr 1fr;gap:14px;margin-top:14px;padding-top:12px;border-top:2px solid ${isSigned ? '#16a34a' : '#d4d4d8'}">
      <div>
        <div style="font-size:9px;color:${isSigned ? '#15803d' : '#6b7280'};font-weight:700;letter-spacing:1px;margin-bottom:6px">SIGNATURE CLIENT · Bon pour accord</div>
        ${isSigned ? `
          <div style="height:40px;display:flex;flex-direction:column;justify-content:center;border-bottom:1px solid #16a34a">
            <div style="font-size:11px;font-weight:700;color:#15803d;font-family:cursive;letter-spacing:.5px">${escape(signerDisplay)}</div>
            <div style="font-size:8px;color:#16a34a;margin-top:2px">✓ Signé électroniquement via Odoo Sign</div>
          </div>` : `<div style="height:40px;border-bottom:1px solid #9ca3af"></div>`}
      </div>
      <div>
        <div style="font-size:9px;color:${isSigned ? '#15803d' : '#6b7280'};font-weight:700;letter-spacing:1px;margin-bottom:6px">DATE</div>
        ${isSigned ? `
          <div style="height:40px;display:flex;align-items:center;border-bottom:1px solid #16a34a">
            <div style="font-size:11px;font-weight:600;color:#15803d">${escape(signedDate)}</div>
          </div>` : `<div style="height:40px;border-bottom:1px solid #9ca3af"></div>`}
      </div>
    </div>` : ''

  const mentionsLegalesLines = (brand.mentionsLegales || '').split('\n').filter(Boolean)
    .map(line => `<div>${escape(line)}</div>`).join('')

  const headerLogo = brand.logo
    ? `<img src="${escape(brand.logo)}" alt="" style="height:44px;max-width:180px;object-fit:contain;display:block;margin-bottom:6px"/>`
    : `<div style="font-weight:800;font-size:16px;color:${NAVY}">${escape(brand.companyName || 'Votre Entreprise')}</div>`

  const dateLine = kind === 'facture'
    ? (d.date_echeance ? `<div style="color:#64748b;font-size:10px">Échéance <strong style="color:#1a1a1a">${fmtD(d.date_echeance)}</strong></div>` : '')
    : `<div style="color:#64748b;font-size:10px">Valide jusqu'au <strong style="color:#1a1a1a">${fmtD(validUntil.toISOString())}</strong></div>`

  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=Playfair+Display:wght@700&family=Space+Grotesk:wght@400;600;700&display=swap">
<style>
  @page { size: A4; margin: 0; }
  html, body { margin: 0; padding: 0; }
  body {
    font-family: '${fontFamily}', system-ui, sans-serif;
    color: #1a1a1a;
    font-size: 11px;
    line-height: 1.5;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .pdf-page {
    background: white;
    width: 210mm;
    min-height: 297mm;
    padding: 10mm;
    box-sizing: border-box;
  }
  table { border-collapse: collapse; }
  strong { font-weight: 700; }
</style>
</head>
<body>
<div class="pdf-page">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px;padding-bottom:10px;border-bottom:2px solid ${NAVY}">
    <div>${headerLogo}</div>
    <div style="text-align:right">
      <div style="color:#94a3b8;font-size:10px;font-weight:600;letter-spacing:2px">${docLabel}</div>
      <div style="color:${NAVY};font-weight:800;font-size:20px;margin-top:2px">${escape(d.numero)}</div>
      <div style="color:#64748b;font-size:10px;margin-top:6px">Émis le <strong style="color:#1a1a1a">${fmtD(d.date_emission)}</strong></div>
      ${dateLine}
    </div>
  </div>

  <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px">
    <div style="border:1px solid #d4d4d8;border-radius:4px;padding:8px 10px">
      <div style="font-size:8.5px;color:#6b7280;font-weight:700;letter-spacing:1px;margin-bottom:4px;text-transform:uppercase">Entreprise</div>
      <div style="font-size:12px;font-weight:700;color:#111;margin-bottom:3px">${escape(brand.companyName || '—')}</div>
      ${companyLines.map(l => `<div style="font-size:9.5px;color:#4b5563;line-height:1.55">${escape(l)}</div>`).join('')}
    </div>
    <div style="border:1px solid #d4d4d8;border-radius:4px;padding:8px 10px">
      <div style="font-size:8.5px;color:#6b7280;font-weight:700;letter-spacing:1px;margin-bottom:4px;text-transform:uppercase">Maître d'ouvrage</div>
      <div style="font-size:12px;font-weight:700;color:#111;margin-bottom:3px">${escape(clientName)}</div>
      ${clientLines.map(l => `<div style="font-size:9.5px;color:#4b5563;line-height:1.55">${escape(l)}</div>`).join('')}
    </div>
  </div>

  ${objetBanner}

  <div style="font-size:10px;font-weight:700;color:${NAVY};margin-bottom:6px;letter-spacing:1px;text-transform:uppercase">Détail des prestations</div>
  <table style="width:100%;font-size:10px;margin-bottom:12px">
    <thead>
      <tr style="background:${NAVY};color:white">
        <th style="text-align:left;padding:6px 8px;font-weight:600">Description</th>
        <th style="text-align:center;padding:6px 5px;font-weight:600;width:44px">Unité</th>
        <th style="text-align:center;padding:6px 5px;font-weight:600;width:38px">Qté</th>
        <th style="text-align:right;padding:6px 6px;font-weight:600;width:66px">PU HT</th>
        <th style="text-align:center;padding:6px 5px;font-weight:600;width:44px">TVA</th>
        <th style="text-align:right;padding:6px 8px;font-weight:600;width:72px">Total HT</th>
      </tr>
    </thead>
    <tbody>${tableRows}</tbody>
  </table>

  <div style="display:flex;justify-content:flex-end;margin-bottom:12px">
    <table style="font-size:10px;min-width:240px">
      <tbody>
        <tr><td style="padding:3px 8px;color:#4b5563">Total HT</td><td style="padding:3px 8px;text-align:right;font-weight:600">${fmt(ht)}</td></tr>
        ${tvaRowsHtml}
        <tr style="background:#eef2f7;border-top:2px solid ${NAVY}">
          <td style="padding:6px 8px;font-weight:800;color:${NAVY};font-size:10.5px">TOTAL TTC</td>
          <td style="padding:6px 8px;text-align:right;font-weight:800;color:${NAVY};font-size:11.5px">${fmt(ttc)}</td>
        </tr>
        ${retenueHtml}
      </tbody>
    </table>
  </div>

  ${observations}
  ${conditionsBlock}
  ${legalBlock}
  ${signatureBlock}

  <div style="margin-top:14px;padding-top:8px;border-top:1px solid #e5e7eb;display:flex;justify-content:space-between;gap:10px;font-size:8px;color:#9ca3af;line-height:1.5">
    <div style="flex:1">
      ${showFootnoteVAT ? `<div style="font-weight:600;color:#6b7280;margin-bottom:2px">TVA non applicable, art. 293 B du CGI</div>` : ''}
      ${mentionsLegalesLines}
      ${identityParts ? `<div>${escape(identityParts)}</div>` : (brand.siret ? `<div>SIRET ${escape(brand.siret)}</div>` : '')}
      ${kind === 'facture' && brand.paymentPenalties ? `<div style="margin-top:3px">${escape(brand.paymentPenalties)}</div>` : ''}
      ${kind === 'facture' && brand.escompte ? `<div>${escape(brand.escompte)}</div>` : ''}
    </div>
    <div style="text-align:right;flex-shrink:0">Généré via Zenbat</div>
  </div>
</div>
</body>
</html>`
}

export const config = {
  // Cold start de Chromium ~3-5s, puis ~1-2s par PDF.
  maxDuration: 30,
}

export default async function handler(req, res) {
  cors(req, res)
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Non authentifié' })

  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) {
    return res.status(500).json({ error: 'Supabase non configuré' })
  }
  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data: { user }, error: authErr } = await admin.auth.getUser(token)
  if (authErr || !user) return res.status(401).json({ error: 'Token invalide' })

  const { d, cl, brand, kind = 'devis' } = req.body || {}
  if (!d || !brand) return res.status(400).json({ error: 'd et brand requis' })

  let browser = null
  try {
    const html = buildHtml({ d, cl: cl || {}, brand, kind })

    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(CHROMIUM_PACK_URL),
      headless: chromium.headless,
    })
    const page = await browser.newPage()
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 25_000 })
    // L'@import des Google Fonts arrive parfois après networkidle :
    // attendre explicitement que les polices déclarées soient prêtes.
    await page.evaluate(() => document.fonts && document.fonts.ready)
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
    })

    res.setHeader('Content-Type', 'application/json')
    return res.status(200).json({ pdf_base64: pdfBuffer.toString('base64') })
  } catch (err) {
    console.error('[render-pdf]', err)
    return res.status(500).json({
      error: 'Erreur génération PDF',
      detail: err?.message || String(err),
    })
  } finally {
    if (browser) await browser.close().catch(() => {})
  }
}
