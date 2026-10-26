import "server-only";
import { randomUUID } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { headers } from "next/headers";
import { recordAudit, schema, withActor } from "@leaseplace/db";
import {
  can,
  impersonationExpiresAt,
  impersonationIssues,
  isOrganizationType,
  type ImpersonationIssue,
} from "@leaseplace/domain";
import { getAuth } from "../auth";
import { appDb, authDb } from "../db";
import { requestContext } from "../request";
import { getViewer } from "../viewer";

const { impersonations, memberships, organizations } = schema;

export type SupportResult =
  | { status: "done" }
  | { status: "invalid"; issues: ImpersonationIssue[] }
  | { status: "forbidden" };

/**
 * Ouvre un accès support sur le compte d'un client (lecture seule,
 * 30 minutes, motif obligatoire), tracé au journal sous l'identité de
 * l'agent. La base vérifie à nouveau rôle, session et cible.
 */
export async function startSupportAccess(
  targetUserId: string,
  organizationId: string,
  reason: string,
): Promise<SupportResult> {
  const viewer = await getViewer();
  const m = viewer?.membership;
  if (!viewer || !m || viewer.impersonation || !can(m.role, "user.impersonate"))
    return { status: "forbidden" };
  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session) return { status: "forbidden" };
  const targetTypes = (
    await authDb()
      .select({ type: organizations.type })
      .from(memberships)
      .innerJoin(organizations, eq(organizations.id, memberships.organizationId))
      .where(eq(memberships.userId, targetUserId))
  ).flatMap((r) => (isOrganizationType(r.type) ? [r.type] : []));
  const issues = impersonationIssues({
    reason,
    targetOrganizationTypes: targetTypes,
    actorUserId: viewer.user.id,
    targetUserId,
  });
  if (issues.length > 0) return { status: "invalid", issues };
  const ctx = await requestContext();
  const id = randomUUID();
  const now = new Date();
  await withActor(
    appDb(),
    {
      userId: viewer.user.id,
      organizationId: m.organizationId,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    },
    async (tx) => {
      await tx.insert(impersonations).values({
        id,
        actorUserId: viewer.user.id,
        actorSessionId: session.session.id,
        targetUserId,
        targetOrganizationId: organizationId,
        reason: reason.trim(),
        startedAt: now,
        expiresAt: impersonationExpiresAt(now),
      });
      await recordAudit(tx, {
        action: "support.impersonation_started",
        entityType: "impersonation",
        entityId: id,
        metadata: { targetUserId, organizationId, reason: reason.trim() },
      });
    },
  );
  return { status: "done" };
}

/** Termine l'accès en cours ; écrit sous l'identité de l'agent (hors lecture seule). */
export async function endSupportAccess(): Promise<void> {
  const viewer = await getViewer();
  const access = viewer?.impersonation;
  if (!access) return;
  const ctx = await requestContext();
  await withActor(
    appDb(),
    { userId: access.actorUserId, ip: ctx.ip, userAgent: ctx.userAgent },
    async (tx) => {
      const ended = await tx
        .update(impersonations)
        .set({ endedAt: new Date() })
        .where(and(eq(impersonations.id, access.id), isNull(impersonations.endedAt)))
        .returning({ id: impersonations.id });
      if (ended.length > 0)
        await recordAudit(tx, {
          action: "support.impersonation_ended",
          entityType: "impersonation",
          entityId: access.id,
        });
    },
  );
}
