/**
 * Point 12 de l'audit : l'Excel contient de VRAIES formules, et chaque
 * formule, recalculée à partir des cellules du classeur, redonne le chiffre
 * du moteur (à 0,50 $ près : les cellules sont arrondies au cent).
 * Évaluateur minimal (références, SUM, NPV, + et −), même sémantique
 * qu'Excel (NPV actualise à partir de la période 1).
 */
import { describe, expect, it } from "vitest";
import { construireClasseurPlan, estFormule, estLien, valeurCellule, valeurExcelJs, type Cellule } from "../report";
import { construireStrategie, type VehiculeProjet } from "../strategies";

const OPTIONS = { anneeReference: 2026, horizonAns: 12, tauxActualisationNominal: 0.04, typeOrganisme: "municipalite" as const };
const META = { organisation: "Ville", projet: "P", dateIso: "2026-10-05", anneeReference: 2026, horizonAns: 12, tauxActualisationNominal: 0.04 };

const v = (id: string, category: string, techno: "bev" | "diesel", annee: number, depot: string): VehiculeProjet => ({
  id,
  category,
  fuel_type: "diesel",
  annual_km: 30000,
  consumption_per_100km: 16,
  consumption_source: "saisie",
  usage_profile: "urbain",
  replacement_year: annee,
  target_technology: techno,
  depot,
});

const FLOTTE = [
  v("a", "camionnette", "bev", 2027, "Garage nord"),
  v("b", "vehicule_leger", "bev", 2028, "Garage nord"),
  v("c", "camion_moyen", "bev", 2029, "Garage sud"),
  v("d", "camionnette", "diesel", 2030, "Garage sud"),
];

const colIndex = (lettres: string) => [...lettres].reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0) - 1;

function evaluateur(lignes: Cellule[][]) {
  const cellule = (ref: string): number => {
    const m = /^\$?([A-Z]+)\$?(\d+)$/.exec(ref);
    if (!m) throw new Error(`référence illisible : ${ref}`);
    const c = lignes[Number(m[2]) - 1]?.[colIndex(m[1])];
    return estFormule(c) ? evaluer(c.formule) : Number(valeurCellule(c) ?? 0);
  };
  const plage = (p: string): number[] => {
    const [a, b] = p.split(":");
    const [, ca, ra] = /^\$?([A-Z]+)\$?(\d+)$/.exec(a)!;
    const [, , rb] = /^\$?([A-Z]+)\$?(\d+)$/.exec(b)!;
    const out: number[] = [];
    for (let r = Number(ra); r <= Number(rb); r++) out.push(cellule(`${ca}${r}`));
    return out;
  };
  const terme = (t: string): number => {
    let m = /^SUM\(([^)]+)\)$/.exec(t);
    if (m) return plage(m[1]).reduce((x, y) => x + y, 0);
    m = /^NPV\(([^,]+),([^)]+)\)$/.exec(t);
    if (m) {
      const taux = cellule(m[1]);
      return plage(m[2]).reduce((x, y, i) => x + y / Math.pow(1 + taux, i + 1), 0);
    }
    if (/^-?\d+(\.\d+)?$/.test(t)) return Number(t);
    return cellule(t);
  };
  function evaluer(formule: string): number {
    // Découpe en termes au niveau zéro des parenthèses.
    let total = 0;
    let signe = 1;
    let courant = "";
    let prof = 0;
    for (const ch of formule.replace(/\s/g, "")) {
      if (ch === "(") prof++;
      if (ch === ")") prof--;
      if ((ch === "+" || ch === "-") && prof === 0 && courant) {
        total += signe * terme(courant);
        signe = ch === "+" ? 1 : -1;
        courant = "";
      } else courant += ch;
    }
    return total + signe * terme(courant);
  }
  return evaluer;
}

describe("classeur Excel : formules vérifiables", () => {
  const s = construireStrategie(FLOTTE, "plan_actuel", OPTIONS);
  const feuilles = construireClasseurPlan(s, new Map(), META);
  const [budget, vehicules, , hypotheses] = [feuilles[0], feuilles[1], null, feuilles[feuilles.length - 1]];

  it("plan annuel : reste à financer, net, écart, totaux, TCO (VAN au taux du projet) et économie sont des formules", () => {
    const entete = budget.lignes.findIndex((l) => l[0] === "Année");
    const premiere = budget.lignes[entete + 1];
    expect(estFormule(premiere[3]) && estFormule(premiere[6]) && estFormule(premiere[8])).toBe(true);
    const total = budget.lignes.find((l) => l[0] === "Total")!;
    expect(total.slice(1).every(estFormule)).toBe(true);
    for (const lib of ["TCO actualisé du plan", "TCO actualisé du statu quo", "Économie (VAN)", "Total = VAN"]) {
      expect(estFormule(budget.lignes.find((l) => l[0] === lib)![1]), lib).toBe(true);
    }
    expect(String((budget.lignes.find((l) => l[0] === "TCO actualisé du plan")![1] as { formule: string }).formule)).toMatch(/NPV\(\$B\$\d+,G\d+:G\d+\)/);
  });

  it("chaque formule, recalculée depuis les cellules, redonne le chiffre du moteur", () => {
    for (const f of [budget, vehicules]) {
      const evaluer = evaluateur(f.lignes);
      let n = 0;
      for (const ligne of f.lignes) {
        for (const c of ligne) {
          if (!estFormule(c)) continue;
          n++;
          expect(Math.abs(evaluer(c.formule) - c.resultat), `${f.nom} : ${c.formule}`).toBeLessThan(0.5);
        }
      }
      expect(n).toBeGreaterThan(0);
    }
    const r = s.resultat!;
    const van = budget.lignes.find((l) => l[0] === "Économie (VAN)")![1];
    expect(valeurCellule(van)).toBeCloseTo(r.vanDifferentielle, 2);
  });

  it("infrastructure : total par garage et total général en formules", () => {
    const total = vehicules.lignes.find((l) => l[0] === "Infrastructure totale")!;
    expect(estFormule(total.at(-1))).toBe(true);
    expect(valeurCellule(total.at(-1))).toBeCloseTo(s.infra.totalCapex, 2);
  });

  it("hypothèses : adresse de chaque source en lien cliquable, prix d'achat par catégorie", () => {
    const prixDiesel = hypotheses.lignes.find((l) => l[0] === "prix_diesel")!;
    expect(estLien(prixDiesel[8])).toBe(true);
    const bus = hypotheses.lignes.find((l) => /autobus/i.test(String(l[0])))!;
    expect(typeof bus[2]).toBe("number");
    expect(bus.some((c) => estLien(c) && /newswire\.ca/.test(c.lien))).toBe(true);
  });

  it("conversion exceljs : formule avec résultat en cache, lien hypertexte", () => {
    expect(valeurExcelJs({ formule: "B7-C7", resultat: 12 })).toEqual({ formula: "B7-C7", result: 12 });
    expect(valeurExcelJs({ texte: "x", lien: "https://a.b" })).toEqual({ text: "x", hyperlink: "https://a.b" });
    expect(valeurExcelJs(null)).toBeNull();
  });
});
