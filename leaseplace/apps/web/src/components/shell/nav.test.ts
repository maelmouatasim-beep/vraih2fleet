import { describe, expect, it } from "vitest";
import { NAV, navCurrent } from "./nav";

describe("navCurrent", () => {
  it("marque la page exacte", () => {
    expect(navCurrent("/entreprise/demandes", "/entreprise/demandes")).toBe("page");
  });
  it("garde la rubrique active sur une sous-page", () => {
    expect(navCurrent("/entreprise/demandes/0193", "/entreprise/demandes")).toBe("true");
  });
  it("n'active pas l'accueil d'espace sur ses sous-pages", () => {
    expect(navCurrent("/entreprise/demandes", "/entreprise")).toBeUndefined();
  });
  it("ne confond pas deux préfixes voisins", () => {
    expect(navCurrent("/entreprise/demandes-x", "/entreprise/demandes")).toBeUndefined();
  });
});

describe("NAV", () => {
  it("l'espace entreprise ouvre demandes, coffre-fort, profil et messages", () => {
    const hrefs = NAV.company.map((i) => i.href).filter(Boolean);
    expect(hrefs).toEqual([
      "/entreprise",
      "/entreprise/demandes",
      "/entreprise/coffre-fort",
      "/entreprise/profil",
      "/entreprise/messages",
    ]);
  });
  it("l'espace bailleur ouvre le pipeline ; la facturation reste en phase 8", () => {
    expect(NAV.lessor.find((i) => i.key === "pipeline")?.href).toBe("/bailleur/pipeline");
    expect(NAV.lessor.find((i) => i.key === "billing")?.phase).toBe(8);
  });
});
