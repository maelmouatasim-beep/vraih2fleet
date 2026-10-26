import "server-only";
import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { schema, type Transaction } from "@leaseplace/db";
import {
  CHECK_CODES,
  EMPTY_FIELDS,
  effectiveGrade,
  isGrade,
  type CheckCode,
  type CheckStatus,
  type ConsistencyCheck,
  type DocumentExtraction,
  type DocumentType,
  type ExtractedFields,
  type FieldSource,
  type Grade,
} from "@leaseplace/domain";

const {
  financingRequests,
  companies,
  documents,
  requestDocuments,
  requestEvents,
  documentExtractions,
  kycChecks,
  riskAssessments,
  riskOverrides,
  creditMemos,
  aiRuns,
  organizations,
} = schema;

export type ReviewRequest = typeof financingRequests.$inferSelect;
export type ReviewDocument = typeof documents.$inferSelect;
export type ExtractionRow = typeof documentExtractions.$inferSelect;
export type AssessmentRow = typeof riskAssessments.$inferSelect;
export type OverrideRow = typeof riskOverrides.$inferSelect;
export type MemoRow = typeof creditMemos.$inferSelect;

/** Statuts de la file de revue, du plus urgent au plus avancé. */
export const QUEUE_STATUSES = ["submitted", "in_review", "needs_info", "qualified"] as const;

export interface QueueItem {
  id: string;
  reference: string;
  status: string;
  companyName: string;
  equipmentCategory: string | null;
  amountHt: number | null;
  submittedAt: Date | null;
  updatedAt: Date;
  grade: string | null;
}

/** File de revue : demandes soumises (les plus anciennes d'abord), puis en cours. */
export async function reviewQueue(tx: Transaction): Promise<QueueItem[]> {
  // Colonne externe écrite en clair : interpolée, drizzle la rendrait sans
  // table (« "id" ») et elle désignerait l'évaluation elle-même.
  // Indice retenu : dernière correction humaine, sinon indice calculé (≡ effectiveGrade).
  const latestGrade = sql<string | null>`(
    select coalesce(
      (select o.grade from credit.risk_overrides o
       where o.assessment_id = a.id order by o.created_at desc limit 1),
      a.grade)
    from credit.risk_assessments a
    where a.request_id = financing_requests.id
    order by a.created_at desc limit 1)`;
  const rows = await tx
    .select({
      id: financingRequests.id,
      reference: financingRequests.reference,
      status: financingRequests.status,
      companyName: organizations.name,
      equipmentCategory: financingRequests.equipmentCategory,
      amountHt: financingRequests.amountHt,
      submittedAt: financingRequests.submittedAt,
      updatedAt: financingRequests.updatedAt,
      grade: latestGrade,
    })
    .from(financingRequests)
    .innerJoin(organizations, eq(organizations.id, financingRequests.organizationId))
    .where(inArray(financingRequests.status, [...QUEUE_STATUSES]))
    .orderBy(asc(financingRequests.submittedAt));
  const order = (s: string) => QUEUE_STATUSES.indexOf(s as (typeof QUEUE_STATUSES)[number]);
  return rows.sort((a, b) => order(a.status) - order(b.status));
}

/** Pièces examinées : coffre-fort de l'entreprise (sains, non effacés) + pièces jointes. */
export async function reviewDocuments(tx: Transaction, request: ReviewRequest) {
  const attached = await tx
    .select({ id: requestDocuments.documentId })
    .from(requestDocuments)
    .where(eq(requestDocuments.requestId, request.id));
  const attachedIds = new Set(attached.map((a) => a.id));
  const docs = await tx
    .select()
    .from(documents)
    .where(
      and(
        eq(documents.organizationId, request.organizationId),
        eq(documents.status, "clean"),
        isNull(documents.deletedAt),
      ),
    )
    .orderBy(asc(documents.createdAt));
  // Les devis d'autres demandes ne concernent pas ce dossier.
  return docs.filter((d) => d.type !== "quote" || attachedIds.has(d.id));
}

/** Dernière extraction de chaque document. */
export async function latestExtractions(
  tx: Transaction,
  documentIds: readonly string[],
): Promise<Map<string, ExtractionRow>> {
  if (documentIds.length === 0) return new Map();
  const rows = await tx
    .select()
    .from(documentExtractions)
    .where(inArray(documentExtractions.documentId, [...documentIds]))
    .orderBy(asc(documentExtractions.createdAt));
  return new Map(rows.map((r) => [r.documentId, r]));
}

