/**
 * Synthèse financière d'un résultat du moteur — logique PURE, partagée par
 * Stratégies, Plan, PDF, Excel et note au conseil (mêmes chiffres partout) :
 * - investissement brut du plan À CÔTÉ de celui du statu quo (le même
 *   calendrier en diesel neuf) : un élu lit l'écart, pas seulement le brut ;
 * - VAN décomposée par poste (moteur, §6.4).
 */
import type { DecompositionVan, ResultatPlan } from "@/lib/tco";

export interface InvestissementCompare {
  /** Investissement du plan, dollars courants (véhicules + infrastructure). */
  brut: number;
  /** Investissement du statu quo : mêmes remplacements en diesel neuf. */
  statuQuo: number;
  /** brut − statuQuo : ce que le plan engage de plus (négatif = de moins). */
  surcout: number;
}

const somme = (x: number[]) => x.reduce((a, b) => a + b, 0);

export function investissementCompare(r: ResultatPlan): InvestissementCompare {
  const brut = somme(r.alternative.flux.investissement);
  const statuQuo = somme(r.reference.flux.investissement);
  return { brut, statuQuo, surcout: brut - statuQuo };
}

export const POSTES_VAN = [
  "achat",
  "energie",
  "entretien",
  "assurance",
  "infrastructure",
  "subventions",
  "valeurResiduelle",
] as const satisfies readonly (keyof DecompositionVan)[];

export type PosteVan = (typeof POSTES_VAN)[number];

/** Lignes de la décomposition, dans l'ordre de lecture, postes nuls retirés. */
export function lignesDecomposition(d: DecompositionVan): { poste: PosteVan; montant: number }[] {
  return POSTES_VAN.map((poste) => ({ poste, montant: d[poste] })).filter((l) => Math.abs(l.montant) >= 0.5);
}

export const LIBELLES_POSTES: Record<"fr" | "en", Record<PosteVan, string>> = {
  fr: {
    achat: "Achat des véhicules",
    energie: "Énergie",
    entretien: "Entretien et réparations",
    assurance: "Assurance",
    infrastructure: "Infrastructure (bornes, raccordement, station H2)",
    subventions: "Subventions",
    valeurResiduelle: "Valeur de revente des véhicules",
  },
  en: {
    achat: "Vehicle purchase",
    energie: "Energy",
    entretien: "Maintenance and repairs",
    assurance: "Insurance",
    infrastructure: "Infrastructure (chargers, grid connection, H2 station)",
    subventions: "Subsidies",
    valeurResiduelle: "Vehicle resale value",
  },
};
