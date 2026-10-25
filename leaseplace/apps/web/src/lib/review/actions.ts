import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import {
  AiError,
  buildMemoFacts,
  EXTRACTION_PROMPT_VERSION,
  normalizeExtraction,
  verifyMemo,
  type AiCallMeta,
  type MemoIssue,
  type NormalizedExtraction,
} from "@leaseplace/ai";
import { recordAudit, schema, withActor, type Transaction } from "@leaseplace/db";
import {
  assess,
  can,
  consistencyChecks,
  GRADES,
  isGrade,
  isValidReviewNote,
  latestFiscalYears,
  overrideIssues,
  qualificationIssues,
  referenceAnnualRent,
  sniffMimeType,
  type AcceptedMimeType,
  type Assessment,
  type BusinessSector,
  type DocumentType,
  type EquipmentCategory,
  type EquipmentCondition,
  type Grade,
  type MemoStatus,
  type OverrideIssue,
  type Periodicity,
  type QualificationIssue,
  type RevenueBand,
} from "@leaseplace/domain";
import { aiProvider } from "../ai";
import { appDb } from "../db";
import { logger } from "../logger";
import { documentStorage } from "../storage";
import { actorFor, getViewer, type SpaceViewer } from "../viewer";
import {
  failedExtractions,
  latestAssessment,
  latestChecks,
  latestExtractions,
  memosOf,
  reviewCompany,
  reviewDocuments,
  reviewRequest,
  toDomainExtraction,
  type ReviewDocument,
  type ReviewRequest,
} from "./data";

const {
  financingRequests,
  documents,
  aiRuns,
  documentExtractions,
  kycChecks,
  riskAssessments,
  riskOverrides,
  creditMemos,
  memberships,
  users,
} = schema;

export class ReviewDenied extends Error {
  constructor() {
    super("Revue réservée à la plateforme");
    this.name = "ReviewDenied";
  }
}

/** Relecteur : équipe plateforme avec la permission kyc.review. */
export async function reviewerViewer(): Promise<SpaceViewer> {
  const viewer = await getViewer();
  const m = viewer?.membership;
  if (!viewer || !m || m.organizationType !== "platform" || !can(m.role, "kyc.review"))
    throw new ReviewDenied();
  return { ...viewer, membership: m };
}

async function inReview<T>(fn: (tx: Transaction, viewer: SpaceViewer) => Promise<T>): Promise<T> {
  const viewer = await reviewerViewer();
  return withActor(appDb(), await actorFor(viewer), (tx) => fn(tx, viewer));
}

const sha256 = (data: string | Uint8Array) => createHash("sha256").update(data).digest("hex");

async function setEventNote(tx: Transaction, note: string) {
  await tx.execute(sql`select set_config('app.event_note', ${note}, true)`);
}

// ── Analyse : extraction → contrôles → indice ──────────────────────────────

export type AnalysisResult =
  | { status: "analyzed"; extracted: number; failed: number }
  | { status: "forbidden" };

interface ExtractionOutcome {
  doc: ReviewDocument;
  meta: AiCallMeta | null;
  result: NormalizedExtraction | null;
  errorCode: string | null;
}

async function pool<T, R>(
  items: readonly T[],
  size: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const out: R[] = new Array<R>(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i] as T);
    }
  }
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, worker));
  return out;
}

async function extractOne(
  doc: ReviewDocument,
  demo: Parameters<ReturnType<typeof aiProvider>["extract"]>[0]["demo"],
): Promise<ExtractionOutcome> {
  try {
    const bytes = await documentStorage().get(doc.storageKey);
    const mimeType = bytes ? sniffMimeType(bytes) : null;
    if (!bytes || !mimeType) return { doc, meta: null, result: null, errorCode: "unreadable_file" };
    const { output, meta } = await aiProvider().extract({
      type: doc.type as DocumentType,
      mimeType: mimeType satisfies AcceptedMimeType,
      bytes,
      fileName: doc.originalName,
      demo,
    });
    return { doc, meta, result: normalizeExtraction(output), errorCode: null };
  } catch (error) {
    if (error instanceof AiError)
      return { doc, meta: error.meta, result: null, errorCode: error.code };
    logger.error({ err: error, documentId: doc.id }, "extraction de document");
    return { doc, meta: null, result: null, errorCode: "internal" };
  }
}

