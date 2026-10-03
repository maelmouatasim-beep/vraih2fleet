import { describe, expect, it } from "vitest";
import { ton, TON_GRAVITE, TON_PROGRAMME, TON_SANTE, TON_SOURCE, TON_VEHICULE, TON_VERDICT, TON_VERIFICATION } from "../tons";

const TABLES = { TON_GRAVITE, TON_PROGRAMME, TON_SANTE, TON_SOURCE, TON_VEHICULE, TON_VERDICT, TON_VERIFICATION };

describe("tons des pastilles d'état", () => {
  it("un même état a la même couleur dans toutes les tables", () => {
    const vus = new Map<string, string>();
    for (const [nom, table] of Object.entries(TABLES)) {
      for (const [cle, valeur] of Object.entries(table)) {
        const deja = vus.get(cle);
        if (deja) expect(`${nom}.${cle}=${valeur}`).toBe(`${nom}.${cle}=${deja}`);
        vus.set(cle, valeur);
      }
    }
  });

  it("les sens sont ordonnés : favorable vert, à surveiller ambre, à risque rouge", () => {
    expect([TON_SANTE.bon, TON_SANTE.a_surveiller, TON_SANTE.a_risque]).toEqual(["succes", "attention", "danger"]);
    expect([TON_VERDICT.favorable, TON_VERDICT.conditionnel, TON_VERDICT.defavorable]).toEqual(["succes", "attention", "danger"]);
    expect(TON_VERIFICATION.a_valider).toBe("attention");
    expect(TON_SOURCE.estimation).toBe(TON_VERIFICATION.estimation);
  });

  it("une clé inconnue retombe sur le ton neutre", () => {
    expect(ton(TON_VEHICULE, "vendu")).toBe("neutre");
    expect(ton(TON_VEHICULE, null)).toBe("neutre");
    expect(ton(TON_PROGRAMME, "actif")).toBe("succes");
  });
});
