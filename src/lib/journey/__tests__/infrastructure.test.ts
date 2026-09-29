import { describe, expect, it } from "vitest";
import { HYPOTHESES } from "@/lib/tco";
import { dimensionnerDepots, type VehiculeDepot } from "../infrastructure";

function vehicule(patch: Partial<VehiculeDepot> = {}): VehiculeDepot {
  return {
    id: patch.id ?? "v1",
    unit_number: patch.unit_number ?? "U-1",
    category: "camionnette",
    depot: "Garage central",
    replacement_year: 2027,
    target_technology: "bev",
    ...patch,
  };
}

describe("dimensionnerDepots (C6 — recharge par dépôt)", () => {
  it("groupe par dépôt, une borne par véhicule BEV du type de sa catégorie", () => {
    const r = dimensionnerDepots(
      [
        vehicule({ id: "a", unit_number: "A" }),
        vehicule({ id: "b", unit_number: "B", category: "camion_lourd" }),
        vehicule({ id: "c", unit_number: "C", depot: "Garage Est", category: "camion_moyen" }),
        vehicule({ id: "d", unit_number: "D", target_technology: "diesel" }), // ignoré
      ],
      { anneeReference: 2026 },
    );
    expect(r.depots).toHaveLength(2);
    const central = r.depots.find((d) => d.depot === "Garage central")!;
    expect(central.bornes).toEqual({ niveau2: 1, rapide150: 1 });
    expect(central.capexBornes).toBe(
      HYPOTHESES.borne_niveau2_installee.valeur + HYPOTHESES.borne_rapide_150kw_installee.valeur,
    );
    // puissances du registre : niveau 2 en fourchette 7-19, rapide 150 exacte
    expect(central.puissanceMinKw).toBe(7 + 150);
    expect(central.puissanceMaxKw).toBe(19 + 150);
    const est = r.depots.find((d) => d.depot === "Garage Est")!;
    expect(est.bornes).toEqual({ rapide50: 1 });
  });

  it("phasage : bornes ajoutées l'année de remplacement de chaque véhicule, mise en service = première année", () => {
    const r = dimensionnerDepots(
      [
        vehicule({ id: "a", unit_number: "A", replacement_year: 2029 }),
        vehicule({ id: "b", unit_number: "B", replacement_year: 2027 }),
        vehicule({ id: "c", unit_number: "C", replacement_year: null }), // année de référence
      ],
      { anneeReference: 2026 },
    );
    const d = r.depots[0];
    expect(d.anneeMiseEnService).toBe(2026);
    expect(d.phasage.map((p) => p.annee)).toEqual([2026, 2027, 2029]);
    expect(d.phasage[1].unites).toEqual(["B"]);
  });

  it("devis de raccordement client PRIORITAIRE : il remplace les estimations dans le total", () => {
    const vehicules = [vehicule({ id: "a" }), vehicule({ id: "b", depot: "Garage Est" })];
    const sansDevis = dimensionnerDepots(vehicules, { anneeReference: 2026 });
    const avecDevis = dimensionnerDepots(vehicules, { anneeReference: 2026, devisRaccordement: 42000 });
    const capexBornes = sansDevis.depots.reduce((s, d) => s + d.capexBornes, 0);
    expect(sansDevis.totalCapex).toBe(capexBornes + 2 * HYPOTHESES.raccordement_depot.valeur);
    expect(avecDevis.totalCapex).toBe(capexBornes + 42000);
    expect(avecDevis.devisRaccordement).toBe(42000);
  });

  it("FCEV : station H2 du registre au dépôt, catégorie « autre » signalée sans borne inventée", () => {
    const r = dimensionnerDepots(
      [
        vehicule({ id: "a", target_technology: "fcev", replacement_year: 2028 }),
        vehicule({ id: "b", unit_number: "B", category: "autre" }),
      ],
      { anneeReference: 2026 },
    );
    const d = r.depots[0];
    expect(d.nbFcev).toBe(1);
    expect(d.capexStationH2).toBe(HYPOTHESES.station_h2_depot.valeur);
    expect(d.categoriesInconnues).toEqual(["autre"]);
    expect(d.bornes).toEqual({});
    // seul le FCEV (2028) et le « autre » (sans borne) : mise en service = 2028
    expect(d.anneeMiseEnService).toBe(2028);
  });

  it("dépôt absent = groupe « sans dépôt » signalé, jamais mélangé aux autres", () => {
    const r = dimensionnerDepots(
      [vehicule({ id: "a", depot: null }), vehicule({ id: "b", depot: "  " })],
      { anneeReference: 2026 },
    );
    expect(r.depots).toHaveLength(1);
    expect(r.depots[0].depot).toBeNull();
    expect(r.depots[0].nbBev).toBe(2);
  });
});
