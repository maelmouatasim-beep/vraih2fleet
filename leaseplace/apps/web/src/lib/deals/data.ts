import "server-only";
import { and, asc, desc, eq, inArray, ne } from "drizzle-orm";
import { schema, type Transaction } from "@leaseplace/db";
import { isLiveDeal, type DealStatus } from "@leaseplace/domain";

const { offers, organizations, deals, dealEvents, financingRequests, routingTargets } = schema;

export type OfferRow = typeof offers.$inferSelect & { lessorName: string };
export type DealRow = typeof deals.$inferSelect;
export type DealEventRow = typeof dealEvents.$inferSelect;

/** Offres d'une demande vues par l'entreprise (la RLS écarte les offres retirées). */
export async function requestOffers(tx: Transaction, requestId: string): Promise<OfferRow[]> {
  return tx
    .select({ offer: offers, lessorName: organizations.name })
    .from(offers)
    .innerJoin(organizations, eq(organizations.id, offers.lessorOrganizationId))
    .where(and(eq(offers.requestId, requestId), ne(offers.status, "withdrawn")))
    .orderBy(asc(offers.createdAt))
    .then((rows) => rows.map((r) => ({ ...r.offer, lessorName: r.lessorName })));
}

export interface DealView {
  deal: DealRow;
  lessorName: string;
  events: DealEventRow[];
}

/** Opération en cours d'une demande, sinon la dernière annulée, avec son historique. */
export async function dealOfRequest(
  tx: Transaction,
  requestId: string,
  lessorOrganizationId?: string,
): Promise<DealView | null> {
  const rows = await tx
    .select({ deal: deals, lessorName: organizations.name })
    .from(deals)
    .innerJoin(organizations, eq(organizations.id, deals.lessorOrganizationId))
    .where(
      lessorOrganizationId
        ? and(eq(deals.requestId, requestId), eq(deals.lessorOrganizationId, lessorOrganizationId))
        : eq(deals.requestId, requestId),
    )
    .orderBy(desc(deals.acceptedAt));
  const chosen = rows.find((r) => isLiveDeal(r.deal.status)) ?? rows[0];
  if (!chosen) return null;
  const events = await tx
    .select()
    .from(dealEvents)
    .where(eq(dealEvents.dealId, chosen.deal.id))
    .orderBy(asc(dealEvents.id));
  return { ...chosen, events };
}

export interface PipelineRow {
  dealId: string;
  status: DealStatus;
  reference: string;
  requestId: string;
  targetId: string | null;
  companyName: string;
  financedAmountHt: number;
  acceptedAt: Date;
  signedOn: Date | null;
  deliveredOn: Date | null;
  activatedOn: Date | null;
  cancelledAt: Date | null;
}

/** Opérations du bailleur (pipeline), les plus récentes d'abord. */
export async function lessorPipeline(
  tx: Transaction,
  lessorOrganizationId: string,
): Promise<PipelineRow[]> {
  const rows = await tx
    .select({
      deal: deals,
      reference: financingRequests.reference,
      companyName: organizations.name,
    })
    .from(deals)
    .innerJoin(financingRequests, eq(financingRequests.id, deals.requestId))
    .innerJoin(organizations, eq(organizations.id, deals.companyOrganizationId))
    .where(eq(deals.lessorOrganizationId, lessorOrganizationId))
    .orderBy(desc(deals.acceptedAt));
  const targets =
    rows.length === 0
      ? []
      : await tx
          .select({ id: routingTargets.id, requestId: routingTargets.requestId })
          .from(routingTargets)
          .where(
            and(
              eq(routingTargets.lessorOrganizationId, lessorOrganizationId),
              inArray(
                routingTargets.requestId,
                rows.map((r) => r.deal.requestId),
              ),
            ),
          );
  const targetOf = new Map(targets.map((t) => [t.requestId, t.id]));
  return rows.map(({ deal, reference, companyName }) => ({
    dealId: deal.id,
    status: deal.status as DealStatus,
    reference,
    requestId: deal.requestId,
    targetId: targetOf.get(deal.requestId) ?? null,
    companyName,
    financedAmountHt: deal.financedAmountHt,
    acceptedAt: deal.acceptedAt,
    signedOn: deal.signedOn,
    deliveredOn: deal.deliveredOn,
    activatedOn: deal.activatedOn,
    cancelledAt: deal.cancelledAt,
  }));
}
