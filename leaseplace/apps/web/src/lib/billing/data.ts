import "server-only";
import { and, asc, desc, eq, inArray, ne, sql } from "drizzle-orm";
import { schema, type Transaction } from "@leaseplace/db";
import type { CommissionGrid, FunnelRow } from "@leaseplace/domain";

const {
  organizations,
  mandates,
  commissions,
  invoices,
  financingRequests,
  lessorAppetites,
  deals,
  offers,
  requestEvents,
  routingTargets,
} = schema;

export type MandateRow = typeof mandates.$inferSelect;
export type CommissionRow = typeof commissions.$inferSelect;
export type InvoiceRow = typeof invoices.$inferSelect;

export const gridOf = (m: { grid: unknown }) => m.grid as CommissionGrid;

export interface LessorOverview {
  id: string;
  name: string;
  mandate: MandateRow | null;
  appetiteActive: boolean | null;
  received: number;
  offers: number;
  activeDeals: number;
  productionHt: number;
}

/** Bailleurs : mandat en vigueur, appétit, volumes (lecture plateforme). */
export async function lessorsOverview(tx: Transaction): Promise<LessorOverview[]> {
  const orgs = await tx
    .select({ id: organizations.id, name: organizations.name })
    .from(organizations)
    .where(eq(organizations.type, "lessor"))
    .orderBy(asc(organizations.name));
  if (orgs.length === 0) return [];
  const ids = orgs.map((o) => o.id);
  const [current, appetites, received, offered, active] = await Promise.all([
    tx
      .select()
      .from(mandates)
      .where(and(inArray(mandates.lessorOrganizationId, ids), ne(mandates.status, "terminated")))
      .orderBy(desc(mandates.createdAt)),
    tx
      .select({ id: lessorAppetites.organizationId, active: lessorAppetites.active })
      .from(lessorAppetites),
    tx
      .select({ id: routingTargets.lessorOrganizationId, n: sql<number>`count(*)::int` })
      .from(routingTargets)
      .where(inArray(routingTargets.status, ["sent", "viewed", "offered", "declined"]))
      .groupBy(routingTargets.lessorOrganizationId),
    tx
      .select({ id: offers.lessorOrganizationId, n: sql<number>`count(*)::int` })
      .from(offers)
      .where(ne(offers.status, "withdrawn"))
      .groupBy(offers.lessorOrganizationId),
    tx
      .select({
        id: deals.lessorOrganizationId,
        n: sql<number>`count(*)::int`,
        amount: sql<number>`coalesce(sum(${deals.financedAmountHt}), 0)::float8`,
      })
      .from(deals)
      .where(eq(deals.status, "active"))
      .groupBy(deals.lessorOrganizationId),
  ]);
  const pick = <T extends { id: string }>(rows: T[], id: string) => rows.find((r) => r.id === id);
  return orgs.map((o) => ({
    ...o,
    // Mandat actif d'abord, sinon le plus récent non résilié (brouillon, suspendu).
    mandate:
      current.find((m) => m.lessorOrganizationId === o.id && m.status === "active") ??
      current.find((m) => m.lessorOrganizationId === o.id) ??
      null,
    appetiteActive: pick(appetites, o.id)?.active ?? null,
    received: pick(received, o.id)?.n ?? 0,
    offers: pick(offered, o.id)?.n ?? 0,
    activeDeals: pick(active, o.id)?.n ?? 0,
    productionHt: pick(active, o.id)?.amount ?? 0,
  }));
}

export async function lessorMandates(tx: Transaction, lessorId: string) {
  const [org] = await tx
    .select({ id: organizations.id, name: organizations.name, type: organizations.type })
    .from(organizations)
    .where(eq(organizations.id, lessorId));
  if (org?.type !== "lessor") return null;
  const rows = await tx
    .select()
    .from(mandates)
    .where(eq(mandates.lessorOrganizationId, lessorId))
    .orderBy(desc(mandates.createdAt));
  return { org, mandates: rows };
}

export interface CommissionView extends CommissionRow {
  reference: string;
  lessorName: string;
  invoice: InvoiceRow | null;
}

