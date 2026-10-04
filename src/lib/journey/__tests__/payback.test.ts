import { describe, expect, it } from "vitest";
import { texteRecuperation } from "../payback";

describe("texteRecuperation (PDF, Excel)", () => {
  it("années, ou « jamais » avec la raison — jamais « 0 an » sur un surcoût", () => {
    expect(texteRecuperation({ annees: 4, raison: null, code: null }, 10)).toBe("4 ans");
    expect(texteRecuperation({ annees: 4, raison: null, code: null }, 10, true)).toBe("4 yrs");
    expect(texteRecuperation({ annees: null, raison: "x", code: "surcout_non_resorbe" }, 10)).toBe(
      "jamais (le surcoût n'est pas résorbé sur l'horizon de 10 ans)",
    );
    expect(texteRecuperation({ annees: null, raison: "x", code: "economies_negatives" }, 12, true)).toBe(
      "never (annual savings are zero or negative)",
    );
  });

  it("aucun écart (aucun véhicule retenu) : « — » avec la raison, jamais « 0 an »", () => {
    expect(texteRecuperation({ annees: null, raison: "x", code: "aucun_ecart" }, 10)).toBe(
      "— (aucun véhicule ne change de technologie : rien à récupérer)",
    );
    expect(texteRecuperation({ annees: null, raison: "x", code: "aucun_ecart" }, 10, true)).toBe(
      "— (no vehicle changes technology: nothing to recover)",
    );
  });
});
