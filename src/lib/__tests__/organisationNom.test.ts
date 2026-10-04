import { describe, expect, it } from "vitest";
import { estNomOrganisationParDefaut, nomOrganisationRapport } from "../organisationNom";

describe("nom de l'organisation sur les rapports (audit acheteur, point 11)", () => {
  it("reconnaît le nom créé par défaut, quelle que soit la casse", () => {
    expect(estNomOrganisationParDefaut("Mon organisation")).toBe(true);
    expect(estNomOrganisationParDefaut("  mon ORGANISATION ")).toBe(true);
    expect(estNomOrganisationParDefaut("My organization")).toBe(true);
    expect(estNomOrganisationParDefaut("")).toBe(true);
    expect(estNomOrganisationParDefaut(null)).toBe(true);
    expect(estNomOrganisationParDefaut("Ville de Sherbrooke")).toBe(false);
  });

  it("jamais « Mon organisation » sur un rapport ; la démo porte le nom de la ville fictive", () => {
    expect(nomOrganisationRapport("Ville de Sherbrooke", false, "fr")).toBe("Ville de Sherbrooke");
    expect(nomOrganisationRapport("Mon organisation", true, "fr")).toBe("Ville de Rivière-Claire (fictive)");
    expect(nomOrganisationRapport("Mon organisation", false, "fr")).not.toMatch(/Mon organisation/);
    expect(nomOrganisationRapport("Ville de Sherbrooke", true, "fr")).toBe("Ville de Sherbrooke");
  });
});
