import { describe, expect, it } from "vitest";
import {
  IMPERSONATION_MAX_MINUTES,
  impersonationExpiresAt,
  impersonationIssues,
  isImpersonationActive,
} from "./impersonation";

describe("accès support", () => {
  const base = {
    reason: "Ticket 1234 : le dirigeant ne voit pas son offre",
    targetOrganizationTypes: ["company"] as const,
    actorUserId: "a",
    targetUserId: "b",
  };

  it("motif suffisant, cible hors plateforme : accepté", () => {
    expect(impersonationIssues(base)).toEqual([]);
  });

  it("motif trop court, compte plateforme ou soi-même : refusé", () => {
    expect(
      impersonationIssues({
        ...base,
        reason: "  aide  ",
        targetOrganizationTypes: ["lessor", "platform"],
        targetUserId: "a",
      }),
    ).toEqual(["reason_too_short", "platform_target", "self"]);
  });

  it("30 minutes au plus, terminé dès la fin explicite", () => {
    const start = new Date("2026-10-26T10:00:00Z");
    const expiresAt = impersonationExpiresAt(start);
    expect(IMPERSONATION_MAX_MINUTES).toBe(30);
    expect(expiresAt.toISOString()).toBe("2026-10-26T10:30:00.000Z");
    expect(isImpersonationActive({ expiresAt, endedAt: null }, start)).toBe(true);
    expect(isImpersonationActive({ expiresAt, endedAt: null }, expiresAt)).toBe(false);
    expect(isImpersonationActive({ expiresAt, endedAt: start }, start)).toBe(false);
  });
});
