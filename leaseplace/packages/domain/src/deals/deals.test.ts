import { describe, expect, it } from "vitest";
import {
  COMPANY_CANCEL_REASONS,
  DEAL_CANCEL_REASONS,
  LESSOR_CANCEL_REASONS,
  TRACKER_STEPS,
  dealCancelIssues,
  dealMachine,
  dealStepIssues,
  isLiveDeal,
  nextDealStep,
  requestTracker,
} from "./deals";

const d = (iso: string) => new Date(`${iso}T10:00:00Z`);
const today = d("2026-11-20");
const dates = {
  acceptedAt: d("2026-11-01"),
  signedOn: d("2026-11-05"),
  deliveredOn: d("2026-11-12"),
};

describe("opération", () => {
  it("signature → livraison → mise en loyer ; annulation possible avant la mise en loyer", () => {
    expect(dealMachine.edges()).toEqual([
      ["accepted", "signed"],
      ["accepted", "cancelled"],
      ["signed", "delivered"],
      ["signed", "cancelled"],
      ["delivered", "active"],
      ["delivered", "cancelled"],
    ]);
    expect(isLiveDeal("accepted")).toBe(true);
    expect(isLiveDeal("active")).toBe(true);
    expect(isLiveDeal("cancelled")).toBe(false);
  });

  it("prochaine étape à constater", () => {
    expect(nextDealStep("accepted")).toBe("sign");
    expect(nextDealStep("signed")).toBe("deliver");
    expect(nextDealStep("delivered")).toBe("activate");
    expect(nextDealStep("active")).toBeNull();
    expect(nextDealStep("cancelled")).toBeNull();
  });

  it("étape à une date passée, jamais avant l'étape précédente", () => {
    expect(
      dealStepIssues({ status: "accepted", step: "sign", on: d("2026-11-01"), dates }, today),
    ).toEqual([]);
    expect(
      dealStepIssues({ status: "signed", step: "deliver", on: d("2026-11-05"), dates }, today),
    ).toEqual([]);
    expect(
      dealStepIssues(
        { status: "delivered", step: "activate", on: today, dates, financedAmountHt: 640_000 },
        today,
      ),
    ).toEqual([]);
    expect(
      dealStepIssues({ status: "accepted", step: "sign", on: d("2026-10-30"), dates }, today),
    ).toEqual(["date_before_previous"]);
    expect(
      dealStepIssues({ status: "signed", step: "deliver", on: d("2026-11-04"), dates }, today),
    ).toEqual(["date_before_previous"]);
    expect(
      dealStepIssues({ status: "delivered", step: "activate", on: d("2026-11-21"), dates }, today),
    ).toEqual(["date_in_future"]);
    expect(
      dealStepIssues(
        {
          status: "delivered",
          step: "activate",
          on: today,
          dates: { ...dates, deliveredOn: null },
          financedAmountHt: 0,
        },
        today,
      ),
    ).toEqual(["amount_invalid"]);
    expect(
      dealStepIssues(
        { status: "active", step: "activate", on: today, dates, financedAmountHt: Number.NaN },
        today,
      ),
    ).toEqual(["transition_invalid", "amount_invalid"]);
    expect(
      dealStepIssues({ status: "accepted", step: "deliver", on: today, dates }, today),
    ).toEqual(["transition_invalid"]);
  });

  it("annulation : l'entreprise avant signature seulement, motifs par partie", () => {
    expect(DEAL_CANCEL_REASONS).toEqual([
      ...LESSOR_CANCEL_REASONS,
      ...COMPANY_CANCEL_REASONS.filter((r) => r !== "other"),
    ]);
    expect(
      dealCancelIssues({
        status: "accepted",
        side: "company",
        reason: "project_abandoned",
        note: "",
      }),
    ).toEqual([]);
    expect(
      dealCancelIssues({
        status: "signed",
        side: "company",
        reason: "project_abandoned",
        note: "",
      }),
    ).toEqual(["transition_invalid"]);
    expect(
      dealCancelIssues({ status: "delivered", side: "lessor", reason: "credit_refused", note: "" }),
    ).toEqual([]);
    expect(
      dealCancelIssues({ status: "active", side: "lessor", reason: "credit_refused", note: "" }),
    ).toEqual(["transition_invalid"]);
    expect(
      dealCancelIssues({ status: "accepted", side: "company", reason: "credit_refused", note: "" }),
    ).toEqual(["reason_invalid"]);
    expect(
      dealCancelIssues({ status: "accepted", side: "lessor", reason: "other", note: "court" }),
    ).toEqual(["note_required"]);
    expect(
      dealCancelIssues({
        status: "accepted",
        side: "lessor",
        reason: "other",
        note: "Fournisseur en liquidation",
      }),
    ).toEqual([]);
  });
});

describe("suivi type colis", () => {
  const states = (input: Parameters<typeof requestTracker>[0]) =>
    requestTracker(input).map((s) => s.state);

  it("aucune étape pour un brouillon ou une demande annulée", () => {
    expect(requestTracker({ requestStatus: "draft", offerCount: 0, dealStatus: null })).toEqual([]);
    expect(requestTracker({ requestStatus: "cancelled", offerCount: 0, dealStatus: null })).toEqual(
      [],
    );
  });

  it("chaque statut fait avancer le suivi d'une étape", () => {
    const cases: [Parameters<typeof requestTracker>[0], number][] = [
      [{ requestStatus: "submitted", offerCount: 0, dealStatus: null }, 0],
      [{ requestStatus: "in_review", offerCount: 0, dealStatus: null }, 0],
      [{ requestStatus: "needs_info", offerCount: 0, dealStatus: null }, 0],
      [{ requestStatus: "qualified", offerCount: 0, dealStatus: null }, 1],
      [{ requestStatus: "routed", offerCount: 0, dealStatus: null }, 2],
      [{ requestStatus: "routed", offerCount: 2, dealStatus: null }, 3],
      [{ requestStatus: "accepted", offerCount: 2, dealStatus: "accepted" }, 4],
      [{ requestStatus: "accepted", offerCount: 2, dealStatus: "signed" }, 5],
      [{ requestStatus: "accepted", offerCount: 2, dealStatus: "delivered" }, 6],
      [{ requestStatus: "financed", offerCount: 2, dealStatus: "active" }, 7],
    ];
    for (const [input, reached] of cases) {
      const s = states(input);
      expect(s).toHaveLength(TRACKER_STEPS.length);
      expect(s.filter((x) => x === "done")).toHaveLength(reached + 1);
      expect(s.filter((x) => x === "current")).toHaveLength(reached === 7 ? 0 : 1);
    }
    expect(requestTracker({ requestStatus: "routed", offerCount: 1, dealStatus: null })[4]).toEqual(
      {
        step: "accepted",
        state: "current",
      },
    );
  });
});
