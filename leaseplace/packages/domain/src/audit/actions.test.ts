import { describe, expect, it } from "vitest";
import { AUDIT_ACTIONS, isAuditAction, isWellFormedAuditAction } from "./actions";

describe("catalogue d'audit", () => {
  it("toutes les actions respectent objet.action en snake_case", () => {
    for (const a of AUDIT_ACTIONS) expect(isWellFormedAuditAction(a)).toBe(true);
    expect(new Set(AUDIT_ACTIONS).size).toBe(AUDIT_ACTIONS.length);
  });

  it("rejette les formes invalides", () => {
    expect(isWellFormedAuditAction("Auth.SignIn")).toBe(false);
    expect(isWellFormedAuditAction("auth")).toBe(false);
    expect(isWellFormedAuditAction("auth.sign-in")).toBe(false);
  });

  it("reconnaît les actions du catalogue", () => {
    expect(isAuditAction("auth.sign_in")).toBe(true);
    expect(isAuditAction("auth.hack")).toBe(false);
    expect(isAuditAction(undefined)).toBe(false);
  });
});
