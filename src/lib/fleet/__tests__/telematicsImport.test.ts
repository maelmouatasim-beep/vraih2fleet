import { describe, expect, it } from "vitest";
import { planifierImportTelematique, type VehiculeFlotte, type VehiculeTelematique } from "../telematicsImport";

const ORG = "org-1";

function tv(patch: Partial<VehiculeTelematique> = {}): VehiculeTelematique {
  return {
    id: patch.id ?? "t1",
    external_id: "EXT-1",
    vin: null,
    make: "Ford",
    model: "E-Transit",
    model_year: 2023,
    vehicle_type: "Light Van",
    annual_km: 28000,
    has_real_odometer: true,
    fuel_consumption: 14.2,
    consumption_source: "telematique",
    ...patch,
  };
}

function veh(patch: Partial<VehiculeFlotte> = {}): VehiculeFlotte {
  return {
    id: patch.id ?? "v1",
    unit_number: "U-1",
    vin: null,
    make: null,
    model: null,
    model_year: null,
    telematics_vehicle_id: null,
    ...patch,
  };
}

describe("import télématique → Ma flotte (D5)", () => {
  it("rapproche par NIV (insensible à la casse/espaces) et complète SANS écraser le client", () => {
    const plan = planifierImportTelematique(
      [tv({ vin: "1ftbw 3xm5 nka12345" })],
      [veh({ vin: "1FTBW3XM5NKA12345", make: "Ford du client" })],
      ORG,
      null,
    );
    expect(plan.misesAJour).toHaveLength(1);
    const m = plan.misesAJour[0];
    expect(m.par).toBe("vin");
    expect(m.patch.telematics_vehicle_id).toBe("t1");
    expect(m.patch.make).toBeUndefined(); // marque du client conservée
    expect(m.patch.model).toBe("E-Transit"); // champ vide complété
    expect(m.patch.annual_km).toBe(28000);
    expect(m.patch.consumption_per_100km).toBe(14.2);
    expect(m.patch.consumption_source).toBe("telematique");
  });

  it("lien existant prioritaire, puis numéro d'unité = identifiant fournisseur", () => {
    const plan = planifierImportTelematique(
      [tv({ id: "t1", external_id: "X" }), tv({ id: "t2", external_id: "U-2", vin: null })],
      [veh({ id: "v1", unit_number: "U-1", telematics_vehicle_id: "t1" }), veh({ id: "v2", unit_number: "U-2" })],
      ORG,
      null,
    );
    expect(plan.misesAJour.map((m) => [m.vehicleId, m.par])).toEqual([
      ["v1", "lien"],
      ["v2", "unite"],
    ]);
  });

  it("aucune mesure importée si non réelle : odomètre estimé, conso estimée, ligne à revérifier", () => {
    const plan = planifierImportTelematique(
      [
        tv({ id: "a", vin: "VIN-A", has_real_odometer: false, consumption_source: "estimation" }),
        tv({ id: "b", vin: "VIN-B", consumption_source: "a_reverifier" }),
      ],
      [veh({ id: "va", vin: "VIN-A" }), veh({ id: "vb", unit_number: "U-B", vin: "VIN-B" })],
      ORG,
      null,
    );
    for (const m of plan.misesAJour) {
      expect(m.patch.annual_km).toBeUndefined();
      expect(m.patch.consumption_per_100km).toBeUndefined();
      expect(m.patch.consumption_source).toBeUndefined();
    }
    expect(plan.aReverifier).toBe(1);
  });

  it("dédoublonnage : même NIV deux fois, ou deux lignes vers le même véhicule → ignorées avec raison", () => {
    const plan = planifierImportTelematique(
      [tv({ id: "t1", vin: "VIN-1" }), tv({ id: "t2", vin: "vin-1", external_id: "EXT-2" })],
      [veh({ vin: "VIN-1" })],
      ORG,
      null,
    );
    expect(plan.misesAJour).toHaveLength(1);
    expect(plan.ignores).toEqual([{ telematicsId: "t2", externalId: "EXT-2", raison: "doublon_vin" }]);
  });

  it("création seulement avec un carburant CHOISI ; catégorie du fournisseur ou choisie, sinon ignorée", () => {
    const sansChoix = planifierImportTelematique([tv({ vin: "NEW" })], [], ORG, null);
    expect(sansChoix.creations).toEqual([]);
    expect(sansChoix.ignores[0].raison).toBe("choix_creation_absent");

    const avecChoix = planifierImportTelematique(
      [tv({ id: "t1", vin: "NEW" }), tv({ id: "t2", vin: "NEW2", external_id: "E2", vehicle_type: "Tracteur spécial" })],
      [],
      ORG,
      { fuel_type: "diesel" },
    );
    expect(avecChoix.creations).toHaveLength(1);
    const c = avecChoix.creations[0].vehicule;
    expect(c.category).toBe("camionnette");
    expect(c.fuel_type).toBe("diesel");
    expect(c.unit_number).toBe("EXT-1");
    expect(c.telematics_vehicle_id).toBe("t1");
    expect(avecChoix.ignores).toEqual([{ telematicsId: "t2", externalId: "E2", raison: "categorie_inconnue" }]);
  });

  it("un véhicule déjà lié à une AUTRE ligne télématique n'est pas re-lié", () => {
    const plan = planifierImportTelematique(
      [tv({ id: "t9", vin: "VIN-X" })],
      [veh({ vin: "VIN-X", telematics_vehicle_id: "t1" })],
      ORG,
      null,
    );
    expect(plan.misesAJour).toEqual([]);
    expect(plan.ignores[0].raison).toBe("vehicule_deja_rapproche");
  });
});
