import type { NormalizedOffer, OfferTerms } from "./offer";

/**
 * Classement NEUTRE des offres : uniquement sur des grandeurs financières
 * calculées pour le client. Aucun champ commercial (commission, bailleur
 * partenaire, mise en avant) n'existe dans ce type : il ne peut pas influer.
 */
export const OFFER_SORT_KEYS = ["totalCost", "effectiveRate", "rent", "firstRent"] as const;
export type OfferSortKey = (typeof OFFER_SORT_KEYS)[number];

export interface RankableOffer {
  id: string;
  terms: Pick<OfferTerms, "rentHt" | "firstRentHt">;
  normalized: Pick<NormalizedOffer, "totals" | "rates">;
}

const VALUE: Readonly<Record<OfferSortKey, (o: RankableOffer) => number>> = {
  totalCost: (o) => o.normalized.totals.financingCostHt,
  effectiveRate: (o) => o.normalized.rates.annualEffectiveRate,
  rent: (o) => o.terms.rentHt,
  firstRent: (o) => o.terms.firstRentHt,
};

function compareOn(key: OfferSortKey, a: RankableOffer, b: RankableOffer): number {
  const diff = VALUE[key](a) - VALUE[key](b);
  // Montants : égalité au centime ; taux : égalité à 1e-9 près.
  const tolerance = key === "effectiveRate" ? 1e-9 : 0.005;
  return Math.abs(diff) < tolerance ? 0 : Math.sign(diff);
}

/** Tri croissant ; égalités départagées par coût total, puis TEG, puis identifiant (déterministe). */
export function rankOffers<T extends RankableOffer>(
  offers: readonly T[],
  key: OfferSortKey = "totalCost",
): T[] {
  return [...offers].sort(
    (a, b) =>
      compareOn(key, a, b) ||
      compareOn("totalCost", a, b) ||
      compareOn("effectiveRate", a, b) ||
      (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );
}

/** Offre au meilleur coût total (badge), ou null s'il n'y a pas d'offre. */
export function bestTotalCost<T extends RankableOffer>(offers: readonly T[]): T | null {
  return rankOffers(offers, "totalCost")[0] ?? null;
}
