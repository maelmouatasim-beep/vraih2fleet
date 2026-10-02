import { describe, expect, it } from "vitest";
import { caracteristiquesGarages, garagesACreer, heuresFenetre, type GarageRow } from "../garagesModel";
import { planifierInfrastructure } from "@/lib/journey/infrastructure";
import { validerLignes } from "../importVehicles";

const garage = (patch: Partial<GarageRow>): GarageRow => ({
  id: "g",
  organization_id: "o",
  name: "Garage municipal",
  address: null,
  available_power_kw: null,
  hq_rate: null,
  return_time: null,
  departure_time: null,
  parking_spots: null,
  grid_connection_quote: null,
  grid_quote_document_id: null,
  charger_unit_quote: null,
  charger_quote_document_id: null,
  notes: null,
  created_at: "",
  updated_at: "",
  ...patch,
});

describe("garages (bloc 2.1)", () => {
  it("import : garages à créer dédoublonnés (casse et espaces ignorés), existants exclus", () => {
    expect(
      garagesACreer(["Hôtel de ville", "hôtel  de ville", "Travaux publics", null, " ", "Garage municipal"], [
        { name: "Garage Municipal" },
      ]),
    ).toEqual(["Hôtel de ville", "Travaux publics"]);
  });

  it("la colonne « garage » de l'import alimente le dépôt du véhicule", () => {
    const r = validerLignes(
      [{ unite: "U-1", categorie: "camionnette", carburant: "diesel", garage: "Travaux publics" }],
      "org",
      new Map(),
    );
    expect(r.valides[0].depot).toBe("Travaux publics");
  });

  it("la puissance disponible et le devis du garage pilotent le raccordement calculé", () => {
    const g = caracteristiquesGarages([
      garage({ name: "Garage municipal", available_power_kw: 200 }),
      garage({ id: "h", name: "Travaux publics", grid_connection_quote: 42000 }),
    ]);
    const p = planifierInfrastructure(
      [
        { id: "a", category: "camion_moyen", depot: "garage  MUNICIPAL", technologie: "BEV", anneeAcquisition: 0 },
        { id: "b", category: "camion_moyen", depot: "Travaux publics", technologie: "BEV", anneeAcquisition: 0 },
      ],
      { anneeReference: 2026, garages: g },
    );
    const [gm, tp] = p.garages;
    expect(gm.raccordement).toMatchObject({ kwDisponibles: 200, kwDisponiblesSource: "garage", cout: 0 });
    expect(tp.raccordement).toMatchObject({ source: "devis_garage", cout: 42000 });
  });

  it("fenêtre de recharge : durée à cheval sur minuit", () => {
    expect(heuresFenetre("17:00:00", "07:00:00")).toBe(14);
    expect(heuresFenetre("22:30", "06:00")).toBe(7.5);
    expect(heuresFenetre(null, "06:00")).toBeNull();
  });
});