/**
 * Analyse d'une demande en revue. Les appels à l'IA se font HORS transaction
 * (durée), les écritures ensuite dans une seule transaction. `force` relance
 * l'extraction des documents déjà lus.
 */
export async function analyzeRequest(requestId: string, force = false): Promise<AnalysisResult> {
  const viewer = await reviewerViewer();
  const actor = await actorFor(viewer);
  const loaded = await withActor(appDb(), actor, async (tx) => {
    const request = await reviewRequest(tx, requestId);
    if (!request || request.status !== "in_review") return null;
    const company = await reviewCompany(tx, request.organizationId);
    if (!company) return null;
    const docs = await reviewDocuments(tx, request);
    const existing = await latestExtractions(
      tx,
      docs.map((d) => d.id),
    );
    const [owner] = await tx
      .select({ name: users.name })
      .from(memberships)
      .innerJoin(users, eq(users.id, memberships.userId))
      .where(
        and(
          eq(memberships.organizationId, request.organizationId),
          eq(memberships.role, "company_owner"),
        ),
      )
      .limit(1);
    return { request, company, docs, existing, ownerName: owner?.name ?? "" };
  });
  if (!loaded) return { status: "forbidden" };
  const { request, company, docs, existing, ownerName } = loaded;

  const toExtract = docs.filter(
    (d) => force || existing.get(d.id)?.promptVersion !== EXTRACTION_PROMPT_VERSION,
  );
  const demo = {
    legalName: company.legalName,
    ice: company.ice,
    rcNumber: company.rcNumber,
    city: company.city,
    revenueBand: company.revenueBand as RevenueBand | null,
    directorName: ownerName,
    requestAmountHt: request.amountHt,
    supplierName: request.supplierName,
    now: new Date(),
  };
  const outcomes = await pool(toExtract, 3, (doc) => extractOne(doc, demo));

  return withActor(appDb(), actor, async (tx) => {
    for (const o of outcomes) {
      const runId = randomUUID();
      await tx.insert(aiRuns).values({
        id: runId,
        purpose: "document_extraction",
        provider: o.meta?.provider ?? aiProvider().name,
        model: o.meta?.model ?? "inconnu",
        promptVersion: o.meta?.promptVersion ?? EXTRACTION_PROMPT_VERSION,
        organizationId: request.organizationId,
        requestId,
        documentId: o.doc.id,
        inputSha256: o.doc.sha256,
        status: o.result ? "succeeded" : "failed",
        errorCode: o.errorCode,
        inputTokens: o.meta?.usage.inputTokens ?? 0,
        outputTokens: o.meta?.usage.outputTokens ?? 0,
        durationMs: o.meta?.durationMs ?? 0,
        output: o.result ? { fields: o.result.fields, warnings: o.result.warnings } : null,
        createdBy: viewer.user.id,
      });
      if (!o.result) continue;
      await tx.insert(documentExtractions).values({
        id: randomUUID(),
        documentId: o.doc.id,
        organizationId: request.organizationId,
        aiRunId: runId,
        promptVersion: o.meta?.promptVersion ?? EXTRACTION_PROMPT_VERSION,
        readable: o.result.readable,
        fields: o.result.fields,
        sources: o.result.sources,
        warnings: o.result.matchesDeclaredType
          ? o.result.warnings
          : [...o.result.warnings, "Le document ne correspond pas au type déclaré."],
      });
      if (o.doc.reviewStatus === "pending") {
        await tx
          .update(documents)
          .set({ reviewStatus: "extracted" })
          .where(eq(documents.id, o.doc.id));
      }
    }
    await computeChecksAndScore(tx, viewer, request);
    // Un brouillon de note portait sur l'analyse précédente : il est écarté.
    await tx
      .update(creditMemos)
      .set({ status: "discarded", decidedBy: viewer.user.id })
      .where(and(eq(creditMemos.requestId, requestId), eq(creditMemos.status, "draft")));
    await recordAudit(tx, {
      action: "review.analyzed",
      entityType: "financing_request",
      entityId: requestId,
      metadata: {
        provider: aiProvider().name,
        extracted: outcomes.filter((o) => o.result).length,
        failed: outcomes.filter((o) => !o.result).length,
      },
    });
    return {
      status: "analyzed" as const,
      extracted: outcomes.filter((o) => o.result).length,
      failed: outcomes.filter((o) => !o.result).length,
    };
  });
}

