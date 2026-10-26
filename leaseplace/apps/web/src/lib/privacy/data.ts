import "server-only";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { schema, type Transaction } from "@leaseplace/db";
import {
  effectiveRetention,
  erasureIssues,
  type ErasureIssue,
  type RetentionKey,
} from "@leaseplace/domain";

const { privacyRequests, retentionSettings, financingRequests, deals, organizations, users } =
  schema;

export type PrivacyRequestRow = typeof privacyRequests.$inferSelect;

/** État des droits pour l'entreprise : demande en cours, historique, obstacles. */
export async function companyPrivacy(tx: Transaction, organizationId: string) {
  const [history, requestStatuses, dealStatuses] = await Promise.all([
    tx
      .select()
      .from(privacyRequests)
      .where(eq(privacyRequests.organizationId, organizationId))
      .orderBy(desc(privacyRequests.requestedAt)),
    tx
      .select({ status: financingRequests.status })
      .from(financingRequests)
      .where(eq(financingRequests.organizationId, organizationId)),
    tx
      .select({ status: deals.status })
      .from(deals)
      .where(eq(deals.companyOrganizationId, organizationId)),
  ]);
  return {
    pending: history.find((r) => r.status === "pending") ?? null,
    history,
    issues: erasureIssues({
      requestStatuses: requestStatuses.map((r) => r.status),
      dealStatuses: dealStatuses.map((d) => d.status),
    }),
  };
}

export interface AdminPrivacyRow extends PrivacyRequestRow {
  organizationName: string;
  requesterName: string;
  issues: ErasureIssue[];
}

/** File des demandes (administrateurs) avec les obstacles de chacune. */
export async function privacyQueue(tx: Transaction): Promise<AdminPrivacyRow[]> {
  const rows = await tx
    .select({ r: privacyRequests, organizationName: organizations.name, requesterName: users.name })
    .from(privacyRequests)
    .innerJoin(organizations, eq(organizations.id, privacyRequests.organizationId))
    .innerJoin(users, eq(users.id, privacyRequests.requestedBy))
    .orderBy(desc(privacyRequests.requestedAt))
    .limit(200);
  const pendingOrgs = rows.filter((x) => x.r.status === "pending").map((x) => x.r.organizationId);
  const [reqs, dls] = pendingOrgs.length
    ? await Promise.all([
        tx
          .select({ org: financingRequests.organizationId, status: financingRequests.status })
          .from(financingRequests)
          .where(inArray(financingRequests.organizationId, pendingOrgs)),
        tx
          .select({ org: deals.companyOrganizationId, status: deals.status })
          .from(deals)
          .where(inArray(deals.companyOrganizationId, pendingOrgs)),
      ])
    : [[], []];
  return rows.map(({ r, organizationName, requesterName }) => ({
    ...r,
    organizationName,
    requesterName,
    issues:
      r.status === "pending"
        ? erasureIssues({
            requestStatuses: reqs.filter((x) => x.org === r.organizationId).map((x) => x.status),
            dealStatuses: dls.filter((x) => x.org === r.organizationId).map((x) => x.status),
          })
        : [],
  }));
}

export async function retentionOverview(tx: Transaction): Promise<{
  days: Record<RetentionKey, number>;
  saved: Set<string>;
  lastRun: { at: Date; result: Record<string, number> } | null;
}> {
  const saved = await tx.select().from(retentionSettings);
  const [last] = await tx
    .select({ at: schema.auditEvents.occurredAt, metadata: schema.auditEvents.metadata })
    .from(schema.auditEvents)
    .where(and(eq(schema.auditEvents.action, "retention.applied")))
    .orderBy(desc(schema.auditEvents.id))
    .limit(1);
  return {
    days: effectiveRetention(saved),
    saved: new Set(saved.map((s) => s.key)),
    lastRun: last ? { at: last.at, result: (last.metadata ?? {}) as Record<string, number> } : null,
  };
}

/** Nombre de demandes d'effacement en attente (vue d'ensemble). */
export async function pendingPrivacyCount(tx: Transaction): Promise<number> {
  const [row] = await tx
    .select({ n: sql<number>`count(*)::int` })
    .from(privacyRequests)
    .where(eq(privacyRequests.status, "pending"));
  return row?.n ?? 0;
}
