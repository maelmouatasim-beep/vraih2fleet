import "server-only";
import { and, desc, eq, inArray } from "drizzle-orm";
import { schema, type Transaction } from "@leaseplace/db";
import { isGrade, RECEIVED_TARGET_STATUSES, type Grade } from "@leaseplace/domain";
import { latestAssessment } from "../review/data";

const {
  routingTargets,
  financingRequests,
  organizations,
  companies,
  offers,
  targetDeclines,
  creditMemos,
  lessorAppetites,
} = schema;

export interface InboxRow {
  targetId: string;
  status: string;
  sentAt: Date | null;
  slaDueAt: Date | null;
  respondedAt: Date | null;
  firstViewedAt: Date | null;
  reference: string;
  companyName: string;
  sector: string | null;
  city: string | null;
  equipmentCategory: string | null;
  amountHt: number | null;
  durationMonths: number | null;
  requestId: string;
}

/** Dossiers reçus par l'organisation du bailleur (la RLS ne laisse voir que les siens). */
export async function lessorInbox(tx: Transaction, lessorOrgId: string): Promise<InboxRow[]> {
  return tx
    .select({
      targetId: routingTargets.id,
      status: routingTargets.status,
      sentAt: routingTargets.sentAt,
      slaDueAt: routingTargets.slaDueAt,
      respondedAt: routingTargets.respondedAt,
      firstViewedAt: routingTargets.firstViewedAt,
      reference: financingRequests.reference,
      companyName: organizations.name,
      sector: companies.sector,
      city: companies.city,
      equipmentCategory: financingRequests.equipmentCategory,
      amountHt: financingRequests.amountHt,
      durationMonths: financingRequests.durationMonths,
      requestId: financingRequests.id,
    })
    .from(routingTargets)
    .innerJoin(financingRequests, eq(financingRequests.id, routingTargets.requestId))
    .innerJoin(organizations, eq(organizations.id, financingRequests.organizationId))
    .innerJoin(companies, eq(companies.organizationId, financingRequests.organizationId))
    .where(
      and(
        eq(routingTargets.lessorOrganizationId, lessorOrgId),
        inArray(routingTargets.status, [...RECEIVED_TARGET_STATUSES]),
      ),
    )
    .orderBy(desc(routingTargets.sentAt));
}

/** Indice retenu (avec corrections humaines) de chaque demande visible. */
export async function gradesOf(
  tx: Transaction,
  requestIds: readonly string[],
): Promise<Map<string, Grade>> {
  const out = new Map<string, Grade>();
  for (const id of requestIds) {
    const a = await latestAssessment(tx, id);
    if (a && isGrade(a.grade)) out.set(id, a.grade);
  }
  return out;
}

export async function lessorTarget(tx: Transaction, targetId: string) {
  const [target] = await tx.select().from(routingTargets).where(eq(routingTargets.id, targetId));
  if (!target) return null;
  const [request] = await tx
    .select()
    .from(financingRequests)
    .where(eq(financingRequests.id, target.requestId));
  if (!request) return null;
  const [company] = await tx
    .select()
    .from(companies)
    .where(eq(companies.organizationId, request.organizationId));
  const [org] = await tx
    .select()
    .from(organizations)
    .where(eq(organizations.id, request.organizationId));
  const [memo] = await tx
    .select()
    .from(creditMemos)
    .where(and(eq(creditMemos.requestId, request.id), eq(creditMemos.status, "approved")))
    .orderBy(desc(creditMemos.createdAt))
    .limit(1);
  // Offre en cours, acceptée ou non retenue (jamais une offre retirée).
  const [offer] = await tx
    .select()
    .from(offers)
    .where(
      and(
        eq(offers.targetId, targetId),
        inArray(offers.status, ["submitted", "accepted", "not_retained"]),
      ),
    )
    .orderBy(desc(offers.createdAt))
    .limit(1);
  const [decline] = await tx
    .select()
    .from(targetDeclines)
    .where(eq(targetDeclines.targetId, targetId));
  return {
    target,
    request,
    company: company ?? null,
    companyName: org?.name ?? "",
    memo: memo ?? null,
    offer: offer ?? null,
    decline: decline ?? null,
  };
}

export async function appetiteOf(tx: Transaction, lessorOrgId: string) {
  const [row] = await tx
    .select()
    .from(lessorAppetites)
    .where(eq(lessorAppetites.organizationId, lessorOrgId));
  return row ?? null;
}

/** Indicateurs du tableau de bord : volumes, taux de réponse, délai moyen. */
export function lessorStats(rows: readonly InboxRow[], now: Date) {
  const responded = rows.filter((r) => r.respondedAt !== null);
  const pending = rows.filter((r) => r.status === "sent" || r.status === "viewed");
  const delays = responded.flatMap((r) =>
    r.sentAt && r.respondedAt ? [(r.respondedAt.getTime() - r.sentAt.getTime()) / 3_600_000] : [],
  );
  const recent = rows.filter(
    (r) => r.sentAt && now.getTime() - r.sentAt.getTime() <= 30 * 86_400_000,
  );
  return {
    received: rows.length,
    received30d: recent.length,
    pending: pending.length,
    overdue: pending.filter((r) => r.slaDueAt !== null && r.slaDueAt < now).length,
    offered: rows.filter((r) => r.status === "offered").length,
    declined: rows.filter((r) => r.status === "declined").length,
    responseRate: rows.length === 0 ? null : responded.length / rows.length,
    averageDelayHours:
      delays.length === 0 ? null : delays.reduce((s, d) => s + d, 0) / delays.length,
  };
}