async function computeChecksAndScore(tx: Transaction, viewer: SpaceViewer, request: ReviewRequest) {
  const company = await reviewCompany(tx, request.organizationId);
  if (!company) return;
  const docs = await reviewDocuments(tx, request);
  const extractions = await latestExtractions(
    tx,
    docs.map((d) => d.id),
  );
  const failed = await failedExtractions(tx, request.id);
  const readable = docs.flatMap((d) => {
    const row = extractions.get(d.id);
    return row?.readable ? [toDomainExtraction(d, row)] : [];
  });
  const unreadable = docs
    .filter((d) => failed.has(d.id) || extractions.get(d.id)?.readable === false)
    .map((d) => d.id);
  const now = new Date();
  const checks = consistencyChecks({
    now,
    company: {
      ice: company.ice,
      legalName: company.legalName,
      rcNumber: company.rcNumber,
      revenueBand: company.revenueBand as RevenueBand | null,
    },
    request: { amountHt: request.amountHt },
    extractions: readable,
    failedDocumentIds: unreadable,
  });
  const runId = randomUUID();
  for (const c of checks) {
    await tx.insert(kycChecks).values({
      id: randomUUID(),
      runId,
      organizationId: request.organizationId,
      requestId: request.id,
      code: c.code,
      status: c.status,
      documentIds: c.documentIds,
      expected: c.expected,
      found: c.found,
    });
  }

  const annualRentHt = referenceAnnualRent({
    amountHt: request.amountHt ?? 0,
    durationMonths: request.durationMonths ?? 60,
    periodicity: (request.periodicity ?? "monthly") as Periodicity,
    firstRentPct: request.firstRentPct ?? 0,
    residualPct: request.residualPct ?? 0,
  });
  const inputs = {
    now,
    incorporationDate: company.incorporationDate,
    sector: company.sector as BusinessSector,
    equipmentCategory: (request.equipmentCategory ?? "other") as EquipmentCategory,
    condition: (request.condition ?? "new") as EquipmentCondition,
    equipmentYear: request.equipmentYear,
    amountHt: request.amountHt ?? 0,
    annualRentHt,
    fiscalYears: latestFiscalYears(readable),
    consistencyFailures: checks.filter((c) => c.status === "fail").length,
  };
  const a: Assessment = assess(inputs);
  const assessmentId = randomUUID();
  await tx.insert(riskAssessments).values({
    id: assessmentId,
    requestId: request.id,
    organizationId: request.organizationId,
    modelVersion: a.modelVersion,
    inputs,
    ratios: a.ratios,
    factors: a.factors,
    flags: a.flags,
    score: a.score,
    grade: a.grade,
    uncappedGrade: a.uncappedGrade,
    checkRunId: runId,
    createdBy: viewer.user.id,
  });
  await recordAudit(tx, {
    action: "risk.assessed",
    entityType: "risk_assessment",
    entityId: assessmentId,
    metadata: {
      requestId: request.id,
      grade: a.grade,
      score: a.score,
      modelVersion: a.modelVersion,
    },
  });
}

