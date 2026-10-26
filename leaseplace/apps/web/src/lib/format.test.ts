import { describe, expect, it } from "vitest";
import {
  formatDate,
  formatDateTime,
  formatMad,
  formatNumber,
  formatPercent,
  isoDay,
  ltr,
  parseAmount,
} from "./format";

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

describe("montants et pourcentages", () => {
  it("format MAD", () => {
    expect(formatMad(1_250_000)).toBe("1 250 000,00 DH");
    expect(formatMad(999.995)).toBe("1 000,00 DH");
    expect(formatMad(-42.5)).toBe("−42,50 DH");
    expect(formatMad(-0.001)).toBe("0,00 DH");
    expect(formatMad(15_553.11, 0)).toBe("15 553 DH");
    expect(formatNumber(84)).toBe("84");
  });
  it("pourcentages", () => {
    expect(formatPercent(0.094764)).toBe("9,48 %");
    expect(formatPercent(0.2, 0)).toBe("20 %");
  });
  it("saisie des montants", () => {
    expect(parseAmount("1 250 000")).toBe(1_250_000);
    expect(parseAmount("1 250 000,50 DH")).toBe(1_250_000.5);
    expect(parseAmount("850000.75")).toBe(850_000.75);
    expect(parseAmount("12a")).toBeNull();
    expect(parseAmount("")).toBeNull();
  });
});

describe("isolat bidi", () => {
  it("encadre le texte par LRI et PDI", () => {
    expect(ltr("12 DH")).toBe("⁦12 DH⁩");
  });
});

describe("isoDay", () => {
  it("jour à Casablanca, au format des champs date, cohérent avec l'affichage", () => {
    expect(isoDay(new Date("2026-10-26T10:00:00Z"))).toBe("2026-10-26");
    // Autour de minuit UTC, le jour dépend du fuseau : même jour que formatDate.
    for (const iso of ["2026-10-26T23:30:00Z", "2026-03-01T00:30:00Z"]) {
      const d = new Date(iso);
      const [dd, mm, yyyy] = formatDate(d).split("/");
      expect(isoDay(d)).toBe(`${yyyy ?? ""}-${mm ?? ""}-${dd ?? ""}`);
    }
  });
});
