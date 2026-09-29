import { describe, expect, it } from "vitest";
import { HYPOTHESES } from "@/lib/tco";
import { changementsStrategie, construireStrategie, construireStrategies, type VehiculeProjet } from "../strategies";

const OPTIONS = {
  anneeReference: 2026,
  horizonAns: 10,
  tauxActualisationNominal: 0.05,
  typeOrganisme: "municipalite" as const,
};

function vehicule(patch: Partial<VehiculeProjet> = {}): VehiculeProjet {
  return {
    id: patch.id ?? "v1",
    category: "camionnette",
    fuel_type: "diesel",
    annual_km: 30000,
    consumption_per_100km: 16,
    consumption_source: "saisie",
    usage_profile: "urbain",
    replacement_year: 2027,
    target_technology: "bev",
    ...patch,
  };
}

describe("construireStrategie", () => {
  it("plan_actuel : respecte la technologie cible et l'année de remplacement du véhicule", () => {
    const s = construireStrategie(
      [vehicule({ replacement_year: 2029, target_technology: "bev" })],
      "plan_actuel",
      OPTIONS,
    );
    expect(s.plan!.vehicules[0].anneeAcquisition).toBe(3);
    expect(s.plan!.vehicules[0].alternative.technologie).toBe("BEV");
    expect(s.resultat!.alternative.flux.investissement[3]).toBeGreaterThan(0);
    // rien à l'année 0 : le véhicule ET l'infrastructure arrivent en
    // année 3 (l'infra suit l'arrivée des véhicules, §3.5 v2.0)
    expect(s.resultat!.reference.flux.investissement[0]).toBe(0);
    expect(s.resultat!.alternative.flux.investissement[0]).toBe(0);
    const site = s.plan!.sitesInfra!.find((x) => x.id === "depot-recharge")!;
    expect(site.anneeMiseEnService).toBe(3);
    // le versement des subventions est décalé à l'année d'acquisition
    for (const sub of s.plan!.vehicules[0].subventionsAlternative ?? []) {
      expect(sub.annee).toBeGreaterThanOrEqual(3);
    }
  });

  it("plan_actuel : cible absente ou diesel = statu quo (différentiel nul pour ce véhicule)", () => {
    const s = construireStrategie(
      [vehicule({ target_technology: null })],
      "plan_actuel",
      OPTIONS,
    );
    expect(s.nbZeroEmission).toBe(0);
    expect(s.infraCapex).toBe(0);
    expect(s.resultat!.vanDifferentielle).toBeCloseTo(0, 6);
  });

  it("tout_electrique : BEV partout, bornes par catégorie + raccordement", () => {
    const s = construireStrategie(
      [
        vehicule({ id: "a", category: "camionnette" }),
        vehicule({ id: "b", category: "autobus_urbain_12m" }),
      ],
      "tout_electrique",
      OPTIONS,
    );
    expect(s.nbZeroEmission).toBe(2);
    expect(s.infraCapex).toBe(
      HYPOTHESES.borne_niveau2_installee.valeur +
        HYPOTHESES.borne_rapide_150kw_installee.valeur +
        HYPOTHESES.raccordement_depot.valeur,
    );
  });

  it("economies_d_abord : BEV seulement là où le moteur trouve une économie", () => {
    const flotte = [
      vehicule({ id: "gagnant", category: "camionnette", annual_km: 40000 }),
      // autobus : surcoût BEV attendu avec les défauts du registre (cas 2)
      vehicule({ id: "perdant", category: "autobus_urbain_12m", annual_km: 58000, consumption_per_100km: 45 }),
    ];
    const s = construireStrategie(flotte, "economies_d_abord", OPTIONS);
    const parId = new Map(s.plan!.vehicules.map((v) => [v.id, v]));
    expect(parId.get("gagnant")!.alternative.technologie).toBe("BEV");
    expect(parId.get("perdant")!.alternative.technologie).toBe("diesel");
  });

  it("catégorie « autre » exclue et signalée ; année manquante signalée (année 0)", () => {
    const s = construireStrategie(
      [
        vehicule({ id: "ok" }),
        vehicule({ id: "inconnu", category: "autre" }),
        vehicule({ id: "sans-annee", replacement_year: null }),
      ],
      "plan_actuel",
      OPTIONS,
    );
    expect(s.exclusions).toEqual(["inconnu"]);
    expect(s.sansAnnee).toEqual(["sans-annee"]);
    expect(s.nbVehicules).toBe(2);
  });

  it("achat prévu après la fin d'un programme : la subvention échue n'est pas comptée", () => {
    // Roulez vert (vehicule_leger, fin 2026-12-31) compté en 2026, pas en 2030.
    const cible = vehicule({ id: "vl", category: "vehicule_leger", target_technology: "bev" });
    const en2026 = construireStrategie([{ ...cible, replacement_year: 2026 }], "plan_actuel", OPTIONS);
    const en2030 = construireStrategie([{ ...cible, replacement_year: 2030 }], "plan_actuel", OPTIONS);
    const libelles = (s: typeof en2026) =>
      (s.plan!.vehicules[0].subventionsAlternative ?? []).map((x) => x.libelle).join(" | ");
    expect(libelles(en2026)).toContain("Roulez vert");
    expect(libelles(en2030)).not.toContain("Roulez vert");
    expect(en2030.subventionsTotal).toBeLessThan(en2026.subventionsTotal);
  });

  it("remplacement APRÈS l'horizon : véhicule exclu du plan et des totaux, signalé sans identifiant technique (revue A5)", () => {
    const s = construireStrategie(
      [vehicule({ id: "ok" }), vehicule({ id: "tard", replacement_year: 2040 })],
      "plan_actuel",
      OPTIONS,
    );
    expect(s.horsHorizon).toEqual([{ id: "tard", anneeRemplacement: 2040 }]);
    expect(s.plan!.vehicules.map((v) => v.id)).toEqual(["ok"]);
    expect(s.nbVehicules).toBe(1);
    // le moteur ne reçoit jamais ce véhicule : aucun avertissement avec
    // son identifiant technique à l'écran ni au PDF
    expect(s.resultat!.avertissements.some((a) => a.includes("tard"))).toBe(false);
    // mêmes totaux que si le véhicule n'existait pas
    const sans = construireStrategie([vehicule({ id: "ok" })], "plan_actuel", OPTIONS);
    expect(s.resultat!.vanDifferentielle).toBeCloseTo(sans.resultat!.vanDifferentielle, 6);
  });

  it("l'infrastructure est mise en service à l'année d'arrivée des premiers véhicules", () => {
    const s = construireStrategie(
      [
        vehicule({ id: "a", replacement_year: 2029 }),
        vehicule({ id: "b", replacement_year: 2031 }),
      ],
      "plan_actuel",
      OPTIONS,
    );
    const site = s.plan!.sitesInfra!.find((x) => x.id === "depot-recharge")!;
    expect(site.anneeMiseEnService).toBe(3); // 2029 − 2026
    // aucun investissement d'infrastructure à l'année 0
    expect(s.resultat!.alternative.flux.investissement[0]).toBe(0);
    expect(s.resultat!.alternative.flux.investissement[3]).toBeGreaterThan(0);
  });

  it("FCEV : site H2 distinct du site de recharge (répartitions homogènes)", () => {
    const s = construireStrategie(
      [
        vehicule({ id: "b1", target_technology: "bev" }),
        vehicule({ id: "h1", target_technology: "fcev" }),
      ],
      "plan_actuel",
      OPTIONS,
    );
    const sites = s.plan!.sitesInfra!;
    expect(sites.map((x) => x.id).sort()).toEqual(["depot-h2", "depot-recharge"]);
    expect(s.resultat!.avertissements.some((a) => a.includes("technologies mixtes"))).toBe(false);
  });

  it("devis client de raccordement : il remplace l'hypothèse du registre dans l'infra", () => {
    const avecDevis = construireStrategie([vehicule()], "plan_actuel", {
      ...OPTIONS,
      surchargesEnergie: { devisRaccordement: 123456 },
    });
    const sansDevis = construireStrategie([vehicule()], "plan_actuel", OPTIONS);
    expect(avecDevis.infraCapex - sansDevis.infraCapex).toBe(
      123456 - HYPOTHESES.raccordement_depot.valeur,
    );
  });

  it("prix client du diesel : il change le TCO de la référence (donnée client prioritaire)", () => {
    const client = construireStrategie([vehicule()], "plan_actuel", {
      ...OPTIONS,
      surchargesEnergie: { dieselParL: 3.0 },
    });
    const defaut = construireStrategie([vehicule()], "plan_actuel", OPTIONS);
    expect(client.resultat!.reference.tcoActualise).toBeGreaterThan(
      defaut.resultat!.reference.tcoActualise,
    );
  });

  it("construireStrategies renvoie les trois stratégies", () => {
    const tout = construireStrategies([vehicule()], OPTIONS);
    expect(tout.map((s) => s.cle)).toEqual(["plan_actuel", "tout_electrique", "economies_d_abord"]);
    for (const s of tout) expect(s.resultat).not.toBeNull();
  });

  it("aucun véhicule évaluable : résultat null, rien n'explose", () => {
    const s = construireStrategie([vehicule({ category: "autre" })], "plan_actuel", OPTIONS);
    expect(s.resultat).toBeNull();
    expect(s.nbVehicules).toBe(0);
  });
});