// ── Prise en charge, compléments, qualification ────────────────────────────

export async function startReview(requestId: string): Promise<AnalysisResult> {
  const started = await inReview(async (tx) => {
    const request = await reviewRequest(tx, requestId);
    if (request?.status !== "submitted") return false;
    await tx
      .update(financingRequests)
      .set({ status: "in_review" })
      .where(eq(financingRequests.id, requestId));
    await recordAudit(tx, {
      action: "request.review_started",
      entityType: "financing_request",
      entityId: requestId,
    });
    return true;
  });
  return started ? analyzeRequest(requestId) : { status: "forbidden" };
}

export type NoteResult = { status: "done" } | { status: "invalid" } | { status: "forbidden" };

export async function requestInfo(requestId: string, note: string): Promise<NoteResult> {
  if (!isValidReviewNote(note)) return { status: "invalid" };
  return inReview(async (tx) => {
    const request = await reviewRequest(tx, requestId);
    if (request?.status !== "in_review") return { status: "forbidden" } as const;
    await setEventNote(tx, note.trim());
    await tx
      .update(financingRequests)
      .set({ status: "needs_info" })
      .where(eq(financingRequests.id, requestId));
    await recordAudit(tx, {
      action: "request.info_requested",
      entityType: "financing_request",
      entityId: requestId,
      metadata: { note: note.trim() },
    });
    return { status: "done" } as const;
  });
}

export type QualifyResult =
  | { status: "qualified" }
  | { status: "blocked"; issues: QualificationIssue[] }
  | { status: "forbidden" };

export async function qualifyRequest(
  requestId: string,
  anomaliesNote: string,
): Promise<QualifyResult> {
  return inReview(async (tx) => {
    const request = await reviewRequest(tx, requestId);
    if (request?.status !== "in_review") return { status: "forbidden" } as const;
    const assessment = await latestAssessment(tx, requestId);
    const checks = await latestChecks(tx, requestId);
    const memos = await memosOf(tx, requestId);
    // La note validée doit porter sur l'indice le plus récent.
    const approved = memos.some(
      (m) => m.status === "approved" && m.assessmentId === assessment?.row.id,
    );
    const issues = qualificationIssues({
      hasAssessment: assessment !== null,
      memoStatus: approved ? "approved" : ((memos[0]?.status as MemoStatus | undefined) ?? null),
      checkStatuses: checks.map((c) => c.status),
      anomaliesAcknowledged: isValidReviewNote(anomaliesNote),
    });
    if (issues.length > 0) return { status: "blocked", issues } as const;
    if (anomaliesNote.trim()) await setEventNote(tx, anomaliesNote.trim());
    await tx
      .update(financingRequests)
      .set({ status: "qualified" })
      .where(eq(financingRequests.id, requestId));
    await recordAudit(tx, {
      action: "request.qualified",
      entityType: "financing_request",
      entityId: requestId,
      metadata: { grade: assessment?.grade ?? null, anomaliesNote: anomaliesNote.trim() || null },
    });
    return { status: "qualified" } as const;
  });
}

// ── Indice : correction humaine motivée ────────────────────────────────────

export type OverrideResult =
  | { status: "done" }
  | { status: "invalid"; issues: OverrideIssue[] }
  | { status: "forbidden" };

