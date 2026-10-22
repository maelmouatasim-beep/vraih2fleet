/** Demandes de contact reçues depuis le site public. */
export const LEAD_KINDS = ["lessor", "company"] as const;
export type LeadKind = (typeof LEAD_KINDS)[number];

export const LEAD_STATUSES = ["new", "contacted", "closed"] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

/** Version du texte de consentement affiché sous le formulaire (loi 09-08). */
export const LEAD_CONSENT_VERSION = "2026-10-22";

export function isLeadKind(value: unknown): value is LeadKind {
  return typeof value === "string" && (LEAD_KINDS as readonly string[]).includes(value);
}
