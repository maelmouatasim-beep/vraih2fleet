import { describe, expect, it } from "vitest";
import { construireStrategie, type VehiculeProjet } from "../strategies";
import fr from "@/i18n/locales/fr/translation.json";
import en from "@/i18n/locales/en/translation.json";
import { construireClasseurPlan } from "../report";
import { investissementCompare, lignesDecomposition, POSTES_VAN, LIBELLES_POSTES } from "../synthese";

const OPTIONS = { anneeReference: 2026, horizonAns: 10, tauxActualisationNominal: 0.05, typeOrganisme: "municipalite" as const };
const v = (id: string, techno: "bev" | "diesel"): VehiculeProjet => ({
  id,
  category: "camionnette",
  fuel_type: "diesel",
  annual_km: 25000,
  consumption_per_100km: 16,
  consumption_source: "saisie",
  usage_profile: "urbain",
  replacement_year: 2027,
  target_technology: techno,
  depot: "Garage municipal",
});

describe("synthèse financière (audit acheteur : point 7 et ajustement B)", () => {
  const s = construireStrategie([v("a", "bev"), v("b", "bev"), v("c", "diesel")], "plan_actuel", OPTIONS);
  const r = s.resultat!;

  it("investissement brut affiché avec celui du statu quo et l'écart", () => {
    const i = investissementCompare(r);
    expect(i.brut).toBeCloseTo(r.vueBudgetaire.reduce((a, l) => a + l.investissementAlt, 0), 6);
    expect(i.statuQuo).toBeGreaterThan(0);
    expect(i.surcout).toBeCloseTo(i.brut - i.statuQuo, 6);
    expect(i.surcout).toBeGreaterThan(0); // BEV + bornes coûtent plus à l'achat
  });

  it("les lignes de la décomposition reconstituent la VAN ; libellés fr/en pour chaque poste", () => {
    const total = lignesDecomposition(r.decompositionVan).reduce((a, l) => a + l.montant, 0);
    expect(total).toBeCloseTo(r.vanDifferentielle, 0);
    for (const p of POSTES_VAN) {
      expect(LIBELLES_POSTES.fr[p]).toBeTruthy();
      expect(LIBELLES_POSTES.en[p]).toBeTruthy();
    }
  });

  it("plan sans changement : aucune ligne (rien à décomposer)", () => {
    const sq = construireStrategie([v("c", "diesel")], "plan_actuel", OPTIONS);
    expect(lignesDecomposition(sq.resultat!.decompositionVan)).toEqual([]);
    expect(investissementCompare(sq.resultat!).surcout).toBeCloseTo(0, 6);
  });

  it("libellés des postes identiques à l'écran (i18n) et dans les exports", () => {
    expect(fr.journey.van.postes).toEqual(LIBELLES_POSTES.fr);
    expect(en.journey.van.postes).toEqual(LIBELLES_POSTES.en);
  });

  it("Excel : investissement comparé au statu quo et VAN par poste dans la feuille du plan", () => {
    const feuilles = construireClasseurPlan(s, new Map(), {
      organisation: "Ville",
      projet: "P",
      dateIso: "2026-10-05",
      anneeReference: 2026,
      horizonAns: 10,
      tauxActualisationNominal: 0.05,
    });
    const lignes = feuilles[0].lignes;
    const valeur = (libelle: string) => lignes.find((l) => l[0] === libelle)?.[1];
    expect(valeur("Investissement du statu quo — mêmes remplacements en thermique neuf (dollars courants)")).toBeCloseTo(investissementCompare(r).statuQuo, 2);
    expect(valeur("Achat des véhicules")).toBeCloseTo(r.decompositionVan.achat, 2);
    expect(valeur("Total = VAN")).toBeCloseTo(r.vanDifferentielle, 2);
  });
});
