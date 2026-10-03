import { describe, expect, it } from "vitest";
import { formaterPourcentage, formateurCad, formateurNombre, localeDe } from "../format";

const espaces = (s: string) => s.replace(/[\u00a0\u202f]/g, "␣");

describe("formatage selon la langue", () => {
  it("montant fr-CA : 1 234 567 $ avec espaces insécables, jamais sécables", () => {
    const s = formateurCad("fr").format(1234567);
    expect(espaces(s)).toBe("1␣234␣567␣$");
    expect(s).not.toMatch(/ /);
  });
  it("montant en-CA : $1,234,567", () => {
    expect(formateurCad("en").format(1234567)).toBe("$1,234,567");
  });
  it("nombre selon la langue", () => {
    expect(espaces(formateurNombre("fr").format(12345))).toBe("12␣345");
    expect(formateurNombre("en").format(12345)).toBe("12,345");
    expect(localeDe("fr")).toBe("fr-CA");
    expect(localeDe("en-US")).toBe("en-CA");
  });
  it("pourcentage : espace insécable en français", () => {
    expect(espaces(formaterPourcentage("fr", 0.05))).toBe("5,0␣%");
    expect(formaterPourcentage("en", 0.05)).toBe("5.0%");
  });
});
