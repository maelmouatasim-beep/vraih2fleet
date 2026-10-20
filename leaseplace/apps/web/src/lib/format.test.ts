import { describe, expect, it } from "vitest";
import { formatDate, formatDateTime } from "./format";

// Le décalage de Casablanca vient des données tz du runtime (tzdata 2025b :
// UTC+1 ; 2026c : UTC+0). Le test ne fige donc aucun décalage : il compare à
// l'heure locale de Casablanca calculée par Intl.
function casablanca(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Casablanca",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return { y: get("year"), m: get("month"), d: get("day"), h: get("hour"), min: get("minute") };
}

describe("formats", () => {
  it("jj/mm/aaaa en milieu de journée", () => {
    const d = new Date("2026-03-05T12:00:00Z");
    expect(formatDate(d)).toBe("05/03/2026");
  });

  it("date et heure dans le fuseau de Casablanca, y compris autour de minuit", () => {
    for (const iso of ["2026-12-31T23:30:00Z", "2027-01-01T00:30:00Z", "2026-06-15T23:59:00Z"]) {
      const d = new Date(iso);
      const c = casablanca(d);
      expect(formatDate(d)).toBe(`${c.d}/${c.m}/${c.y}`);
      expect(formatDateTime(d)).toBe(`${c.d}/${c.m}/${c.y} ${c.h}:${c.min}`);
    }
  });
});
