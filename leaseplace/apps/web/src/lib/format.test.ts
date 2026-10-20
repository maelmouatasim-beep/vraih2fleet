import { describe, expect, it } from "vitest";
import { formatDate, formatDateTime } from "./format";

describe("formats", () => {
  it("jj/mm/aaaa dans le fuseau de Casablanca", () => {
    // 23 h 30 UTC le 31/12 → 00 h 30 le 01/01 à Casablanca (UTC+1).
    const d = new Date("2026-12-31T23:30:00Z");
    expect(formatDate(d)).toBe("01/01/2027");
    expect(formatDateTime(d)).toBe("01/01/2027 00:30");
  });
});
