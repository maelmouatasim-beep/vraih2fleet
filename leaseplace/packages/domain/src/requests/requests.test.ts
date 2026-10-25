import { describe, expect, it } from "vitest";
import {
  draftIssues,
  formatRequestReference,
  requestMachine,
  isEditableRequestStatus,
  resumeStep,
  submissionIssues,
  type RequestDraft,
} from "./requests";

const now = new Date("2026-10-24T00:00:00Z");
const complete: RequestDraft = {
  equipmentCategory: "truck",
  equipmentDescription: "Tracteur routier 440 ch, Euro 6",
  condition: "new",
  amountHt: 1_200_000,
  firstRentPct: 10,
  durationMonths: 60,
  residualPct: 1,
  periodicity: "monthly",
};
const ctx = { hasQuote: true, kycComplete: true, consentGiven: true, now };

describe("cycle de vie", () => {
  it("brouillon → soumise → en revue → qualifiée ; jamais de retour en brouillon", () => {
    expect(requestMachine.next("draft", "submit")).toBe("submitted");
    expect(requestMachine.next("submitted", "start_review")).toBe("in_review");
    expect(requestMachine.next("in_review", "qualify")).toBe("qualified");
    expect(requestMachine.next("submitted", "cancel")).toBe("cancelled");
    expect(requestMachine.can("submitted", "submit")).toBe(false);
    expect(requestMachine.can("cancelled", "cancel")).toBe(false);
    expect(requestMachine.can("qualified", "request_info")).toBe(false);
    expect(requestMachine.edges()).toEqual([
      ["draft", "submitted"],
      ["draft", "cancelled"],
      ["submitted", "in_review"],
      ["submitted", "cancelled"],
      ["in_review", "needs_info"],
      ["in_review", "qualified"],
      ["in_review", "cancelled"],
      ["needs_info", "submitted"],
      ["needs_info", "cancelled"],
      ["qualified", "cancelled"],
    ]);
  });
  it("compléments demandés : la demande redevient modifiable puis se resoumet", () => {
    expect(requestMachine.next("in_review", "request_info")).toBe("needs_info");
    expect(requestMachine.next("needs_info", "submit")).toBe("submitted");
    expect(isEditableRequestStatus("needs_info")).toBe(true);
    expect(isEditableRequestStatus("draft")).toBe(true);
    expect(isEditableRequestStatus("submitted")).toBe(false);
    expect(isEditableRequestStatus("in_review")).toBe(false);
  });
});

describe("soumission", () => {
  it("brouillon complet + devis + KYC + consentement : aucune objection", () => {
    expect(submissionIssues(complete, ctx)).toEqual([]);
  });
  it("brouillon vide : tous les champs signalés, reprise à l'équipement", () => {
    const issues = submissionIssues(
      {},
      { ...ctx, hasQuote: false, kycComplete: false, consentGiven: false },
    );
    expect(issues).toEqual([
      "equipment_category_missing",
      "description_invalid",
      "condition_missing",
      "amount_invalid",
      "periodicity_missing",
      "duration_invalid",
      "first_rent_invalid",
      "residual_invalid",
      "quote_missing",
      "kyc_incomplete",
      "consent_missing",
    ]);
    expect(resumeStep(issues)).toBe("equipment");
  });
  it("occasion : année obligatoire et plausible", () => {
    expect(draftIssues({ ...complete, condition: "used" }, now)).toContain("year_invalid");
    expect(draftIssues({ ...complete, condition: "used", equipmentYear: 2028 }, now)).toContain(
      "year_invalid",
    );
    expect(draftIssues({ ...complete, condition: "used", equipmentYear: 2019 }, now)).toEqual([]);
  });
  it("durée entière, dans les bornes, multiple de la période", () => {
    expect(
      draftIssues({ ...complete, durationMonths: 62, periodicity: "quarterly" }, now),
    ).toContain("duration_invalid");
    expect(draftIssues({ ...complete, durationMonths: 60, periodicity: "quarterly" }, now)).toEqual(
      [],
    );
    expect(draftIssues({ ...complete, durationMonths: 60.5 }, now)).toContain("duration_invalid");
    expect(draftIssues({ ...complete, durationMonths: 120 }, now)).toContain("duration_invalid");
  });
  it("montants hors bornes ou non finis", () => {
    expect(draftIssues({ ...complete, amountHt: 10_000 }, now)).toContain("amount_invalid");
    expect(draftIssues({ ...complete, amountHt: Number.NaN }, now)).toContain("amount_invalid");
    expect(draftIssues({ ...complete, firstRentPct: 45, residualPct: -1 }, now)).toEqual([
      "first_rent_invalid",
      "residual_invalid",
    ]);
  });
  it("reprise : étape des documents, du consentement, puis récapitulatif", () => {
    expect(resumeStep(submissionIssues(complete, { ...ctx, hasQuote: false }))).toBe("documents");
    expect(resumeStep(submissionIssues(complete, { ...ctx, consentGiven: false }))).toBe("consent");
    expect(resumeStep([])).toBe("review");
  });
  it("référence", () => {
    expect(formatRequestReference(2026, 123)).toBe("LP-2026-000123");
  });
});
