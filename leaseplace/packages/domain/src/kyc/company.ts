/** Profil d'entreprise (PME) : formes juridiques, secteurs, tranches. */

export const LEGAL_FORMS = [
  "sarl",
  "sarlau",
  "sa",
  "sas",
  "snc",
  "ei",
  "auto_entrepreneur",
  "other",
] as const;
export type LegalForm = (typeof LEGAL_FORMS)[number];

/** Sociétés (personnes morales) vs exploitation en nom propre. */
export function isCorporation(form: LegalForm): boolean {
  return form !== "ei" && form !== "auto_entrepreneur";
}

export const BUSINESS_SECTORS = [
  "transport",
  "construction",
  "health",
  "industry",
  "agriculture",
  "trade",
  "services",
  "tech",
  "tourism",
  "other",
] as const;
export type BusinessSector = (typeof BUSINESS_SECTORS)[number];

export const REVENUE_BANDS = ["lt_3m", "3m_10m", "10m_50m", "50m_175m", "gt_175m"] as const;
export const HEADCOUNT_BANDS = ["1_9", "10_49", "50_199", "200_plus"] as const;
export type RevenueBand = (typeof REVENUE_BANDS)[number];
export type HeadcountBand = (typeof HEADCOUNT_BANDS)[number];

/** ICE : identifiant commun de l'entreprise, 15 chiffres (espaces tolérés à la saisie). */
export function normalizeIce(input: string): string | null {
  const digits = input.replace(/[\s.-]/g, "");
  return /^\d{15}$/.test(digits) ? digits : null;
}

/** Ancienneté en mois révolus à une date donnée. */
export function ageInMonths(incorporationDate: Date, at: Date): number {
  const months =
    (at.getUTCFullYear() - incorporationDate.getUTCFullYear()) * 12 +
    (at.getUTCMonth() - incorporationDate.getUTCMonth()) -
    (at.getUTCDate() < incorporationDate.getUTCDate() ? 1 : 0);
  return Math.max(0, months);
}