export async function overrideGrade(
  assessmentId: string,
  grade: string,
  reason: string,
): Promise<OverrideResult> {
  if (!isGrade(grade)) return { status: "invalid", issues: ["same_grade"] };
  return inReview(async (tx, viewer) => {
    if (!can(viewer.membership.role, "score.override")) return { status: "forbidden" } as const;
    const [row] = await tx
      .select()
      .from(riskAssessments)
      .where(eq(riskAssessments.id, assessmentId));
    if (!row || !isGrade(row.grade)) return { status: "forbidden" } as const;
    const view = await latestAssessment(tx, row.requestId);
    const current: Grade = view?.row.id === row.id ? view.grade : row.grade;
    const issues = overrideIssues(current, grade, reason);
    if (issues.length > 0) return { status: "invalid", issues } as const;
    await tx.insert(riskOverrides).values({
      id: randomUUID(),
      assessmentId,
      grade,
      reason: reason.trim(),
      createdBy: viewer.user.id,
    });
    await recordAudit(tx, {
      action: "risk.overridden",
      entityType: "risk_assessment",
      entityId: assessmentId,
      before: { grade: current },
      after: { grade },
      metadata: { reason: reason.trim() },
    });
    return { status: "done" } as const;
  });
}

// ── Documents : vérifié ou rejeté par un humain ────────────────────────────

export async function reviewDocument(
  documentId: string,
  decision: "verified" | "rejected",
  note: string,
): Promise<NoteResult> {
  if (decision === "rejected" && !isValidReviewNote(note)) return { status: "invalid" };
  return inReview(async (tx) => {
    const updated = await tx
      .update(documents)
      .set({ reviewStatus: decision, reviewNote: note.trim() || null })
      .where(eq(documents.id, documentId))
      .returning({ id: documents.id });
    if (updated.length === 0) return { status: "forbidden" } as const;
    await recordAudit(tx, {
      action: "document.reviewed",
      entityType: "document",
      entityId: documentId,
      metadata: { decision, note: note.trim() || null },
    });
    return { status: "done" } as const;
  });
}

// ── Note de synthèse : générée, vérifiée, validée par un humain ────────────

export type MemoResult =
  | { status: "generated" }
  | { status: "rejected"; issues: MemoIssue[] }
  | { status: "failed"; code: string }
  | { status: "forbidden" };

