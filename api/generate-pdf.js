/**
 * API Endpoint pour générer un PDF à partir du HTML d'un devis
 * POST /api/generate-pdf
 * Body: { html: string, filename?: string }
 */

import puppeteer from "puppeteer";
import chromium from "@sparticuz/chromium";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { html, filename = "devis.pdf" } = req.body;

  if (!html) {
    return res.status(400).json({ error: "HTML content is required" });
  }

  try {
    // Optimisé pour Vercel/Lambda
    const executablePath = await chromium.executablePath(
      "https://github.com/Sparticuz/chromium/releases/download/v119.0.0/chromium-v119.0.0-pack.tar.br"
    );

    const browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath,
      headless: true,
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 793, height: 1122 });

    // Désactive les animations/transitions pour plus rapidité
    await page.addStyleTag({
      content: `
        * {
          animation: none !important;
          transition: none !important;
        }
      `,
    });

    // Injecter le HTML avec timeout générique
    await page.setContent(html, {
      waitUntil: ["domcontentloaded", "networkidle2"],
      timeout: 30000,
    });

    // Attendre que les fonts se chargent
    try {
      await page.evaluateHandle("document.fonts.ready");
    } catch (e) {
      // Ignore si fonts.ready n'est pas disponible
    }

    // Générer le PDF avec marges zéro pour maximum fidélité
    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
      preferCSSPageSize: true, // Respecte le CSS page size si défini
    });

    await browser.close();

    // Retourner le PDF
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Cache-Control", "public, max-age=3600"); // Cache 1h
    res.send(pdfBuffer);
  } catch (error) {
    console.error("[generate-pdf] Error:", error);
    res.status(500).json({ error: "Failed to generate PDF", message: error.message });
  }
}
