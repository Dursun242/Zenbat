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

    // Injecter le HTML et attendre que tout charge
    await page.setContent(html, { waitUntil: "networkidle0" });

    // Générer le PDF
    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
    });

    await browser.close();

    // Retourner le PDF
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error("[generate-pdf] Error:", error);
    res.status(500).json({ error: "Failed to generate PDF", message: error.message });
  }
}
