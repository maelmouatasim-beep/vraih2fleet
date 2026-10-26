import { describe, expect, it } from "vitest";
import {
  clampMaxTargets,
  declineIssues,
  exclusionsOf,
  rotationKey,
  routeRequest,
  selectionIssues,
  slaDueAt,
  slaState,
  targetMachine,
  type Appetite,
  type RoutingProfile,
} from "./routing";

const profile: RoutingProfile = {
  requestId: "req-1",
  amountHt: 1_000_000,
  durationMonths: 60,
  sector: "transport",
  category: "truck",
  grade: "B",
};

const open = (lessorId: string, over: Partial<Appetite> = {}): Appetite => ({
  lessorId,
  mandated: true,
  active: true,
  minAmountHt: 100_000,
  maxAmountHt: 5_000_000,
  minDurationMonths: 24,
  maxDurationMonths: 84,
  sectors: [],
  categories: [],
  minGrade: "C",
  ...over,
});

describe("critères d'appétit", () => {
  it("un appétit ouvert accepte le dossier", () => {
    expect(exclusionsOf(profile, open("a"))).toEqual([]);
  });
  it("chaque critère manqué est motivé", () => {
    expect(
      exclusionsOf(
        profile,
        open("a", {
          mandated: false,
          active: false,
          minAmountHt: 2_000_000,
          minDurationMonths: 72,
          sectors: ["health"],
          categories: ["medical"],
          minGrade: "A",
        }),
      ),
    ).toEqual([
      "no_mandate",
      "inactive",
      "amount_below_min",
      "duration_out_of_range",
      "sector_excluded",
      "category_excluded",
      "grade_below_min",
    ]);
    expect(
      exclusionsOf(profile, open("a", { maxAmountHt: 500_000, maxDurationMonths: 48 })),
    ).toEqual(["amount_above_max", "duration_out_of_range"]);
  });
  it("secteur et catégorie listés : acceptés", () => {
    expect(
      exclusionsOf(
        profile,
        open("a", { sectors: ["transport"], categories: ["truck", "trailer"] }),
      ),
    ).toEqual([]);
  });
});

describe("orientation", () => {
  const appetites = ["l1", "l2", "l3", "l4", "l5", "l6"].map((id) => open(id));

  it("rotation équitable et reproductible, présélection limitée", () => {
    const a = routeRequest(profile, [...appetites, open("ferme", { active: false })], 4);
    const b = routeRequest(profile, [...appetites].reverse(), 4);
    expect(a.filter((c) => c.eligible).map((c) => c.lessorId)).toEqual(b.map((c) => c.lessorId));
    expect(a.filter((c) => c.proposed)).toHaveLength(4);
    expect(a.at(-1)).toMatchObject({
      lessorId: "ferme",
      eligible: false,
      rank: null,
      proposed: false,
      exclusions: ["inactive"],
    });
    expect(a.slice(0, 6).map((c) => c.rank)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("la rotation change d'une demande à l'autre", () => {
    const orders = ["r1", "r2", "r3", "r4", "r5"].map(
      (requestId) => routeRequest({ ...profile, requestId }, appetites)[0]?.lessorId,
    );
    expect(new Set(orders).size).toBeGreaterThan(1);
  });

  it("limite entre 3 et 5", () => {
    expect(clampMaxTargets(1)).toBe(3);
    expect(clampMaxTargets(9)).toBe(5);
    expect(clampMaxTargets(4.4)).toBe(4);
    expect(routeRequest(profile, appetites).filter((c) => c.proposed)).toHaveLength(4);
  });

  it("empreinte stable", () => {
    expect(rotationKey("a", "b")).toBe(rotationKey("a", "b"));
    expect(rotationKey("a", "b")).not.toBe(rotationKey("b", "a"));
  });

  it("choix de l'entreprise : au moins un, au plus la limite, éligibles seulement", () => {
    const c = routeRequest(profile, [...appetites, open("ferme", { active: false })], 3);
    expect(selectionIssues(c, [], 3)).toEqual(["none_selected"]);
    expect(selectionIssues(c, ["l1", "l2", "l3", "l4"], 3)).toEqual(["too_many"]);
    expect(selectionIssues(c, ["ferme"], 3)).toEqual(["not_eligible"]);
    expect(selectionIssues(c, ["l1", "l1", "l2"], 3)).toEqual([]);
  });
});

describe("transmission à un bailleur", () => {
  it("envoyé → consulté → offre ; retrait de l'offre ; refus définitif", () => {
    expect(targetMachine.next("eligible", "send")).toBe("sent");
    expect(targetMachine.next("sent", "view")).toBe("viewed");
    expect(targetMachine.next("viewed", "offer")).toBe("offered");
    expect(targetMachine.next("offered", "withdraw")).toBe("viewed");
    expect(targetMachine.next("sent", "decline")).toBe("declined");
    expect(targetMachine.can("declined", "offer")).toBe(false);
    expect(targetMachine.can("excluded", "send")).toBe(false);
  });

  it("délai de 72 heures", () => {
    const sent = new Date("2026-10-26T08:00:00Z");
    const due = slaDueAt(sent);
    expect(due.toISOString()).toBe("2026-10-29T08:00:00.000Z");
    expect(slaState(due, new Date("2026-10-28T09:30:00Z"))).toEqual({
      hoursLeft: 22,
      overdue: false,
    });
    expect(slaState(due, new Date("2026-10-29T10:00:00Z"))).toEqual({
      hoursLeft: -2,
      overdue: true,
    });
  });

  it("refus motivé", () => {
    expect(declineIssues("asset_risk", "")).toEqual([]);
    expect(declineIssues("other", "court")).toEqual(["note_required"]);
    expect(declineIssues("other", "Hors zone géographique couverte")).toEqual([]);
    expect(declineIssues("n_importe", "")).toEqual(["reason_invalid"]);
  });
});
