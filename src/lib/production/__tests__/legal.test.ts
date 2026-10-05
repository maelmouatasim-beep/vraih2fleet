/** Point 6 — brouillons juridiques et politique de confidentialité à jour. */
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

const racine = resolve(__dirname, "../../../..");
const dossier = resolve(racine, "docs/legal");
const docs = readdirSync(dossier).filter((f) => f.endsWith(".md"));
const lire = (f: string) => readFileSync(resolve(dossier, f), "utf8");
const MENTION = /BROUILLONS? À FAIRE VALIDER PAR UN JURISTE/;

describe("brouillons juridiques (docs/legal)", () => {
  it("les trois documents demandés existent", () => {
    expect(docs).toEqual(expect.arrayContaining(["efvp-ia-anthropic.md", "entente-pilote-municipalite.md", "entente-traitement-donnees.md"]));
  });

  it.each(docs)("%s : marqué brouillon en tête (et en pied pour les modèles)", (f) => {
    const s = lire(f);
    expect(s.split("\n").slice(0, 3).join("\n")).toMatch(MENTION);
    if (f !== "README.md") expect(s.trim().split("\n").slice(-1)[0]).toMatch(MENTION);
  });

  it.each(docs)("%s : aucune adresse courriel réelle, placeholders à compléter", (f) => {
    const s = lire(f);
    expect(s).not.toMatch(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[a-z]{2,}/);
    if (f !== "README.md") expect(s).toContain("[Nom légal de l'exploitant — à confirmer]");
  });

  it("entente de pilote : périmètre, données, confidentialité, limites de responsabilité, durée, prix", () => {
    const s = lire("entente-pilote-municipalite.md");
    for (const titre of ["## 2. Périmètre", "## 6. Données", "## 7. Confidentialité", "## 10. Limites de responsabilité", "## 4. Durée", "## 5. Prix"]) {
      expect(s).toContain(titre);
    }
  });

  it("sous-traitants de l'entente = services réellement utilisés par le code", () => {
    const s = lire("entente-traitement-donnees.md");
    for (const nom of ["Supabase", "Cloudflare", "GitHub", "SendGrid", "Anthropic"]) expect(s).toContain(nom);
    // le code appelle bien ces services
    expect(readFileSync(resolve(racine, "supabase/functions/send-email/index.ts"), "utf8")).toContain("api.sendgrid.com");
    expect(readFileSync(resolve(racine, ".github/workflows/recalcul-alertes.yml"), "utf8")).toContain("recalcul-alertes.mjs");
  });

  it("EFVP : les quatre fonctions d'IA décrites, désactivées par défaut", () => {
    const s = lire("efvp-ia-anthropic.md");
    for (const f of ["Copilote de projet", "Import intelligent", "Lecture de factures", "Note au conseil"]) expect(s).toContain(f);
    expect(s).toMatch(/Désactivées par défaut/);
  });
});

describe("politique de confidentialité alignée sur le produit", () => {
  for (const lang of ["fr", "en"]) {
    it(`${lang} : Cloudflare et GitHub déclarés, identifiants télématiques chiffrés`, () => {
      const d = JSON.parse(readFileSync(resolve(racine, `src/i18n/locales/${lang}/translation.json`), "utf8"));
      const texte = JSON.stringify(d.legal.privacy);
      expect(texte).toContain("Cloudflare");
      expect(texte).toContain("GitHub");
      expect(texte).toContain("AES-256");
      expect(texte).not.toMatch(/en cours de mise en place|being implemented|served by GitHub Pages|servi par GitHub Pages/);
    });
  }
});
