import "server-only";
import { randomUUID } from "node:crypto";
import { and, eq, ne } from "drizzle-orm";
import { recordAudit, schema, withActor } from "@leaseplace/db";
import {
  acceptanceIssues,
  can,
  dealCancelIssues,
  dealStepIssues,
  isLiveDeal,
  type AcceptanceIssue,
  type DealCancelIssue,
  type DealSide,
  type DealStatus,
  type DealStep,
  type DealStepIssue,
} from "@leaseplace/domain";
import { companyViewer, pgCode } from "../company-actions";
import { appDb } from "../db";
import { isoDay } from "../format";
import { lessorViewer } from "../lessor/actions";
import { notify } from "../notify";
import { actorFor, type SpaceViewer } from "../viewer";
import { amountBand, track } from "../analytics";

const { offers, deals, financingRequests, routingTargets } = schema;

export type AcceptResult =
  | { status: "accepted" }
  | { status: "invalid"; issues: AcceptanceIssue[] }
  | { status: "forbidden" };

/**
 * Acceptation d'une offre par le dirigeant : accord de principe, la décision
 * de crédit reste au bailleur. La base crée l'opération, met les autres
 * offres de côté et fait passer la demande en « offre acceptée ».
 */
export async function acceptOffer(offerId: string): Promise<AcceptResult> {
  const viewer = await companyViewer();
  if (!can(viewer.membership.role, "offer.accept")) return { status: "forbidden" };
  const actor = await actorFor(viewer);
  let outcome;
  try {
    outcome = await withActor(appDb(), actor, async (tx) => {
      const [offer] = await tx.select().from(offers).where(eq(offers.id, offerId));
      if (!offer) return { status: "forbidden" } as const;
      const [request] = await tx
        .select()
        .from(financingRequests)
        .where(eq(financingRequests.id, offer.requestId));
      if (request?.organizationId !== viewer.membership.organizationId)
        return { status: "forbidden" } as const;
      const live = await tx
        .select({ id: deals.id })
        .from(deals)
        .where(and(eq(deals.requestId, request.id), ne(deals.status, "cancelled")));
      const issues = acceptanceIssues(
        {
          offerStatus: offer.status,
          validUntil: offer.validUntil,
          requestStatus: request.status,
          hasLiveDeal: live.length > 0,
        },
        new Date(),
      );
      if (issues.length > 0) return { status: "invalid", issues } as const;
      const others = await tx
        .select({ lessorId: offers.lessorOrganizationId })
        .from(offers)
        .where(
          and(
            eq(offers.requestId, request.id),
            eq(offers.status, "submitted"),
            ne(offers.id, offer.id),
          ),
        );
      const dealId = randomUUID();
      await tx.insert(deals).values({
        id: dealId,
        requestId: request.id,
        offerId: offer.id,
        companyOrganizationId: request.organizationId,
        lessorOrganizationId: offer.lessorOrganizationId,
        financedAmountHt: offer.financedAmountHt,
        acceptedBy: viewer.user.id,
      });
      await recordAudit(tx, {
        action: "offer.accepted",
        entityType: "offer",
        entityId: offer.id,
        metadata: {
          dealId,
          requestId: request.id,
          financingCostHt: offer.financingCostHt,
          effectiveRate: offer.effectiveRate,
        },
      });
      track("offer_accepted", request.organizationId, { offers: others.length + 1 });
      const targets = await tx
        .select({ id: routingTargets.id, lessorId: routingTargets.lessorOrganizationId })
        .from(routingTargets)
        .where(eq(routingTargets.requestId, request.id));
      return {
        status: "accepted",
        reference: request.reference,
        winner: offer.lessorOrganizationId,
        others: others.map((o) => o.lessorId),
        targetOf: new Map(targets.map((t) => [t.lessorId, t.id])),
      } as const;
    });
  } catch (error) {
    const code = pgCode(error);
    if (code === "23505" || code === "23514") return { status: "invalid", issues: ["deal_exists"] };
    throw error;
  }
  if (outcome.status !== "accepted") return outcome;
  const path = (lessorId: string) => `/bailleur/dossiers/${outcome.targetOf.get(lessorId) ?? ""}`;
  await notify("offer_accepted", outcome.winner, {
    reference: outcome.reference,
    path: path(outcome.winner),
  });
  for (const lessorId of outcome.others)
    await notify("offer_not_retained", lessorId, {
      reference: outcome.reference,
      path: path(lessorId),
    });
  return { status: "accepted" };
}

export type DealResult =
  | { status: "done" }
  | { status: "invalid"; issues: (DealStepIssue | DealCancelIssue)[] }
  | { status: "forbidden" };

async function loadDeal(viewer: SpaceViewer, dealId: string) {
  return withActor(appDb(), await actorFor(viewer), async (tx) => {
    const [deal] = await tx.select().from(deals).where(eq(deals.id, dealId));
    if (!deal) return null;
    const [request] = await tx
      .select({ reference: financingRequests.reference })
      .from(financingRequests)
      .where(eq(financingRequests.id, deal.requestId));
    const [target] = await tx
      .select({ id: routingTargets.id })
      .from(routingTargets)
      .where(
        and(
          eq(routingTargets.requestId, deal.requestId),
          eq(routingTargets.lessorOrganizationId, deal.lessorOrganizationId),
        ),
      );
    return { deal, reference: request?.reference ?? "", targetId: target?.id ?? "" };
  });
}