export async function generateMemo(requestId: string): Promise<MemoResult> {
  const viewer = await reviewerViewer();
  const actor = await actorFor(viewer);
  const loaded = await withActor(appDb(), actor, async (tx) => {
    const request = await reviewRequest(tx, requestId);
    if (request?.status !== "in_review") return null;
    const company = await reviewCompany(tx, request.organizationId);
    const assessment = await latestAssessment(tx, requestId);
    if (!company || !assessment) return null;
    const docs = await reviewDocuments(tx, request);
    const extractions = await latestExtractions(
      tx,
      docs.map((d) => d.id),
    );
    const checks = await latestChecks(tx, requestId);
    return { request, company, assessment, docs, extractions, checks };
  });
  if (!loaded) return { status: "forbidden" };
  const { request, company, assessment, docs, extractions, checks } = loaded;
  const inputs = assessment.row.inputs as { annualRentHt?: number };
  const built = buildMemoFacts({
    now: new Date(),
    company: {
      legalName: company.legalName,
      legalForm: company.legalForm,
      sector: company.sector,
      city: company.city,
      incorporationDate: company.incorporationDate,
      revenueBand: company.revenueBand,
      headcountBand: company.headcountBand,
    },
    request: {
      equipmentCategory: request.equipmentCategory,
      condition: request.condition,
      equipmentYear: request.equipmentYear,
      description: request.equipmentDescription,
      supplierName: request.supplierName,
      amountHt: request.amountHt,
      durationMonths: request.durationMonths,
      firstRentPct: request.firstRentPct,
      residualPct: request.residualPct,
      periodicity: request.periodicity,
      referenceAnnualRentHt:
        inputs.annualRentHt === undefined ? null : Math.round(inputs.annualRentHt),
    },
    assessment: {
      modelVersion: assessment.row.modelVersion,
      ratios: assessment.row.ratios as Assessment["ratios"],
      factors: assessment.row.factors as Assessment["factors"],
      flags: assessment.row.flags as Assessment["flags"],
      score: assessment.row.score,
      grade: isGrade(assessment.row.grade) ? assessment.row.grade : "E",
      uncappedGrade: isGrade(assessment.row.uncappedGrade) ? assessment.row.uncappedGrade : "E",
    },
    effectiveGrade: assessment.grade,
    checks,
    documents: docs.flatMap((d) => {
      const row = extractions.get(d.id);
      return row?.readable ? [toDomainExtraction(d, row)] : [];
    }),
  });

  let outcome: {
    meta: AiCallMeta | null;
    output: unknown;
    issues: MemoIssue[];
    errorCode: string | null;
  };
  try {
    const { output, meta } = await aiProvider().writeMemo(built.facts);
    outcome = {
      meta,
      output,
      issues: verifyMemo(output, built.facts, built.sourceIds),
      errorCode: null,
    };
  } catch (error) {
    if (!(error instanceof AiError)) logger.error({ err: error, requestId }, "note de synthèse");
    outcome = {
      meta: error instanceof AiError ? error.meta : null,
      output: null,
      issues: [],
      errorCode: error instanceof AiError ? error.code : "internal",
    };
  }

  return withActor(appDb(), actor, async (tx) => {
    const runId = randomUUID();
    const ok = outcome.errorCode === null && outcome.issues.length === 0;
    await tx.insert(aiRuns).values({
      id: runId,
      purpose: "credit_memo",
      provider: outcome.meta?.provider ?? aiProvider().name,
      model: outcome.meta?.model ?? "inconnu",
      promptVersion: outcome.meta?.promptVersion ?? "memo-v1",
      organizationId: request.organizationId,
      requestId,
      inputSha256: sha256(JSON.stringify(built.facts)),
      status: outcome.errorCode ? "failed" : ok ? "succeeded" : "rejected",
      errorCode: outcome.errorCode,
      inputTokens: outcome.meta?.usage.inputTokens ?? 0,
      outputTokens: outcome.meta?.usage.outputTokens ?? 0,
      durationMs: outcome.meta?.durationMs ?? 0,
      output: outcome.output as object | null,
      issues: outcome.issues.length > 0 ? outcome.issues : null,
      createdBy: viewer.user.id,
    });
    if (outcome.errorCode) return { status: "failed", code: outcome.errorCode } as const;
    if (!ok) return { status: "rejected", issues: outcome.issues } as const;
    // Un seul brouillon à la fois : le précédent est écarté.
    await tx
      .update(creditMemos)
      .set({ status: "discarded", decidedBy: viewer.user.id })
      .where(and(eq(creditMemos.requestId, requestId), eq(creditMemos.status, "draft")));
    const memoId = randomUUID();
    await tx.insert(creditMemos).values({
      id: memoId,
      requestId,
      assessmentId: assessment.row.id,
      aiRunId: runId,
      content: outcome.output as object,
      sourceMap: built.documentIds,
      createdBy: viewer.user.id,
    });
    await recordAudit(tx, {
      action: "memo.generated",
      entityType: "credit_memo",
      entityId: memoId,
      metadata: { requestId, provider: outcome.meta?.provider ?? null },
    });
    return { status: "generated" } as const;
  });
}

export async function decideMemo(
  memoId: string,
  decision: "approved" | "discarded",
): Promise<NoteResult> {
  return inReview(async (tx, viewer) => {
    const updated = await tx
      .update(creditMemos)
      .set({ status: decision, decidedBy: viewer.user.id })
      .where(and(eq(creditMemos.id, memoId), eq(creditMemos.status, "draft")))
      .returning({ id: creditMemos.id, requestId: creditMemos.requestId });
    if (updated.length === 0) return { status: "forbidden" } as const;
    await recordAudit(tx, {
      action: decision === "approved" ? "memo.approved" : "memo.discarded",
      entityType: "credit_memo",
      entityId: memoId,
      metadata: { requestId: updated[0]?.requestId ?? null },
    });
    return { status: "done" } as const;
  });
}

export const OVERRIDE_GRADES = GRADES;