export function fieldsOf(row: ExtractionRow): ExtractedFields {
  return { ...EMPTY_FIELDS, ...(row.fields as Partial<ExtractedFields>) };
}

export function sourcesOf(row: ExtractionRow): FieldSource[] {
  return row.sources as FieldSource[];
}

export function toDomainExtraction(doc: ReviewDocument, row: ExtractionRow): DocumentExtraction {
  return { documentId: doc.id, type: doc.type as DocumentType, fields: fieldsOf(row) };
}

/** Derniers échecs d'extraction (appel en erreur), par document. */
export async function failedExtractions(tx: Transaction, requestId: string): Promise<Set<string>> {
  const runs = await tx
    .select({ documentId: aiRuns.documentId, status: aiRuns.status, createdAt: aiRuns.createdAt })
    .from(aiRuns)
    .where(and(eq(aiRuns.requestId, requestId), eq(aiRuns.purpose, "document_extraction")))
    .orderBy(asc(aiRuns.createdAt));
  const last = new Map<string, string>();
  for (const r of runs) if (r.documentId) last.set(r.documentId, r.status);
  return new Set([...last].filter(([, status]) => status !== "succeeded").map(([id]) => id));
}

export async function latestChecks(
  tx: Transaction,
  requestId: string,
): Promise<ConsistencyCheck[]> {
  const [last] = await tx
    .select({ runId: kycChecks.runId })
    .from(kycChecks)
    .where(eq(kycChecks.requestId, requestId))
    .orderBy(desc(kycChecks.createdAt))
    .limit(1);
  if (!last) return [];
  const rows = await tx.select().from(kycChecks).where(eq(kycChecks.runId, last.runId));
  return rows
    .map((r) => ({
      code: r.code as CheckCode,
      status: r.status as CheckStatus,
      documentIds: r.documentIds as string[],
      expected: r.expected as string | number | null,
      found: r.found as (string | number)[],
    }))
    .sort((a, b) => CHECK_CODES.indexOf(a.code) - CHECK_CODES.indexOf(b.code));
}

export interface AssessmentView {
  row: AssessmentRow;
  overrides: OverrideRow[];
  grade: Grade;
}

export async function latestAssessment(
  tx: Transaction,
  requestId: string,
): Promise<AssessmentView | null> {
  const [row] = await tx
    .select()
    .from(riskAssessments)
    .where(eq(riskAssessments.requestId, requestId))
    .orderBy(desc(riskAssessments.createdAt))
    .limit(1);
  if (!row) return null;
  const overrides = await tx
    .select()
    .from(riskOverrides)
    .where(eq(riskOverrides.assessmentId, row.id))
    .orderBy(desc(riskOverrides.createdAt));
  const computed = isGrade(row.grade) ? row.grade : "E";
  return {
    row,
    overrides,
    grade: effectiveGrade(
      computed,
      overrides.flatMap((o) =>
        isGrade(o.grade) ? [{ grade: o.grade, createdAt: o.createdAt }] : [],
      ),
    ),
  };
}

export async function memosOf(tx: Transaction, requestId: string): Promise<MemoRow[]> {
  return tx
    .select()
    .from(creditMemos)
    .where(eq(creditMemos.requestId, requestId))
    .orderBy(desc(creditMemos.createdAt));
}

export async function lastMemoRun(tx: Transaction, requestId: string) {
  const [run] = await tx
    .select()
    .from(aiRuns)
    .where(and(eq(aiRuns.requestId, requestId), eq(aiRuns.purpose, "credit_memo")))
    .orderBy(desc(aiRuns.createdAt))
    .limit(1);
  return run ?? null;
}

export async function reviewTimeline(tx: Transaction, requestId: string) {
  return tx
    .select()
    .from(requestEvents)
    .where(eq(requestEvents.requestId, requestId))
    .orderBy(asc(requestEvents.id));
}

export async function reviewCompany(tx: Transaction, organizationId: string) {
  const [row] = await tx
    .select()
    .from(companies)
    .where(eq(companies.organizationId, organizationId));
  return row ?? null;
}

export async function reviewRequest(tx: Transaction, id: string): Promise<ReviewRequest | null> {
  const [row] = await tx.select().from(financingRequests).where(eq(financingRequests.id, id));
  return row ?? null;
}