const STEP_STATUS: Record<DealStep, DealStatus> = {
  sign: "signed",
  deliver: "delivered",
  activate: "active",
};
const STEP_FIELD = { sign: "signedOn", deliver: "deliveredOn", activate: "activatedOn" } as const;
const STEP_AUDIT = {
  sign: "deal.signed",
  deliver: "deal.delivered",
  activate: "deal.activated",
} as const;
const STEP_NOTIFICATION = {
  sign: "deal_signed",
  deliver: "deal_delivered",
  activate: "deal_activated",
} as const;

/** Étape constatée par le bailleur, à une date passée (et montant définitif à la mise en loyer). */
export async function recordDealStep(
  dealId: string,
  step: DealStep,
  onIso: string,
  financedAmountHt?: number,
): Promise<DealResult> {
  const viewer = await lessorViewer();
  if (!can(viewer.membership.role, "deal.manage") || !/^\d{4}-\d{2}-\d{2}$/.test(onIso))
    return { status: "forbidden" };
  const loaded = await loadDeal(viewer, dealId);
  if (!loaded || loaded.deal.lessorOrganizationId !== viewer.membership.organizationId)
    return { status: "forbidden" };
  const { deal } = loaded;
  const on = new Date(`${onIso}T00:00:00Z`);
  const issues = dealStepIssues(
    {
      status: deal.status as DealStatus,
      step,
      on,
      dates: {
        acceptedAt: deal.acceptedAt,
        signedOn: deal.signedOn,
        deliveredOn: deal.deliveredOn,
      },
      financedAmountHt: step === "activate" ? financedAmountHt : undefined,
    },
    new Date(`${isoDay()}T00:00:00Z`),
  );
  if (issues.length > 0) return { status: "invalid", issues };
  await withActor(appDb(), await actorFor(viewer), async (tx) => {
    await tx
      .update(deals)
      .set({
        status: STEP_STATUS[step],
        [STEP_FIELD[step]]: on,
        ...(step === "activate" && financedAmountHt !== undefined ? { financedAmountHt } : {}),
      })
      .where(eq(deals.id, dealId));
    await recordAudit(tx, {
      action: STEP_AUDIT[step],
      entityType: "deal",
      entityId: dealId,
      metadata: { on: onIso, financedAmountHt: financedAmountHt ?? null },
    });
  });
  if (step === "activate")
    track("deal_financed", deal.companyOrganizationId, {
      amount_band: amountBand(financedAmountHt ?? deal.financedAmountHt),
    });
  await notify(STEP_NOTIFICATION[step], deal.companyOrganizationId, {
    reference: loaded.reference,
    path: `/entreprise/demandes/${deal.requestId}`,
    lessor: viewer.membership.organizationName,
  });
  return { status: "done" };
}

/** Annulation motivée : l'entreprise avant la signature, le bailleur jusqu'à la livraison. */
export async function cancelDeal(
  side: DealSide,
  dealId: string,
  reason: string,
  note: string,
): Promise<DealResult> {
  const viewer = side === "lessor" ? await lessorViewer() : await companyViewer();
  const permission = side === "lessor" ? "deal.manage" : "deal.cancel_own";
  if (!can(viewer.membership.role, permission)) return { status: "forbidden" };
  const loaded = await loadDeal(viewer, dealId);
  const own =
    side === "lessor" ? loaded?.deal.lessorOrganizationId : loaded?.deal.companyOrganizationId;
  if (!loaded || own !== viewer.membership.organizationId) return { status: "forbidden" };
  const { deal } = loaded;
  if (!isLiveDeal(deal.status)) return { status: "forbidden" };
  const issues = dealCancelIssues({ status: deal.status as DealStatus, side, reason, note });
  if (issues.length > 0) return { status: "invalid", issues };
  await withActor(appDb(), await actorFor(viewer), async (tx) => {
    await tx
      .update(deals)
      .set({
        status: "cancelled",
        cancelSide: side,
        cancelReason: reason,
        cancelNote: note.trim() || null,
      })
      .where(eq(deals.id, dealId));
    await recordAudit(tx, {
      action: "deal.cancelled",
      entityType: "deal",
      entityId: dealId,
      metadata: { side, reason, note: note.trim() || null },
    });
  });
  if (side === "lessor") {
    await notify("deal_cancelled_by_lessor", deal.companyOrganizationId, {
      reference: loaded.reference,
      path: `/entreprise/demandes/${deal.requestId}/offres`,
      lessor: viewer.membership.organizationName,
    });
  } else {
    await notify("deal_cancelled_by_company", deal.lessorOrganizationId, {
      reference: loaded.reference,
      path: `/bailleur/dossiers/${loaded.targetId}`,
    });
  }
  return { status: "done" };
}
