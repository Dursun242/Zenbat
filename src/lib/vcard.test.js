import { describe, it, expect } from "vitest";
import { buildVCard } from "./vcard.js";

describe("buildVCard", () => {
  it("encadre la carte avec BEGIN/END et VERSION 3.0", () => {
    const v = buildVCard({ nom: "Dupont", prenom: "Jean" });
    expect(v.startsWith("BEGIN:VCARD\r\nVERSION:3.0")).toBe(true);
    expect(v.trimEnd().endsWith("END:VCARD")).toBe(true);
  });

  it("compose N et FN pour un particulier", () => {
    const v = buildVCard({ nom: "Dupont", prenom: "Jean" });
    expect(v).toContain("N:Dupont;Jean;;;");
    expect(v).toContain("FN:Jean Dupont");
  });

  it("reporte la raison sociale en N et ORG pour une entreprise", () => {
    const v = buildVCard({ type: "entreprise", raison_sociale: "ACME SARL" });
    expect(v).toContain("N:ACME SARL;;;;");
    expect(v).toContain("FN:ACME SARL");
    expect(v).toContain("ORG:ACME SARL");
  });

  it("inclut téléphones, email et adresse quand présents", () => {
    const v = buildVCard({
      nom: "Martin", prenom: "Lucie",
      telephone: "0612345678", telephone_fixe: "0234567890",
      email: "lucie@exemple.fr",
      adresse: "12 rue des Lilas", ville: "Rouen", code_postal: "76000",
    });
    expect(v).toContain("TEL;TYPE=CELL:0612345678");
    expect(v).toContain("TEL;TYPE=WORK,VOICE:0234567890");
    expect(v).toContain("EMAIL;TYPE=INTERNET:lucie@exemple.fr");
    expect(v).toContain("ADR;TYPE=WORK:;;12 rue des Lilas;Rouen;;76000;France");
  });

  it("omet les lignes des champs vides", () => {
    const v = buildVCard({ nom: "Seul" });
    expect(v).not.toContain("TEL");
    expect(v).not.toContain("EMAIL");
    expect(v).not.toContain("ADR");
    expect(v).not.toContain("NOTE");
  });

  it("regroupe SIRET / TVA / NAF et notes libres dans NOTE", () => {
    const v = buildVCard({
      raison_sociale: "ACME", notes: "Client fidèle",
      siret: "12345678900012", tva_intra: "FR00123456789", naf: "43.32A",
    });
    expect(v).toContain("NOTE:Client fidèle\\nSIRET : 12345678900012 · TVA : FR00123456789 · NAF : 43.32A");
  });

  it("échappe les caractères spéciaux vCard", () => {
    const v = buildVCard({ nom: "Du;pont", prenom: "Jean,Luc", notes: "ligne1\nligne2" });
    expect(v).toContain("N:Du\\;pont;Jean\\,Luc;;;");
    expect(v).toContain("NOTE:ligne1\\nligne2");
  });
});
