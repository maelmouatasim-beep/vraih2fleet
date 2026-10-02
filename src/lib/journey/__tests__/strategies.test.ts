import { describe, expect, it } from "vitest";
import { HYPOTHESES } from "@/lib/tco";
import {
  changementsStrategie,
  construireStrategie,
  construireStrategies,
  estPlanVide,
  libelleStrategieRetenue,
  strategieMeilleureEconomie,
  strategieRetenue,
  type VehiculeProjet,
} from "../strategies";
import { construireClasseurPlan } from "../report";
import { cleGarage } from "../infrastructure";

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
    const site = s.plan!.sitesInfra!.find((x) => x.id === "recharge:__sans_garage__")!;
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
        // 19 + 150 kW demandés − 20 kW présumés = 149 kW supplémentaires → palier 2
        HYPOTHESES.raccordement_palier2.valeur,
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

  describe("1.3 — economies_d_abord compte l'infrastructure du garage AVANT de choisir", () => {
    const petit = (id: string, depot: string, km: number) =>
      vehicule({ id, depot, annual_km: km, target_technology: null });

    it("rentable seul mais pas avec sa borne : reste au diesel, « aucune électrification rentable »", () => {
      // Camionnette à 15 000 km/an achetée en 2027 : économie BEV ≈ 9 200 $ sans
      // infrastructure, inférieure à une borne niveau 2 (15 000 $) → perte une
      // fois la borne comptée.
      const s = construireStrategie([petit("a", "Hôtel de ville", 15000)], "economies_d_abord", OPTIONS);
      expect(s.nbZeroEmission).toBe(0);
      expect(s.infraCapex).toBe(0);
      expect(s.aucuneElectrificationRentable).toBe(true);
      expect(s.selection).toEqual([{ depot: "Hôtel de ville", candidats: 1, retenus: 0, vanAvecInfra: 0 }]);
    });

    it("le palier de raccordement déclenché par le 2e véhicule est compté (choix optimal sur sous-ensembles)", () => {
      // 3 camionnettes identiques au même garage : 1 borne tient dans la
      // capacité présumée, 2 bornes déclenchent le palier 1.
      const flotte = ["a", "b", "c"].map((id) => petit(id, "Garage municipal", 20000));
      const s = construireStrategie(flotte, "economies_d_abord", OPTIONS);
      // Brute force : aucune combinaison ne fait mieux que la sélection.
      let meilleure = 0;
      for (let masque = 1; masque < 8; masque++) {
        const choisis = flotte.filter((_, i) => masque & (1 << i)).map((v) => ({ ...v, target_technology: "bev" }));
        meilleure = Math.max(meilleure, construireStrategie(choisis, "plan_actuel", OPTIONS).resultat!.vanDifferentielle);
      }
      expect(s.resultat!.vanDifferentielle).toBeGreaterThanOrEqual(meilleure - 0.01);
      expect(s.resultat!.vanDifferentielle).toBeGreaterThan(0);
      expect(s.aucuneElectrificationRentable).toBe(false);
      // L'infrastructure de la stratégie est bien celle de la source unique.
      expect(s.infraCapex).toBe(s.infra.totalCapex);
    });

    it("un garage au raccordement prohibitif (devis) reste au diesel, l'autre garage est électrifié", () => {
      const garages = new Map([[cleGarage("Travaux publics"), { devisRaccordement: 1_000_000 }]]);
      const s = construireStrategie(
        [petit("tp", "Travaux publics", 40000), petit("gm", "Garage municipal", 40000)],
        "economies_d_abord",
        { ...OPTIONS, garages },
      );
      const parId = new Map(s.plan!.vehicules.map((v) => [v.id, v.alternative.technologie]));
      expect(parId.get("tp")).toBe("diesel");
      expect(parId.get("gm")).toBe("BEV");
      expect(s.selection!.map((g) => [g.depot, g.retenus])).toEqual([
        ["Garage municipal", 1],
        ["Travaux publics", 0],
      ]);
    });

    it("propriété : la VAN d'« Économies d'abord » n'est jamais négative", () => {
      for (const km of [5000, 8000, 12000, 20000, 40000]) {
        const flotte = [petit("a", "A", km), petit("b", "A", km), petit("c", "B", km / 2)];
        const s = construireStrategie(flotte, "economies_d_abord", OPTIONS);
        expect(s.resultat!.vanDifferentielle).toBeGreaterThanOrEqual(-0.01);
        expect(s.aucuneElectrificationRentable).toBe(s.nbZeroEmission === 0);
      }
    });

    it("« Appliquer au plan » propose exactement la sélection chiffrée", () => {
      const flotte = [petit("a", "A", 8000), petit("b", "B", 40000)];
      const s = construireStrategie(flotte, "economies_d_abord", OPTIONS);
      const bev = s.plan!.vehicules.filter((v) => v.alternative.technologie === "BEV").map((v) => v.id);
      const ch = changementsStrategie(flotte, "economies_d_abord", OPTIONS);
      expect(ch.filter((c) => c.cibleNouvelle === "bev").map((c) => c.vehiculeId)).toEqual(bev);
      expect(bev).toEqual(["b"]);
    });
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
    const site = s.plan!.sitesInfra!.find((x) => x.id === "recharge:__sans_garage__")!;
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
    expect(sites.map((x) => x.id).sort()).toEqual(["h2:__sans_garage__", "recharge:__sans_garage__"]);
    expect(s.resultat!.avertissements.some((a) => a.includes("technologies mixtes"))).toBe(false);
  });

  it("devis client de raccordement : il remplace l'hypothèse du registre dans l'infra", () => {
    const avecDevis = construireStrategie([vehicule()], "plan_actuel", {
      ...OPTIONS,
      surchargesEnergie: { devisRaccordement: 123456 },
    });
    const sansDevis = construireStrategie([vehicule()], "plan_actuel", OPTIONS);
    // Une seule borne niveau 2 tient dans la capacité présumée : 0 $ sans devis.
    expect(sansDevis.infra.raccordement).toBe(0);
    expect(avecDevis.infraCapex - sansDevis.infraCapex).toBe(123456);
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

describe("1.5 — badge « Meilleure économie »", () => {
  it("jamais sur un plan vide ni sur 0 $ ; plan vide détecté", () => {
    const flotte = [vehicule({ id: "a", target_technology: null, annual_km: 5000 })];
    const strategies = construireStrategies(flotte, OPTIONS);
    const planActuel = strategies.find((s) => s.cle === "plan_actuel")!;
    expect(planActuel.resultat!.vanDifferentielle).toBe(0);
    expect(estPlanVide(planActuel)).toBe(true);
    // Économies d'abord vide aussi, mais pour une autre raison (rien de rentable) : pas « plan vide ».
    const eco = strategies.find((s) => s.cle === "economies_d_abord")!;
    expect(eco.aucuneElectrificationRentable).toBe(true);
    expect(estPlanVide(eco)).toBe(false);
    // Tout électrique à 5 000 km/an = surcoût → aucun badge du tout.
    expect(strategies.find((s) => s.cle === "tout_electrique")!.resultat!.vanDifferentielle).toBeLessThan(0);
    expect(strategieMeilleureEconomie(strategies)).toBeNull();
  });

  it("sur la stratégie de VAN maximale, seulement si elle est positive et électrifie", () => {
    const flotte = [
      vehicule({ id: "a", target_technology: null, annual_km: 40000, depot: "A" }),
      vehicule({ id: "b", target_technology: null, annual_km: 3000, depot: "A" }),
    ];
    const strategies = construireStrategies(flotte, OPTIONS);
    const meilleure = strategieMeilleureEconomie(strategies);
    expect(meilleure).not.toBeNull();
    const s = strategies.find((x) => x.cle === meilleure)!;
    expect(s.resultat!.vanDifferentielle).toBeGreaterThan(0);
    expect(s.nbZeroEmission).toBeGreaterThan(0);
    for (const x of strategies) {
      if (x.nbZeroEmission > 0) {
        expect(s.resultat!.vanDifferentielle).toBeGreaterThanOrEqual(x.resultat!.vanDifferentielle);
      }
    }
  });
});

describe("1.6 — stratégie réellement retenue (Plan, PDF, Excel)", () => {
  const flotte = [
    vehicule({ id: "a", target_technology: null, annual_km: 40000, depot: "A" }),
    vehicule({ id: "b", target_technology: null, annual_km: 3000, depot: "A" }),
  ];
  const appliquer = (vs: VehiculeProjet[], cle: "economies_d_abord") => {
    const ch = new Map(changementsStrategie(vs, cle, OPTIONS).map((c) => [c.vehiculeId, c.cibleNouvelle]));
    return vs.map((v) => ({ ...v, target_technology: ch.get(v.id) ?? v.target_technology }));
  };

  it("« Économies d'abord » appliquée : nommée telle quelle (et non « Plan actuel »), Excel compris", () => {
    const plan = appliquer(flotte, "economies_d_abord");
    const r = strategieRetenue(plan, "economies_d_abord", OPTIONS);
    expect(r).toEqual({ cle: "economies_d_abord", ecarts: 0 });
    expect(libelleStrategieRetenue(r, "fr")).toBe("Économies d'abord");
    const s = construireStrategie(plan, "plan_actuel", OPTIONS);
    const [budget] = construireClasseurPlan(s, new Map(), {
      organisation: "Ville",
      projet: "P",
      dateIso: "2026-10-02",
      anneeReference: 2026,
      horizonAns: 10,
      tauxActualisationNominal: 0.05,
      strategieRetenue: r,
    });
    expect(budget.lignes.flat()).toContain("Stratégie retenue : Économies d'abord");
    // Mêmes chiffres que la stratégie chiffrée à l'étape Stratégies.
    expect(s.resultat!.vanDifferentielle).toBeCloseTo(
      construireStrategie(flotte, "economies_d_abord", OPTIONS).resultat!.vanDifferentielle,
      6,
    );
  });

  it("cible modifiée après application : « modifiée depuis son application » ; sans stratégie : choix manuels", () => {
    const plan = appliquer(flotte, "economies_d_abord").map((v) =>
      v.id === "b" ? { ...v, target_technology: "bev" } : v,
    );
    const r = strategieRetenue(plan, "economies_d_abord", OPTIONS);
    expect(r.ecarts).toBe(1);
    expect(libelleStrategieRetenue(r, "fr")).toContain("modifiée depuis son application (1 véhicule(s)");
    expect(strategieRetenue(plan, null, OPTIONS).cle).toBeNull();
    expect(strategieRetenue(plan, "inconnue", OPTIONS).cle).toBeNull();
    expect(libelleStrategieRetenue({ cle: null, ecarts: 0 }, "en")).toContain("vehicle by vehicle");
  });
});
