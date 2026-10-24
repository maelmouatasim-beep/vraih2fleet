import "server-only";
import { and, asc, desc, eq, isNull } from "drizzle-orm";
import { schema, type Transaction } from "@leaseplace/db";
import {
  completeness,
  EQUIPMENT_CATEGORIES,
  EQUIPMENT_CONDITIONS,
  PERIODICITIES,
  type RequestDraft,
  requiredDocuments,
  type Completeness,
  type DocumentType,
  type LegalForm,
  type VaultDocument,
} from "@leaseplace/domain";

const { companies, documents, financingRequests, requestDocuments, requestEvents, legalTexts } =
  schema;

export type CompanyRow = typeof companies.$inferSelect;
export type DocumentRow = typeof documents.$inferSelect;
export type RequestRow = typeof financingRequests.$inferSelect;

export async function getCompany(
  tx: Transaction,
  organizationId: string,
): Promise<CompanyRow | null> {
  const [row] = await tx
    .select()
    .from(companies)
    .where(eq(companies.organizationId, organizationId));
  return row ?? null;
}

export function listDocuments(tx: Transaction, organizationId: string): Promise<DocumentRow[]> {
  return tx
    .select()
    .from(documents)
    .where(and(eq(documents.organizationId, organizationId), isNull(documents.deletedAt)))
    .orderBy(desc(documents.createdAt));
}

export function toVaultDocument(d: DocumentRow): VaultDocument {
  return {
    type: d.type as DocumentType,
    status: d.status as VaultDocument["status"],
    issuedOn: d.issuedOn,
  };
}

export interface KycState {
  required: DocumentType[];
  completeness: Completeness;
}

/** Pièces exigées et complétude, pour une entreprise donnée, à une date donnée. */
export function kycState(
  company: CompanyRow,
  docs: readonly DocumentRow[],
  now = new Date(),
): KycState {
  const required = requiredDocuments(
    company.legalForm as LegalForm,
    company.incorporationDate,
    now,
  );
  return { required, completeness: completeness(required, docs.map(toVaultDocument), now) };
}

export function listRequests(tx: Transaction, organizationId: string): Promise<RequestRow[]> {
  return tx
    .select()
    .from(financingRequests)
    .where(eq(financingRequests.organizationId, organizationId))
    .orderBy(desc(financingRequests.updatedAt));
}

export async function getRequest(tx: Transaction, id: string): Promise<RequestRow | null> {
  const [row] = await tx.select().from(financingRequests).where(eq(financingRequests.id, id));
  return row ?? null;
}

export function requestAttachments(tx: Transaction, requestId: string) {
  return tx
    .select({ document: documents })
    .from(requestDocuments)
    .innerJoin(documents, eq(documents.id, requestDocuments.documentId))
    .where(eq(requestDocuments.requestId, requestId))
    .orderBy(asc(requestDocuments.attachedAt));
}

export function requestTimeline(tx: Transaction, requestId: string) {
  return tx
    .select()
    .from(requestEvents)
    .where(and(eq(requestEvents.requestId, requestId), eq(requestEvents.visibleToClient, true)))
    .orderBy(asc(requestEvents.id));
}

/** Dernière version publiée d'un texte légal dans une langue. */
export async function currentLegalText(
  tx: Transaction,
  kind: "consent_processing",
  locale: string,
) {
  const [row] = await tx
    .select()
    .from(legalTexts)
    .where(and(eq(legalTexts.kind, kind), eq(legalTexts.locale, locale)))
    .orderBy(desc(legalTexts.publishedAt))
    .limit(1);
  return row ?? null;
}

function oneOf<T extends string>(list: readonly T[], value: string | null): T | null {
  return value !== null && (list as readonly string[]).includes(value) ? (value as T) : null;
}

/** Ligne de base → brouillon typé du domaine (valeurs inconnues ignorées). */
export function draftOf(r: RequestRow): RequestDraft {
  return {
    equipmentCategory: oneOf(EQUIPMENT_CATEGORIES, r.equipmentCategory),
    equipmentDescription: r.equipmentDescription,
    condition: oneOf(EQUIPMENT_CONDITIONS, r.condition),
    equipmentYear: r.equipmentYear,
    supplierName: r.supplierName,
    amountHt: r.amountHt,
    firstRentPct: r.firstRentPct,
    durationMonths: r.durationMonths,
    residualPct: r.residualPct,
    periodicity: oneOf(PERIODICITIES, r.periodicity),
  };
}