describe("changementsStrategie (C3 — appliquer la stratégie au plan)", () => {
  it("tout_electrique : les cibles non-BEV deviennent BEV, les BEV existants ne changent pas", () => {
    const changements = changementsStrategie(
      [
        vehicule({ id: "a", target_technology: "bev" }),
        vehicule({ id: "b", target_technology: null }),
        vehicule({ id: "c", target_technology: "fcev" }),
      ],
      "tout_electrique",
      OPTIONS,
    );
    expect(changements.map((c) => c.vehiculeId).sort()).toEqual(["b", "c"]);
    for (const c of changements) expect(c.cibleNouvelle).toBe("bev");
    expect(changements.find((c) => c.vehiculeId === "b")!.cibleActuelle).toBeNull();
  });

  it("plan_actuel : une cible absente devient explicitement « diesel » (statu quo enregistré)", () => {
    const changements = changementsStrategie(
      [vehicule({ id: "a", target_technology: null })],
      "plan_actuel",
      OPTIONS,
    );
    expect(changements).toEqual([
      { vehiculeId: "a", cibleActuelle: null, cibleNouvelle: "diesel" },
    ]);
  });

  it("ne touche JAMAIS les véhicules de catégorie inconnue ni ceux hors horizon", () => {
    const changements = changementsStrategie(
      [
        vehicule({ id: "autre", category: "autre", target_technology: null }),
        vehicule({ id: "tard", replacement_year: 2045, target_technology: null }),
        vehicule({ id: "ok", target_technology: null }),
      ],
      "tout_electrique",
      OPTIONS,
    );
    expect(changements.map((c) => c.vehiculeId)).toEqual(["ok"]);
  });

  it("economies_d_abord suit le verdict du moteur : la cible proposée reste cohérente avec la stratégie construite", () => {
    const v = vehicule({ id: "eco", target_technology: null });
    const changements = changementsStrategie([v], "economies_d_abord", OPTIONS);
    const s = construireStrategie([v], "economies_d_abord", OPTIONS);
    const technoPlan = s.plan!.vehicules[0].alternative.technologie;
    const attendue = technoPlan === "BEV" ? "bev" : technoPlan === "FCEV" ? "fcev" : "diesel";
    if (attendue === "diesel") {
      expect(changements).toEqual([{ vehiculeId: "eco", cibleActuelle: null, cibleNouvelle: "diesel" }]);
    } else {
      expect(changements[0]?.cibleNouvelle).toBe(attendue);
    }
  });
});
