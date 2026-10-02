import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import fr from "@/i18n/locales/fr/translation.json";
import en from "@/i18n/locales/en/translation.json";

/**
 * Phase 4, point 4.2 : aucune promesse non livrée sur le site (essai
 * gratuit, SSO, marque blanche, délais de réponse garantis, preuve
 * sociale inventée…). Les tarifs (`landing.pricing`) seront refaits à la
 * fin, sur décision de l'utilisateur ; les pages légales sont testées à
 * part (elles NIENT un SLA, ce qui est voulu).
 */
const EXCLUS = ["landing.pricing", "legal"];

const textes = (o: unknown, chemin = ""): [string, string][] => {
  if (EXCLUS.includes(chemin)) return [];
  if (typeof o === "string") return [[chemin, o]];
  if (Array.isArray(o)) return o.flatMap((v, i) => textes(v, `${chemin}[${i}]`));
  if (o && typeof o === "object")
    return Object.entries(o).flatMap(([k, v]) => textes(v, chemin ? `${chemin}.${k}` : k));
  return [];
};

const PROMESSES =
  /essai gratuit de 14|jours gratuits|14-day|24[- ]?(à|-)[- ]?48|\bSSO\b|SAML|marque blanche|white[- ]label|\bACH\b|garantie SLA|SLA guarantee|4 heures|4 hours|essai gratuit|free trial|Rejoignez les (entreprises|gestionnaires)|Join (fleet managers|leading)|partenaires vérifiés|verified partners|Templates pré|Pre-configured templates|Résumés exécutifs automatiques|Réouvert|Reopened|145,5|145\.5/i;

describe("site sans promesses non livrées (Phase 4.2)", () => {
  for (const [langue, dict] of [["fr", fr], ["en", en]] as const) {
    it(`${langue} : aucun texte d'interface ne promet un service inexistant`, () => {
      const fautifs = textes(dict).filter(([, v]) => PROMESSES.test(v)).map(([k, v]) => `${k} : ${v}`);
      expect(fautifs).toEqual([]);
    });
  }

  it("pied de page sans faux liens vers des réseaux sociaux", () => {
    const pied = readFileSync("src/components/landing/Footer.tsx", "utf8");
    expect(pied).not.toMatch(/twitter\.com|x\.com\/|linkedin\.com|github\.com|facebook\.com/i);
  });

  it("index.html sans compte Twitter ni image Lovable", () => {
    const html = readFileSync("index.html", "utf8");
    expect(html).not.toMatch(/twitter:site|lovable\.dev/);
  });

  it("ancienne page Support (délais garantis) redirigée vers l'Aide", () => {
    const app = readFileSync("src/App.tsx", "utf8");
    expect(app).toMatch(/path="\/dashboard\/support" element=\{<Navigate to="\/dashboard\/help"/);
    expect(app).not.toMatch(/pages\/Support"/);
  });
});
