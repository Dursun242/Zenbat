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
      args: [
        ...chromium.args,
        "--disable-gpu",
        "--single-process", // Réduit overhead Chromium
        "--no-sandbox",
      ],
      defaultViewport: chromium.defaultViewport,
      executablePath,
      headless: "new",
    });

    const page = await browser.newPage();
    // Dimension exacte A4 en pixels (210mm × 297mm @ 96dpi)
    await page.setViewport({ width: 794, height: 1123 });

    // Injecter le HTML rapidement (sans attendre networkidle)
    await page.setContent(html, {
      waitUntil: "domcontentloaded",
      timeout: 20000,
    });

    // Attendre explicitement les fonts Google
    try {
      await page.evaluateHandle(() => document.fonts.ready);
    } catch (e) {
      console.warn("Font ready not available, continuing...");
    }

    // Petit délai pour que le rendu se stabilise
    await page.evaluateHandle(() => new Promise(r => setTimeout(r, 500)));

    // Générer le PDF avec qualité maximale
    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
      scale: 1, // Respecte 100% du viewport
      preferCSSPageSize: false,
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
