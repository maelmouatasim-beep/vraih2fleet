/**
 * Indicateurs internes (tableau de bord de la plateforme) : entonnoir des
 * demandes, délai jusqu'à la première offre, offres par dossier, économie
 * générée pour le client, production intermédiée. Fonctions pures, à partir
 * des dates de passage de chaque demande.
 */
export const FUNNEL_STAGES = [
  "submitted",
  "qualified",
  "routed",
  "firstOffer",
  "accepted",
  "financed",
] as const;
export type FunnelStage = (typeof FUNNEL_STAGES)[number];

export type FunnelRow = Readonly<Record<FunnelStage, Date | null>>;

export interface FunnelStep {
  stage: FunnelStage;
  count: number;
  /** Part des demandes de l'étape précédente qui ont atteint celle-ci (null à la première). */
  fromPrevious: number | null;
  /** Part des demandes soumises. */
  fromStart: number | null;
}

export function funnel(rows: readonly FunnelRow[]): FunnelStep[] {
  const start = rows.filter((r) => r.submitted !== null).length;
  let previous: number | null = null;
  return FUNNEL_STAGES.map((stage) => {
    const count = rows.filter((r) => r[stage] !== null).length;
    const step = {
      stage,
      count,
      fromPrevious: previous ? count / previous : null,
      fromStart: start ? count / start : null,
    };
    previous = count;
    return step;
  });
}

export function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const middle = sorted.slice(sorted.length % 2 === 1 ? mid : mid - 1, mid + 1);
  return middle.reduce((s, v) => s + v, 0) / middle.length;
}

/** Délai médian (heures) entre la transmission et la première offre. */
export function medianHoursToFirstOffer(rows: readonly FunnelRow[]): number | null {
  return median(
    rows.flatMap((r) =>
      r.routed && r.firstOffer ? [(r.firstOffer.getTime() - r.routed.getTime()) / 3_600_000] : [],
    ),
  );
}

/** Nombre moyen d'offres par dossier transmis. */
export function offersPerRoutedRequest(
  rows: readonly { routed: boolean; offers: number }[],
): number | null {
  const routed = rows.filter((r) => r.routed);
  if (routed.length === 0) return null;
  return routed.reduce((s, r) => s + r.offers, 0) / routed.length;
}

/**
 * Économie générée pour le client sur une demande : coût moyen des autres
 * offres reçues moins le coût de l'offre acceptée. Null sans comparaison
 * possible (une seule offre).
 */
export function savingsOf(offerCosts: readonly number[], acceptedCost: number): number | null {
  const others = [...offerCosts];
  const index = others.indexOf(acceptedCost);
  if (index >= 0) others.splice(index, 1);
  if (others.length === 0) return null;
  return others.reduce((s, c) => s + c, 0) / others.length - acceptedCost;
}

export function mean(values: readonly number[]): number | null {
  return values.length === 0 ? null : values.reduce((s, v) => s + v, 0) / values.length;
}
