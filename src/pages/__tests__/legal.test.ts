import { describe, expect, it } from "vitest";
import fr from "@/i18n/locales/fr/translation.json";
import en from "@/i18n/locales/en/translation.json";

type Section = { title: string; paras: string[]; items?: string[] };
const texte = (l: typeof fr, doc: "terms" | "privacy" | "refund") =>
  (l.legal[doc].sections as Section[]).flatMap((s) => [s.title, ...s.paras, ...(s.items ?? [])]).join("\n");

describe("pages légales (Phase 4)", () => {
  for (const doc of ["terms", "privacy", "refund"] as const) {
    it(`${doc} : fr et en ont la même structure, aucune société, loi étrangère ou promesse inventée`, () => {
      expect(fr.legal[doc].sections.length).toBe(en.legal[doc].sections.length);
      for (const l of [fr, en]) {
        const t = texte(l, doc);
        expect(t).not.toMatch(/H2Fleet Technologies|Ontario|Toronto|14[- ](jours|day)|Stripe|ACH|SLA garanti|72 heures|72 hours/);
        expect(t).toMatch(/\[[^\]]*(confirmer|confirmed)[^\]]*\]/); // nom légal / éléments à confirmer, jamais inventés
      }
    });
  }

  it("confidentialité : Loi 25, responsable, droits et Commission d'accès à l'information", () => {
    const t = texte(fr, "privacy");
    expect(t).toContain("Loi 25");
    expect(t).toMatch(/responsable de la protection des renseignements personnels/);
    expect(t).toMatch(/portabilit/);
    expect(t).toContain("Commission d'accès à l'information");
    expect(t).toMatch(/évaluation des facteurs relatifs à la vie privée/);
  });

  it("conditions : droit du Québec et primauté de la version française", () => {
    expect(texte(fr, "terms")).toMatch(/lois du Québec/);
    expect(texte(fr, "terms")).toMatch(/version française .* prévaut/);
    expect(texte(en, "terms")).toMatch(/laws of Québec/);
  });

  it("bandeau « à faire valider par un juriste » présent dans les deux langues", () => {
    expect(fr.legal.draftBanner).toMatch(/juriste/);
    expect(en.legal.draftBanner).toMatch(/lawyer/);
  });
});
