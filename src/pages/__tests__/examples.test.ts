import { describe, expect, it } from "vitest";
import fr from "@/i18n/locales/fr/translation.json";
import en from "@/i18n/locales/en/translation.json";
import cas from "../../../docs/tco-cas-de-reference.json";
import { calculerPlan, type PlanTcoEntree } from "@/lib/tco";

describe("exemples illustratifs (Phase 4, ex-« études de cas »)", () => {
  it("chaque cas de référence a un titre fr/en et le moteur retrouve la sortie contre-calculée (±0,01 $)", () => {
    for (const c of cas.cas as unknown as { id: number; entrees: PlanTcoEntree; sorties: { vanDifferentielle: number } }[]) {
      expect(fr.examples.cases).toHaveProperty(`c${c.id}`);
      expect(en.examples.cases).toHaveProperty(`c${c.id}`);
      expect(calculerPlan(c.entrees).vanDifferentielle).toBeCloseTo(c.sorties.vanDifferentielle, 2);
    }
  });

  it("aucune organisation réelle ni « résultat prouvé » : cas déclarés fictifs", () => {
    const tout = JSON.stringify([fr.examples, en.examples]);
    expect(tout).not.toMatch(/STM|Winnipeg|ERA|AZETEC|prouv|proven|vérifiées provenant/);
    expect(fr.examples.disclaimer).toMatch(/FICTIFS/);
    expect(en.examples.disclaimer).toMatch(/FICTIONAL/);
    expect(fr).not.toHaveProperty("caseStudies");
  });
});
