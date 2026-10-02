import { describe, expect, it } from "vitest";
import { resoudreSubventions } from "@/lib/tco";
import { construireStrategie, type VehiculeProjet } from "../strategies";
import { construireClasseurPlan } from "../report";
import { texteExplication, texteRaison } from "../subsidy-explain";

const OPTIONS = { anneeReference: 2026, horizonAns: 10, tauxActualisationNominal: 0.05, typeOrganisme: "municipalite" as const };
const f150 = (id: string, model_year: number, replacement_year: number): VehiculeProjet =>
  ({
    id,
    category: "camionnette",
    fuel_type: "diesel",
    annual_km: 20000,
    consumption_per_100km: 16,
    consumption_source: "saisie",
    usage_profile: "urbain",
    model_year,
    replacement_year,
    target_technology: "bev",
  }) as VehiculeProjet;

describe("subventions explicables dans le parcours (1.7)", () => {
  it("deux F-150 identiques achetés la même année ont la même subvention, quel que soit leur millésime", () => {
    const s = construireStrategie([f150("a", 2015, 2027), f150("b", 2017, 2027)], "plan_actuel", OPTIONS);
    const [a, b] = s.plan!.vehicules;
    expect(a.subventionsAlternative).toEqual(b.subventionsAlternative);
    expect(s.explicationsSubventions.a).toEqual(s.explicationsSubventions.b);
  });

  it("achat 2026 vs 2027 : l'écart est EXPLIQUÉ (barème 2b dégressif) à l'écran et dans l'Excel", () => {
    const s = construireStrategie([f150("a", 2015, 2026), f150("b", 2017, 2027)], "plan_actuel", OPTIONS);
    const texte = (id: string) =>
      s.explicationsSubventions[id]
        .map((e) => texteExplication(e, "fr"))
        .join(" ; ")
        .replace(/[\u202f\u00a0]/g, " ");
    expect(texte("a")).toContain("forfait de 2 500");
    expect(texte("a")).toContain("pour un achat en 2026");
    expect(texte("b")).toContain("0 $ pour un achat en 2027 (barème dégressif)");
    expect(texte("b")).toContain("classe de poids (PNBV) inconnue");
    const vehicules = construireClasseurPlan(s, new Map([["a", "F-150 2015"], ["b", "F-150 2017"]]), {
      organisation: "Ville",
      projet: "P",
      dateIso: "2026-10-02",
      anneeReference: 2026,
      horizonAns: 10,
      tauxActualisationNominal: 0.05,
    })[1].lignes;
    expect(vehicules[0].at(-1)).toBe("Règle appliquée et raison (programme par programme)");
    expect(String(vehicules.find((l) => l[0] === "F-150 2017")!.at(-1))).toContain("barème dégressif");
  });

  it("chaque code de raison a un texte fr et en", () => {
    const r = resoudreSubventions({
      categorie: "vehicule_leger",
      technologie: "BEV",
      prixAvantTaxes: 70000,
      typeOrganisme: "municipalite",
      anneeAchatCalendaire: 2027,
    });
    for (const e of r.explications) {
      for (const raison of e.raisons) {
        expect(texteRaison(raison, "fr")).not.toBe("");
        expect(texteRaison(raison, "en")).not.toMatch(/[éè]/);
      }
    }
    expect(texteExplication(r.explications[0], "en")).toMatch(/^EVAP|^[A-Z]/);
  });
});
