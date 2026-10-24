/**
 * Catalogue des actions auditées (`objet.action`). Une action absente de
 * ce catalogue est refusée par `audit.record` côté base : la liste SQL est
 * générée depuis celle-ci et vérifiée par un test.
 */
export const AUDIT_ACTIONS = [
  "auth.sign_in",
  "auth.sign_out",
  "auth.two_factor_enabled",
  "auth.two_factor_disabled",
  "organization.switched",
  "space.access_denied",
  "company.created",
  "company.updated",
  "document.uploaded",
  "document.deleted",
  "document.downloaded",
  "request.created",
  "request.submitted",
  "request.cancelled",
  "consent.granted",
  "consent.revoked",
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export function isAuditAction(value: unknown): value is AuditAction {
  return typeof value === "string" && (AUDIT_ACTIONS as readonly string[]).includes(value);
}

const ACTION_PATTERN = /^[a-z]+(?:_[a-z]+)*\.[a-z]+(?:_[a-z]+)*$/;

/** Convention de nommage `objet.action`, en snake_case. */
export function isWellFormedAuditAction(value: string): boolean {
  return ACTION_PATTERN.test(value);
}
