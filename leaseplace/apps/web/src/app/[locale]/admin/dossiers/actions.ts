"use server";

import { revalidatePath } from "next/cache";
import {
  analyzeRequest,
  decideMemo,
  generateMemo,
  overrideGrade,
  qualifyRequest,
  requestInfo,
  reviewDocument,
  startReview,
  type AnalysisResult,
  type MemoResult,
  type NoteResult,
  type OverrideResult,
  type QualifyResult,
} from "@/lib/review/actions";

const refresh = () => {
  revalidatePath("/[locale]/admin", "layout");
};

export async function startReviewAction(requestId: string): Promise<AnalysisResult> {
  const r = await startReview(requestId);
  refresh();
  return r;
}

export async function analyzeAction(requestId: string): Promise<AnalysisResult> {
  const r = await analyzeRequest(requestId, true);
  refresh();
  return r;
}

export async function generateMemoAction(requestId: string): Promise<MemoResult> {
  const r = await generateMemo(requestId);
  refresh();
  return r;
}

export async function decideMemoAction(
  memoId: string,
  decision: "approved" | "discarded",
): Promise<NoteResult> {
  const r = await decideMemo(memoId, decision);
  refresh();
  return r;
}

export async function overrideGradeAction(
  assessmentId: string,
  grade: string,
  reason: string,
): Promise<OverrideResult> {
  const r = await overrideGrade(assessmentId, grade, reason);
  refresh();
  return r;
}

export async function reviewDocumentAction(
  documentId: string,
  decision: "verified" | "rejected",
  note: string,
): Promise<NoteResult> {
  const r = await reviewDocument(documentId, decision, note);
  refresh();
  return r;
}

export async function requestInfoAction(requestId: string, note: string): Promise<NoteResult> {
  const r = await requestInfo(requestId, note);
  refresh();
  return r;
}

export async function qualifyAction(requestId: string, note: string): Promise<QualifyResult> {
  const r = await qualifyRequest(requestId, note);
  refresh();
  return r;
}
