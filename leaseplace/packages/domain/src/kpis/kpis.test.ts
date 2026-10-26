import { describe, expect, it } from "vitest";
import {
  funnel,
  mean,
  median,
  medianHoursToFirstOffer,
  offersPerRoutedRequest,
  savingsOf,
  type FunnelRow,
} from "./kpis";

const d = (h: number) => new Date(Date.UTC(2026, 9, 1, h));
const row = (over: Partial<FunnelRow>): FunnelRow => ({
  submitted: null,
  qualified: null,
  routed: null,
  firstOffer: null,
  accepted: null,
  financed: null,
  ...over,
});

describe("entonnoir", () => {
  it("compte chaque étape et les taux de passage", () => {
    const rows = [
      row({
        submitted: d(0),
        qualified: d(1),
        routed: d(2),
        firstOffer: d(20),
        accepted: d(30),
        financed: d(90),
      }),
      row({ submitted: d(0), qualified: d(1), routed: d(2), firstOffer: d(50) }),
      row({ submitted: d(0), qualified: d(3) }),
      row({ submitted: d(0) }),
    ];
    const f = funnel(rows);
    expect(f.map((s) => s.count)).toEqual([4, 3, 2, 2, 1, 1]);
    expect(f[0]).toMatchObject({ fromPrevious: null, fromStart: 1 });
    expect(f[2]?.fromPrevious).toBeCloseTo(2 / 3);
    expect(f[5]?.fromStart).toBe(0.25);
    expect(medianHoursToFirstOffer(rows)).toBe(33);
  });
  it("vide : aucun taux", () => {
    expect(funnel([]).every((s) => s.count === 0 && s.fromStart === null)).toBe(true);
    expect(funnel([row({ qualified: d(1) })])[1]?.fromPrevious).toBeNull();
    expect(medianHoursToFirstOffer([])).toBeNull();
  });
});

describe("statistiques", () => {
  it("médiane et moyenne", () => {
    expect(median([])).toBeNull();
    expect(median([5, 1, 3])).toBe(3);
    expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(mean([])).toBeNull();
    expect(mean([1, 2, 6])).toBe(3);
  });
  it("offres par dossier transmis", () => {
    expect(offersPerRoutedRequest([])).toBeNull();
    expect(
      offersPerRoutedRequest([
        { routed: true, offers: 3 },
        { routed: true, offers: 1 },
        { routed: false, offers: 0 },
      ]),
    ).toBe(2);
  });
  it("économie : coût moyen des autres offres moins l'offre acceptée", () => {
    expect(savingsOf([300, 320, 340], 300)).toBe(30);
    expect(savingsOf([300], 300)).toBeNull();
    expect(savingsOf([310, 330], 300)).toBe(20);
  });
});
