import { describe, expect, it } from "vitest";
import {
  ANCIENNE_CLE_LANGUE,
  CLE_CHOIX_LANGUE,
  langueCourte,
  langueHtml,
  memoriserChoixLangue,
  migrerPreferenceLangue,
  type StockageSimple,
} from "../preference";

function stockage(initial: Record<string, string> = {}): StockageSimple & { donnees: Record<string, string> } {
  const donnees = { ...initial };
  return {
    donnees,
    getItem: (c) => (c in donnees ? donnees[c] : null),
    setItem: (c, v) => {
      donnees[c] = v;
    },
    removeItem: (c) => {
      delete donnees[c];
    },
  };
}

describe("préférence de langue (E3)", () => {
  it("un ancien « en » auto-mémorisé est purgé : la détection reprend", () => {
    const s = stockage({ [ANCIENNE_CLE_LANGUE]: "en" });
    migrerPreferenceLangue(s);
    expect(s.donnees).toEqual({});
  });

  it("un CHOIX explicite est conservé par la migration et relu", () => {
    const s = stockage({ [CLE_CHOIX_LANGUE]: "en" });
    migrerPreferenceLangue(s);
    expect(s.donnees[CLE_CHOIX_LANGUE]).toBe("en");
    memoriserChoixLangue(s, "fr");
    expect(s.donnees[CLE_CHOIX_LANGUE]).toBe("fr");
  });

  it("stockage indisponible ou en erreur : aucune exception", () => {
    const casse: StockageSimple = {
      getItem: () => {
        throw new Error("bloqué");
      },
      setItem: () => {
        throw new Error("bloqué");
      },
      removeItem: () => {
        throw new Error("bloqué");
      },
    };
    expect(() => migrerPreferenceLangue(casse)).not.toThrow();
    expect(() => memoriserChoixLangue(casse, "en")).not.toThrow();
    expect(() => migrerPreferenceLangue(null)).not.toThrow();
  });

  it("fr-CA est reconnu comme français (le sélecteur affichait « English »)", () => {
    expect(langueCourte("fr-CA")).toBe("fr");
    expect(langueCourte("en-US")).toBe("en");
    expect(langueCourte(undefined)).toBe("fr");
    expect(langueHtml("fr")).toBe("fr-CA");
    expect(langueHtml("en")).toBe("en-CA");
  });
});
