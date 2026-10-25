import { describe, expect, it } from "vitest";
import { isValidReviewNote, memoTransitionAllowed, qualificationIssues } from "./review";

describe("qualification", () => {
  it("exige un indice, une note validée et des anomalies examinées", () => {
    expect(
      qualificationIssues({
        hasAssessment: false,
        memoStatus: "draft",
        checkStatuses: ["pass", "fail"],
        anomaliesAcknowledged: false,
      }),
    ).toEqual(["assessment_missing", "memo_not_approved", "failed_checks_unacknowledged"]);
  });
  it("dossier prêt", () => {
    expect(
      qualificationIssues({
        hasAssessment: true,
        memoStatus: "approved",
        checkStatuses: ["fail"],
        anomaliesAcknowledged: true,
      }),
    ).toEqual([]);
    expect(
      qualificationIssues({
        hasAssessment: true,
        memoStatus: "approved",
        checkStatuses: ["pass", "warn"],
        anomaliesAcknowledged: false,
      }),
    ).toEqual([]);
  });
});

describe("note de synthèse", () => {
  it("un brouillon est approuvé ou écarté, une seule fois", () => {
    expect(memoTransitionAllowed("draft", "approved")).toBe(true);
    expect(memoTransitionAllowed("draft", "discarded")).toBe(true);
    expect(memoTransitionAllowed("draft", "draft")).toBe(false);
    expect(memoTransitionAllowed("approved", "discarded")).toBe(false);
  });
  it("motif de revue : 10 caractères au moins", () => {
    expect(isValidReviewNote("  trop court ")).toBe(true);
    expect(isValidReviewNote(" court ")).toBe(false);
  });
});
