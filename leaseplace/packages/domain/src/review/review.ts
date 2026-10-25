import type { CheckStatus } from "../kyc/consistency";

/**
 * Revue d'un dossier par la plateforme (phase 5). La plateforme vérifie et
 * oriente ; elle ne décide jamais du crédit. Un dossier n'est « qualifié »
 * (prêt à être orienté vers les bailleurs) qu'avec un indice calculé, une
 * note de synthèse validée par un humain et des anomalies examinées.
 */
export const MEMO_STATUSES = ["draft", "approved", "discarded"] as const;
export type MemoStatus = (typeof MEMO_STATUSES)[number];

/** Une note brouillon est approuvée ou écartée, une seule fois. */
export function memoTransitionAllowed(from: MemoStatus, to: MemoStatus): boolean {
  return from === "draft" && (to === "approved" || to === "discarded");
}

export const DOCUMENT_REVIEW_STATUSES = ["pending", "extracted", "verified", "rejected"] as const;
export type DocumentReviewStatus = (typeof DOCUMENT_REVIEW_STATUSES)[number];

export const AI_RUN_PURPOSES = ["document_extraction", "credit_memo"] as const;
export type AiRunPurpose = (typeof AI_RUN_PURPOSES)[number];
export const AI_RUN_STATUSES = ["succeeded", "failed", "rejected"] as const;
export type AiRunStatus = (typeof AI_RUN_STATUSES)[number];

export const QUALIFICATION_ISSUES = [
  "assessment_missing",
  "memo_not_approved",
  "failed_checks_unacknowledged",
] as const;
export type QualificationIssue = (typeof QUALIFICATION_ISSUES)[number];

export interface QualificationContext {
  hasAssessment: boolean;
  memoStatus: MemoStatus | null;
  checkStatuses: readonly CheckStatus[];
  /** Le relecteur a examiné et commenté les anomalies. */
  anomaliesAcknowledged: boolean;
}

export function qualificationIssues(ctx: QualificationContext): QualificationIssue[] {
  const issues: QualificationIssue[] = [];
  if (!ctx.hasAssessment) issues.push("assessment_missing");
  if (ctx.memoStatus !== "approved") issues.push("memo_not_approved");
  if (ctx.checkStatuses.includes("fail") && !ctx.anomaliesAcknowledged) {
    issues.push("failed_checks_unacknowledged");
  }
  return issues;
}

/** Motif minimal d'une demande de compléments ou d'un examen d'anomalies. */
export const MIN_REVIEW_NOTE = 10;

export function isValidReviewNote(note: string): boolean {
  return note.trim().length >= MIN_REVIEW_NOTE;
}