/** Commissions visibles (plateforme : toutes ; administrateur bailleur : les siennes). */
export async function listCommissions(
  tx: Transaction,
  lessorId?: string,
): Promise<CommissionView[]> {
  const rows = await tx
    .select({
      c: commissions,
      reference: financingRequests.reference,
      lessorName: organizations.name,
      invoice: invoices,
    })
    .from(commissions)
    .innerJoin(financingRequests, eq(financingRequests.id, commissions.requestId))
    .innerJoin(organizations, eq(organizations.id, commissions.lessorOrganizationId))
    .leftJoin(invoices, eq(invoices.id, commissions.invoiceId))
    .where(lessorId ? eq(commissions.lessorOrganizationId, lessorId) : undefined)
    .orderBy(desc(commissions.activatedOn), desc(commissions.createdAt));
  return rows.map((r) => ({
    ...r.c,
    reference: r.reference,
    lessorName: r.lessorName,
    invoice: r.invoice,
  }));
}

export async function activeMandateOf(tx: Transaction, lessorId: string) {
  const [m] = await tx
    .select()
    .from(mandates)
    .where(and(eq(mandates.lessorOrganizationId, lessorId), eq(mandates.status, "active")));
  return m ?? null;
}

export interface KpiData {
  funnel: FunnelRow[];
  offersPerRequest: { routed: boolean; offers: number }[];
  savings: { offerCosts: number[]; acceptedCost: number }[];
  productionHt: number;
  activeDeals: number;
  commissions: { status: string; amountHt: number }[];
}

/** Données du tableau de bord interne : passages d'étapes, offres, opérations. */
export async function kpiData(tx: Transaction): Promise<KpiData> {
  const [events, offerRows, active, commissionRows] = await Promise.all([
    tx
      .select({
        requestId: requestEvents.requestId,
        toStatus: requestEvents.toStatus,
        at: sql<Date>`min(${requestEvents.occurredAt})`,
      })
      .from(requestEvents)
      .where(
        inArray(requestEvents.toStatus, [
          "submitted",
          "qualified",
          "routed",
          "accepted",
          "financed",
        ]),
      )
      .groupBy(requestEvents.requestId, requestEvents.toStatus),
    tx
      .select({
        requestId: offers.requestId,
        status: offers.status,
        cost: offers.financingCostHt,
        createdAt: offers.createdAt,
      })
      .from(offers)
      .where(ne(offers.status, "withdrawn")),
    tx
      .select({
        n: sql<number>`count(*)::int`,
        amount: sql<number>`coalesce(sum(${deals.financedAmountHt}), 0)::float8`,
      })
      .from(deals)
      .where(eq(deals.status, "active")),
    tx.select({ status: commissions.status, amountHt: commissions.amountHt }).from(commissions),
  ]);
  const byRequest = new Map<string, Partial<Record<string, Date>>>();
  for (const e of events) {
    const r = byRequest.get(e.requestId) ?? {};
    r[e.toStatus] = new Date(e.at);
    byRequest.set(e.requestId, r);
  }
  const offersOf = new Map<string, typeof offerRows>();
  for (const o of offerRows) offersOf.set(o.requestId, [...(offersOf.get(o.requestId) ?? []), o]);
  const funnel: FunnelRow[] = [...byRequest].map(([id, r]) => {
    const first = (offersOf.get(id) ?? [])
      .map((o) => o.createdAt)
      .sort((a, b) => a.getTime() - b.getTime())[0];
    return {
      submitted: r.submitted ?? null,
      qualified: r.qualified ?? null,
      routed: r.routed ?? null,
      firstOffer: first ?? null,
      accepted: r.accepted ?? null,
      financed: r.financed ?? null,
    };
  });
  const savings = [...offersOf.values()].flatMap((list) => {
    const accepted = list.find((o) => o.status === "accepted");
    return accepted ? [{ offerCosts: list.map((o) => o.cost), acceptedCost: accepted.cost }] : [];
  });
  return {
    funnel,
    offersPerRequest: [...byRequest].map(([id, r]) => ({
      routed: Boolean(r.routed),
      offers: offersOf.get(id)?.length ?? 0,
    })),
    savings,
    productionHt: active[0]?.amount ?? 0,
    activeDeals: active[0]?.n ?? 0,
    commissions: commissionRows,
  };
}
