/**
 * Textes (fr/en) des décisions et contraintes de l'optimiseur : les
 * montants viennent des sorties du moteur, formatés à l'affichage.
 */
import type { TFunction } from "i18next";
import type { RaisonDecision, Violation } from "@/lib/journey/optimizer";

export function texteRaison(t: TFunction, r: RaisonDecision, argent: Intl.NumberFormat): string {
  switch (r.code) {
    case "electrifie_rentable":
      return t("journey.optimizer.reasons.electrifie_rentable", { amount: argent.format(r.economie) });
    case "electrifie_co2":
      return t("journey.optimizer.reasons.electrifie_co2", { tonnes: r.tonnes.toFixed(0), amount: argent.format(r.cout) });
    case "electrifie_cible":
      return t("journey.optimizer.reasons.electrifie_cible", { amount: argent.format(r.cout) });
    case "subvention_avant_fin":
    case "avance_subvention":
      return t(`journey.optimizer.reasons.${r.code}`, { programme: r.programme, date: r.dateFin });
    case "avance_avantageuse":
    case "report_avantageux":
      return t(`journey.optimizer.reasons.${r.code}`, { amount: argent.format(Math.abs(r.gain)) });
    case "report_budget":
    case "diesel_budget":
      return t(`journey.optimizer.reasons.${r.code}`, { budget: t(`journey.optimizer.budgetKinds.${r.budget}`) });
    case "report_capacite":
    case "diesel_capacite":
      return t(`journey.optimizer.reasons.${r.code}`, { garage: r.garage ?? t("journey.infra.noDepot") });
    case "diesel_non_rentable":
      return t("journey.optimizer.reasons.diesel_non_rentable", { amount: argent.format(r.surcout) });
    default:
      return t(`journey.optimizer.reasons.${r.code}`);
  }
}

export function texteViolation(
  t: TFunction,
  v: Violation,
  argent: Intl.NumberFormat,
  uniteDe: (id: string) => string,
): string {
  const pct = (x: number) => `${Math.round(x * 100)} %`;
  switch (v.code) {
    case "budget_investissement":
    case "budget_reste":
      return t(`journey.optimizer.violations.${v.code}`, {
        year: v.annee,
        amount: argent.format(v.montant),
        budget: argent.format(v.budget),
        over: argent.format(v.depassement),
      });
    case "capacite_kw":
      return t("journey.optimizer.violations.capacite_kw", {
        garage: v.garage ?? t("journey.infra.noDepot"),
        year: v.annee,
        demand: Math.round(v.demande),
        capacity: Math.round(v.capacite),
        over: Math.round(v.depassement),
      });
    case "capacite_places":
      return t("journey.optimizer.violations.capacite_places", {
        garage: v.garage ?? t("journey.infra.noDepot"),
        year: v.annee,
        demand: v.demande,
        places: v.places,
        over: v.depassement,
      });
    case "cible_ze":
      return t("journey.optimizer.violations.cible_ze", {
        year: v.annee,
        target: pct(v.demande),
        reached: pct(v.atteint),
        count: v.vehiculesManquants,
      });
    case "cible_ges":
      return t("journey.optimizer.violations.cible_ges", {
        year: v.annee,
        target: pct(v.demande),
        reached: pct(v.atteint),
        tonnes: v.tonnesManquantes.toFixed(0),
      });
    case "aucune_techno":
      return t("journey.optimizer.violations.aucune_techno", { unit: uniteDe(v.vehiculeId) });
  }
}

