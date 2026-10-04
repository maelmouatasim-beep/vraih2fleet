/**
 * Affichage d'une valeur d'hypothèse du registre (annexe du PDF, Excel) —
 * audit acheteur, point 10 : séparateurs de la langue (« 15 000 $ », pas
 * « 15000 $ »), fractions en pourcentage (« 3 % », pas « 0.03 ratio »),
 * unités traduites. PUR, testé.
 */
import { formateurNombre, localeDe } from "@/lib/format";

const UNITES_EN: Record<string, string> = {
  annees: "years",
  jours: "days",
  véhicules: "vehicles",
};
const UNITES_FR: Record<string, string> = {
  annees: "ans",
};

/** Libellé d'unité lisible (« ans », « years »…) ; « ratio » devient « % ». */
export function libelleUnite(unite: string, langue: "fr" | "en"): string {
  if (unite === "ratio") return "%";
  return (langue === "en" ? UNITES_EN[unite] : UNITES_FR[unite]) ?? unite;
}

/** Valeur formatée selon l'unité et la langue (sans l'unité). */
export function formaterValeurHypothese(valeur: number, unite: string, langue: "fr" | "en"): string {
  if (unite === "ratio") {
    return new Intl.NumberFormat(localeDe(langue), { maximumFractionDigits: 2 }).format(valeur * 100);
  }
  if (unite === "$") return formateurNombre(langue, 2).format(valeur);
  return formateurNombre(langue, 4).format(valeur);
}

/** Valeur numérique pour une cellule Excel : fraction → pourcentage (3 pour
 *  3 %) et arrondi à 4 décimales (aucun 0,30000000000000004). */
export function valeurCelluleHypothese(valeur: number, unite: string): number {
  const v = unite === "ratio" ? valeur * 100 : valeur;
  return Math.round(v * 10_000) / 10_000;
}
