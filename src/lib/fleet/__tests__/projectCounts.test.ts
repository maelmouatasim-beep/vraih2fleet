import { describe, expect, it } from "vitest";
import { compterVehiculesParProjet } from "../projectCounts";
import fr from "@/i18n/locales/fr/translation.json";
import en from "@/i18n/locales/en/translation.json";

describe("point 4 — nombre de véhicules sur la carte du projet", () => {
  it("compte les véhicules RÉELLEMENT inclus dans chaque projet (plus de « 0 véhicules » codé en dur)", () => {
    const lignes = [
      ...Array.from({ length: 40 }, () => ({ project_id: "demo" })),
      { project_id: "p2" },
      { project_id: "p2" },
    ];
    const m = compterVehiculesParProjet(lignes);
    expect(m.get("demo")).toBe(40);
    expect(m.get("p2")).toBe(2);
    expect(m.get("vide") ?? 0).toBe(0);
  });

  it("libellé accordé (1 véhicule / 40 véhicules) dans les deux langues", () => {
    expect(fr.pages.projects.card.vehicleCount_one).toBe("{{count}} véhicule");
    expect(fr.pages.projects.card.vehicleCount_other).toBe("{{count}} véhicules");
    expect(en.pages.projects.card.vehicleCount_other).toBe("{{count}} vehicles");
  });
});
