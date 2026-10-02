import { describe, expect, it } from "vitest";
import { analyserSensibilite, calculerPlan, empreinte, PROGRAMMES } from "@/lib/tco";
import { construireStrategie, type VehiculeProjet } from "../strategies";
import { cleGarage } from "../infrastructure";
import { santeDuPlan, surveillerPlan, type EntreeSurveillance } from "../surveillance";

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

function entree({
  vehicules: liste,
  ...patch
}: Partial<Omit<EntreeSurveillance, "vehicules">> & { vehicules?: VehiculeProjet[] } = {}): EntreeSurveillance {
  const vehicules = liste ?? [vehicule()];
  const strategie = patch.strategie ?? construireStrategie(vehicules, "plan_actuel", OPTIONS);
  return {
    aujourdHui: "2026-10-02",
    strategie,
    vehicules: vehicules.map((v) => ({ id: v.id, unite: v.id.toUpperCase(), anneeRemplacement: v.replacement_year ?? null, realise: false })),
    dernierRapport: null,
    evenements: [],
    demandes: [],
    ...patch,
  };
}

describe("surveillerPlan", () => {
  it("plan cohérent, sans rapport ni événement : aucune alerte, santé bonne", () => {
    const alertes = surveillerPlan(entree());
    expect(alertes).toEqual([]);
    expect(santeDuPlan(alertes).niveau).toBe("bon");
  });

  it("prix du diesel en baisse de 15 % depuis le rapport : stress test RELANCÉ par le moteur, verdict sur 3 scénarios", () => {
    const base = entree();
    const prix = base.strategie.plan!.parametres.prixAnnee0;
    const avant = { dieselParL: prix.dieselParL / 0.85, electriciteEffectiveParKwh: prix.electriciteEffectiveParKwh, h2LivreParKg: prix.h2LivreParKg };
    const alertes = surveillerPlan({ ...base, dernierRapport: { id: "snap-1", date: "2026-09-28T10:00:00Z", prix: avant, van: 50_000 } });
    expect(alertes).toHaveLength(1);
    const a = alertes[0];
    expect(a.type).toBe("donnees_energie");
    if (a.detail.type !== "donnees_energie") throw new Error();
    expect(a.detail.variations).toEqual([{ energie: "diesel", avant: avant.dieselParL, apres: prix.dieselParL, pct: -15 }]);
    // le verdict vient du VRAI stress test sur le plan courant
    const sens = analyserSensibilite(base.strategie.plan!);
    const attendus = [sens.scenarios.prudent.van, sens.scenarios.central.van, sens.scenarios.favorable.van].filter((v) => v > 0).length;
    expect(a.detail.gagnants).toBe(attendus);
    expect(a.detail.vanActuelle).toBe(base.strategie.resultat!.vanDifferentielle);
    // effet du prix SEUL : le même plan recalculé avec le prix du rapport
    const plan = base.strategie.plan!;
    const vanAvant = calculerPlan({ ...plan, parametres: { ...plan.parametres, prixAnnee0: { ...plan.parametres.prixAnnee0, dieselParL: avant.dieselParL } } }).vanDifferentielle;
    expect(a.detail.vanAnciensPrix).toBeCloseTo(vanAvant, 6);
    expect(a.detail.vanAnciensPrix).toBeGreaterThan(a.detail.vanActuelle);
    expect(a.detail.dateRapport).toBe("2026-09-28");
    expect(a.cle).toBe("energie:snap-1:diesel-15");
    const attendue = a.detail.vanAnciensPrix > 0 && a.detail.vanActuelle <= 0 ? "critique" : attendus < 3 ? "attention" : "info";
    expect(a.gravite).toBe(attendue);
  });

  it("plan modifié depuis le rapport : détecté par l'empreinte (paramètres du snapshot, après aller-retour JSON)", () => {
    const base = entree();
    const plan = base.strategie.plan!;
    const parametresRapport = JSON.parse(JSON.stringify({ ...plan.parametres, prixAnnee0: { ...plan.parametres.prixAnnee0, dieselParL: plan.parametres.prixAnnee0.dieselParL * 1.3 } }));
    const prix = { dieselParL: parametresRapport.prixAnnee0.dieselParL, electriciteEffectiveParKwh: plan.parametres.prixAnnee0.electriciteEffectiveParKwh, h2LivreParKg: plan.parametres.prixAnnee0.h2LivreParKg };
    const rapport = (vehicules: typeof plan.vehicules) => ({
      id: "s",
      date: "2026-09-28",
      prix,
      van: 10_000,
      empreinte: empreinte({ ...plan, vehicules, parametres: parametresRapport }),
      parametres: parametresRapport,
    });
    const meme = surveillerPlan({ ...base, dernierRapport: rapport(plan.vehicules) })[0];
    if (meme.detail.type !== "donnees_energie") throw new Error();
    expect(meme.detail.planModifie).toBe(false);
    const autre = surveillerPlan({ ...base, dernierRapport: rapport(plan.vehicules.map((v) => ({ ...v, kmParAn: (v.kmParAn ?? 0) + 1 }))) })[0];
    if (autre.detail.type !== "donnees_energie") throw new Error();
    expect(autre.detail.planModifie).toBe(true);
  });

  it("variation sous 5 % ou énergie non utilisée par le plan : aucune alerte", () => {
    const base = entree();
    const prix = base.strategie.plan!.parametres.prixAnnee0;
    const presque = { dieselParL: prix.dieselParL * 1.04, electriciteEffectiveParKwh: prix.electriciteEffectiveParKwh, h2LivreParKg: prix.h2LivreParKg * 2 };
    expect(surveillerPlan({ ...base, dernierRapport: { id: "s", date: "2026-09-01", prix: presque, van: 1 } })).toEqual([]);
  });

  it("échéance : programme retenu se terminant dans moins de 180 jours sans demande déposée ; critique sous 30 jours", () => {
    // véhicule léger électrique acheté en 2026 : Roulez vert (fin 2026-12-31) retenu
    const v = vehicule({ id: "hv1", category: "vehicule_leger", replacement_year: 2026, consumption_per_100km: 7, annual_km: 15000 });
    const base = entree({ vehicules: [v] });
    const roulez = PROGRAMMES.find((p) => p.id === "roulez_vert")!;
    const retenu = Object.values(base.strategie.explicationsSubventions).flat().find((e) => e.programmeId === "roulez_vert");
    expect(retenu?.montant).toBeGreaterThan(0);
    const alertes = surveillerPlan(base).filter((a) => a.type === "echeance_subvention");
    expect(alertes.map((a) => a.cle)).toContain(`echeance:roulez_vert:${roulez.dateFin}`);
    const a = alertes.find((x) => x.cle.includes("roulez_vert"))!;
    expect(a.gravite).toBe("attention");
    if (a.detail.type !== "echeance_subvention") throw new Error();
    expect(a.detail.jours).toBe(90);
    expect(a.detail.montant).toBe(retenu!.montant);
    expect(surveillerPlan({ ...base, aujourdHui: "2026-12-15" }).find((x) => x.cle.includes("roulez_vert"))?.gravite).toBe("critique");
    // demande déposée : plus d'alerte
    expect(
      surveillerPlan({ ...base, demandes: [{ programId: "roulez_vert", statut: "deposee" }] }).some((x) => x.cle.includes("roulez_vert")),
    ).toBe(false);
  });

  it("remplacements en retard : année passée, non réalisés, une alerte groupée dont la clé suit la liste", () => {
    const base = entree({ vehicules: [vehicule({ id: "a", replacement_year: 2024 }), vehicule({ id: "b", replacement_year: 2025 }), vehicule({ id: "c", replacement_year: 2026 })] });
    const r = surveillerPlan(base).filter((a) => a.type === "remplacement_retard");
    expect(r).toHaveLength(1);
    if (r[0].detail.type !== "remplacement_retard") throw new Error();
    expect(r[0].detail.vehicules.map((v) => v.unite)).toEqual(["A", "B"]);
    expect(r[0].cle).toBe("retard:a@2024,b@2025");
    const realise = { ...base, vehicules: base.vehicules.map((v) => (v.id === "a" ? { ...v, realise: true } : v)) };
    expect(surveillerPlan(realise).find((a) => a.type === "remplacement_retard")?.cle).toBe("retard:b@2025");
  });

  it("programme modifié : événement validé APRÈS le dernier rapport, sur un programme examiné pour le plan", () => {
    const v = vehicule({ id: "hv1", category: "vehicule_leger", replacement_year: 2026, consumption_per_100km: 7, annual_km: 15000 });
    const base = entree({ vehicules: [v] });
    const evenements = [
      { id: "e1", programId: "roulez_vert", resumeFr: "Roulez vert : date de fin 2026-06-30.", resumeEn: "Roulez vert: end date 2026-06-30.", valideLe: "2026-10-01T12:00:00Z" },
      { id: "e2", programId: "roulez_vert", resumeFr: "Ancien.", resumeEn: "Old.", valideLe: "2026-08-01T12:00:00Z" },
      { id: "e3", programId: "programme_inconnu", resumeFr: "Hors plan.", resumeEn: "Not in plan.", valideLe: "2026-10-01T12:00:00Z" },
    ];
    const alertes = surveillerPlan({ ...base, evenements, dernierRapport: { id: "s", date: "2026-09-15T00:00:00Z", prix: null, van: null } }).filter(
      (a) => a.type === "programme_modifie",
    );
    expect(alertes.map((a) => a.cle)).toEqual(["programme:e1"]);
    expect(alertes[0].gravite).toBe("attention");
  });

  it("capacité de garage dépassée : kW demandés > disponibles, avec la source de la puissance", () => {
    const vehicules = Array.from({ length: 6 }, (_, i) => vehicule({ id: `g${i}`, depot: "Garage municipal" }));
    const garages = new Map([[cleGarage("Garage municipal"), { puissanceDisponibleKw: 20 }]]);
    const strategie = construireStrategie(vehicules, "plan_actuel", { ...OPTIONS, garages });
    const alertes = surveillerPlan(entree({ vehicules, strategie })).filter((a) => a.type === "capacite_garage");
    expect(alertes).toHaveLength(1);
    if (alertes[0].detail.type !== "capacite_garage") throw new Error();
    const g = strategie.infra.garages[0].raccordement;
    expect(alertes[0].detail.kwDisponibles).toBe(20);
    expect(alertes[0].detail.kwDemandes).toBe(g.kwDemandes);
    expect(alertes[0].detail.cout).toBe(g.cout);
    expect(alertes[0].detail.presumee).toBe(false);
    expect(alertes[0].lien).toBe("plan");
  });

  it("santé : à risque dès une critique, à surveiller dès une attention, les alertes vues ne comptent plus", () => {
    const vehicules = [vehicule({ id: "a", replacement_year: 2024 })];
    const alertes = surveillerPlan(entree({ vehicules }));
    expect(santeDuPlan(alertes).niveau).toBe("a_surveiller");
    expect(santeDuPlan(alertes, new Set(alertes.map((a) => a.cle))).niveau).toBe("bon");
    expect(santeDuPlan([{ ...alertes[0], gravite: "critique" }]).niveau).toBe("a_risque");
  });
});
