import type { OrganizationType } from "../rbac/roles";

/**
 * Accès « en tant que » du support : lecture seule, motivé, limité dans le
 * temps, tracé au journal (début et fin). Jamais sur un compte de la
 * plateforme ; aucune pièce ni facture n'est téléchargeable pendant l'accès.
 */
export const IMPERSONATION_MAX_MINUTES = 30;
export const IMPERSONATION_REASON_MIN = 15;

export type ImpersonationIssue = "reason_too_short" | "platform_target" | "self";

export function impersonationIssues(input: {
  reason: string;
  targetOrganizationTypes: readonly OrganizationType[];
  actorUserId: string;
  targetUserId: string;
}): ImpersonationIssue[] {
  const issues: ImpersonationIssue[] = [];
  if (input.reason.trim().length < IMPERSONATION_REASON_MIN) issues.push("reason_too_short");
  if (input.targetOrganizationTypes.includes("platform")) issues.push("platform_target");
  if (input.actorUserId === input.targetUserId) issues.push("self");
  return issues;
}

export function impersonationExpiresAt(startedAt: Date): Date {
  return new Date(startedAt.getTime() + IMPERSONATION_MAX_MINUTES * 60_000);
}

export function isImpersonationActive(
  row: { expiresAt: Date; endedAt: Date | null },
  now: Date,
): boolean {
  return row.endedAt === null && row.expiresAt.getTime() > now.getTime();
}
