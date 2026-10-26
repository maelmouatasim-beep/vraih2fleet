import { describe, expect, it } from "vitest";
import { DEAL_STATUSES } from "../deals/deals";
import { REQUEST_STATUSES } from "../requests/requests";
import {
  ERASURE_BLOCKING_DEAL_STATUSES,
  ERASURE_BLOCKING_REQUEST_STATUSES,
  RETENTION_KEYS,
  RETENTION_RULES,
  effectiveRetention,
  erasedEmail,
  erasureIssues,
  isRetentionKey,
  privacyRequestMachine,
  privacyResponseDueOn,
  retentionCutoff,
  retentionIssues,
} from "./privacy";

describe("demande d'effacement", () => {
  it("une demande en attente est traitée, refusée ou retirée, une seule fois", () => {
    expect(privacyRequestMachine.next("pending", "complete")).toBe("completed");
    expect(privacyRequestMachine.next("pending", "reject")).toBe("rejected");
    expect(privacyRequestMachine.next("pending", "cancel")).toBe("cancelled");
    for (const s of ["completed", "rejected", "cancelled"] as const)
      expect(privacyRequestMachine.can(s, "complete")).toBe(false);
  });

  it("réponse attendue sous 30 jours", () => {
    expect(privacyResponseDueOn(new Date("2026-10-01T10:00:00Z")).toISOString()).toBe(
      "2026-10-31T10:00:00.000Z",
    );
  });

  it("bloquée tant qu'un dossier ou une opération est en cours", () => {
    expect(erasureIssues({ requestStatuses: ["draft", "cancelled"], dealStatuses: [] })).toEqual(
      [],
    );
    expect(erasureIssues({ requestStatuses: ["routed"], dealStatuses: ["signed"] })).toEqual([
      "requests_in_progress",
      "deals_in_progress",
    ]);
    // Contrat en loyer ou annulé : l'effacement reste possible (la trace légale est conservée).
    expect(
      erasureIssues({ requestStatuses: ["financed"], dealStatuses: ["active", "cancelled"] }),
    ).toEqual([]);
  });

  it("les statuts bloquants sont des statuts connus", () => {
    for (const s of ERASURE_BLOCKING_REQUEST_STATUSES) expect(REQUEST_STATUSES).toContain(s);
    for (const s of ERASURE_BLOCKING_DEAL_STATUSES) expect(DEAL_STATUSES).toContain(s);
  });

  it("adresse de remplacement unique et non routable", () => {
    expect(erasedEmail("abc")).toBe("efface-abc@leaseplace.invalid");
  });
});

describe("conservation", () => {
  it("chaque règle a un défaut compris entre ses bornes", () => {
    for (const k of RETENTION_KEYS) {
      const r = RETENTION_RULES[k];
      expect(r.minDays).toBeLessThanOrEqual(r.defaultDays);
      expect(r.defaultDays).toBeLessThanOrEqual(r.maxDays);
      expect(retentionIssues(k, r.defaultDays)).toEqual([]);
    }
  });

  it("réglage refusé hors bornes, non entier ou inconnu", () => {
    expect(isRetentionKey("audit")).toBe(false);
    expect(retentionIssues("audit", 10)).toEqual(["unknown_rule"]);
    expect(retentionIssues("read_notifications", 10.5)).toEqual(["not_integer"]);
    expect(retentionIssues("read_notifications", 29)).toEqual(["below_minimum"]);
    expect(retentionIssues("read_notifications", 731)).toEqual(["above_maximum"]);
  });

  it("durées effectives : réglage valide, sinon défaut", () => {
    const eff = effectiveRetention([
      { key: "outbox_messages", days: 7 },
      { key: "read_notifications", days: 5 },
      { key: "unknown", days: 3 },
    ]);
    expect(eff.outbox_messages).toBe(7);
    expect(eff.read_notifications).toBe(RETENTION_RULES.read_notifications.defaultDays);
    expect(eff.marketing_leads).toBe(RETENTION_RULES.marketing_leads.defaultDays);
  });

  it("date limite = maintenant moins la durée", () => {
    expect(retentionCutoff(30, new Date("2026-10-31T00:00:00Z")).toISOString()).toBe(
      "2026-10-01T00:00:00.000Z",
    );
  });
});
