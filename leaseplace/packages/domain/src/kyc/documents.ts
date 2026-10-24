import { ageInMonths, isCorporation, type LegalForm } from "./company";

/**
 * Pièces du dossier KYC. La liste exigée dépend de la forme juridique et de
 * l'ancienneté. Liste INDICATIVE de la plateforme (à valider avec l'associé) :
 * chaque bailleur reste libre de demander davantage et valide le KYC final.
 */
export const DOCUMENT_TYPES = [
  "rc_extract",
  "ice_certificate",
  "articles",
  "director_id",
  "appointment_minutes",
  "auto_entrepreneur_card",
  "tax_returns",
  "business_plan",
  "bank_statements",
  "tax_certificate",
  "cnss_certificate",
  "quote",
  "other",
] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];

/** Pièces propres à une demande (et non à l'entreprise). */
export const REQUEST_DOCUMENT_TYPES: readonly DocumentType[] = ["quote"];

/** Ancienneté en dessous de laquelle les liasses sont remplacées par un prévisionnel. */
export const MIN_MONTHS_FOR_TAX_RETURNS = 12;

export function requiredDocuments(
  form: LegalForm,
  incorporationDate: Date | null,
  at: Date,
): DocumentType[] {
  const young =
    incorporationDate === null || ageInMonths(incorporationDate, at) < MIN_MONTHS_FOR_TAX_RETURNS;
  const financials: DocumentType[] = [young ? "business_plan" : "tax_returns", "bank_statements"];
  if (form === "auto_entrepreneur")
    return ["auto_entrepreneur_card", "director_id", "bank_statements"];
  const base: DocumentType[] = ["rc_extract", "ice_certificate", "director_id"];
  const corporate: DocumentType[] = isCorporation(form) ? ["articles", "appointment_minutes"] : [];
  return [...base, ...corporate, ...financials, "tax_certificate", "cnss_certificate"];
}

/**
 * Fraîcheur exigée (mois depuis la délivrance). HYPOTHÈSES À VALIDER avec
 * l'associé : usage bancaire courant, aucune source réglementaire lue.
 */
export const MAX_AGE_MONTHS: Partial<Readonly<Record<DocumentType, number>>> = {
  rc_extract: 3,
  tax_certificate: 3,
  cnss_certificate: 3,
  bank_statements: 2,
};

export interface VaultDocument {
  type: DocumentType;
  status: "clean" | "quarantined" | "rejected";
  issuedOn: Date | null;
}

export function isStale(doc: Pick<VaultDocument, "type" | "issuedOn">, at: Date): boolean {
  const max = MAX_AGE_MONTHS[doc.type];
  if (max === undefined || doc.issuedOn === null) return false;
  return ageInMonths(doc.issuedOn, at) >= max;
}

export type RequirementState = "missing" | "stale" | "ok";

export interface Completeness {
  items: { type: DocumentType; state: RequirementState }[];
  /** Part des pièces exigées présentes, saines et à jour (0 à 1). */
  ratio: number;
  complete: boolean;
}

export function completeness(
  required: readonly DocumentType[],
  docs: readonly VaultDocument[],
  at: Date,
): Completeness {
  const items = required.map((type) => {
    const usable = docs.filter((d) => d.type === type && d.status === "clean");
    const state: RequirementState =
      usable.length === 0 ? "missing" : usable.some((d) => !isStale(d, at)) ? "ok" : "stale";
    return { type, state };
  });
  const ok = items.filter((i) => i.state === "ok").length;
  return {
    items,
    ratio: required.length === 0 ? 1 : ok / required.length,
    complete: ok === required.length,
  };
}

/** Fichiers acceptés : PDF et images, reconnus par leur signature binaire. */
export const ACCEPTED_MIME_TYPES = ["application/pdf", "image/jpeg", "image/png"] as const;
export type AcceptedMimeType = (typeof ACCEPTED_MIME_TYPES)[number];
export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;

export function sniffMimeType(bytes: Uint8Array): AcceptedMimeType | null {
  const starts = (sig: number[]) => sig.every((b, i) => bytes[i] === b);
  if (starts([0x25, 0x50, 0x44, 0x46, 0x2d])) return "application/pdf"; // %PDF-
  if (starts([0xff, 0xd8, 0xff])) return "image/jpeg";
  if (starts([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  return null;
}
