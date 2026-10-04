import { describe, expect, it } from "vitest";
import { formaterValeurHypothese, libelleUnite, valeurCelluleHypothese } from "../hypotheseAffichage";

const esp = (s: string) => s.replace(/[  ]/g, " ");

describe("affichage des hypothèses (audit acheteur, point 10)", () => {
  it("montants avec séparateur de milliers, fractions en %, unités traduites", () => {
    expect(esp(formaterValeurHypothese(15000, "$", "fr"))).toBe("15 000");
    expect(formaterValeurHypothese(3500000, "$", "en")).toBe("3,500,000");
    expect(esp(formaterValeurHypothese(0.03, "ratio", "fr"))).toBe("3");
    expect(formaterValeurHypothese(0.125, "ratio", "en")).toBe("12.5");
    expect(formaterValeurHypothese(1.8179, "$/L", "fr")).toBe("1,8179");
    expect(libelleUnite("ratio", "fr")).toBe("%");
    expect(libelleUnite("annees", "fr")).toBe("ans");
    expect(libelleUnite("annees", "en")).toBe("years");
    expect(libelleUnite("$/kWh", "en")).toBe("$/kWh");
  });

  it("cellules Excel : pourcentage arrondi, aucun flottant parasite", () => {
    expect(valeurCelluleHypothese(0.07, "ratio")).toBe(7);
    expect(valeurCelluleHypothese(0.1 + 0.2, "$/L")).toBe(0.3);
  });
});
