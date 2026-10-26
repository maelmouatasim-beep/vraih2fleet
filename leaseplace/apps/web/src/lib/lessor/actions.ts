import "server-only";
import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { recordAudit, schema, withActor, type Transaction } from "@leaseplace/db";
import {
  BUSINESS_SECTORS,
  can,
  declineIssues,
  DECLINE_REASONS,
  DEFAULT_VAT_RATE,
  EQUIPMENT_CATEGORIES,
  GRADES,
  offerIssues,
  PAYMENT_TIMINGS,
  PERIODICITIES,
  priceOffer,
  type OfferIssue,
} from "@leaseplace/domain";
import { appDb } from "../db";
import { notify } from "../notify";
import { actorFor, getViewer, type SpaceViewer } from "../viewer";
import { z } from "../zod";
import { appetiteOf, lessorTarget } from "./data";

const { routingTargets, offers, targetDeclines, lessorAppetites } = schema;

export class LessorDenied extends Error {
  constructor() {
    super("Action réservée au bailleur");
    this.name = "LessorDenied";
  }
}

export async function lessorViewer(): Promise<SpaceViewer> {
  const viewer = await getViewer();
  const m = viewer?.membership;
  if (!viewer || !m || m.organizationType !== "lessor") throw new LessorDenied();
  return { ...viewer, membership: m };
}

async function asLessor<T>(fn: (tx: Transaction, viewer: SpaceViewer) => Promise<T>): Promise<T> {
  const viewer = await lessorViewer();
  return withActor(appDb(), await actorFor(viewer), (tx) => fn(tx, viewer));
}

/** Première ouverture du dossier : « consulté », horodaté et audité. */
export async function markViewed(tx: Transaction, viewer: SpaceViewer, targetId: string) {
  if (!can(viewer.membership.role, "offer.submit")) return;
  const updated = await tx
    .update(routingTargets)
    .set({ status: "viewed" })
    .where(and(eq(routingTargets.id, targetId), eq(routingTargets.status, "sent")))
    .returning({ id: routingTargets.id });
  if (updated.length > 0) {
    await recordAudit(tx, {
      action: "target.viewed",
      entityType: "routing_target",
      entityId: targetId,
    });
  }
}

const offerSchema = z.object({
  financedAmountHt: z.number(),
  durationMonths: z.number().int(),
  periodicity: z.enum(PERIODICITIES),
  timing: z.enum(PAYMENT_TIMINGS),
  annualRatePct: z.number(),
  firstRentHt: z.number(),
  residualValueHt: z.number(),
  fileFeesHt: z.number(),
  insurancePerPeriodHt: z.number(),
  insuranceRequired: z.boolean(),
  validUntil: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  conditions: z.string().max(2000),
});
export type OfferForm = z.infer<typeof offerSchema>;

export type OfferResult =
  | { status: "submitted" }
  | { status: "invalid"; issues: (OfferIssue | "pricing_impossible")[] }
  | { status: "forbidden" };

/** Dépôt d'une offre : le serveur recalcule loyer, coût total et TEG. */
export async function submitOffer(targetId: string, form: OfferForm): Promise<OfferResult> {
  const parsed = offerSchema.safeParse(form);
  if (!parsed.success) return { status: "invalid", issues: ["amount_invalid"] };
  const f = parsed.data;
  const outcome = await asLessor(async (tx, viewer) => {
    if (!can(viewer.membership.role, "offer.submit")) return { status: "forbidden" } as const;
    const file = await lessorTarget(tx, targetId);
    if (
      !file ||
      file.target.lessorOrganizationId !== viewer.membership.organizationId ||
      !["sent", "viewed"].includes(file.target.status)
    )
      return { status: "forbidden" } as const;
    const now = new Date();
    const input = {
      financedAmountHt: f.financedAmountHt,
      durationMonths: f.durationMonths,
      periodicity: f.periodicity,
      timing: f.timing,
      annualRate: f.annualRatePct / 100,
      firstRentHt: f.firstRentHt,
      residualValueHt: f.residualValueHt,
      fileFeesHt: f.fileFeesHt,
      insurancePerPeriodHt: f.insurancePerPeriodHt,
      insuranceRequired: f.insuranceRequired,
      validUntil: new Date(`${f.validUntil}T23:59:59Z`),
      conditions: f.conditions.trim(),
    };
    const issues = offerIssues(input, file.request.amountHt ?? 0, now);
    if (issues.length > 0) return { status: "invalid", issues } as const;
    let priced;
    try {
      priced = priceOffer(input);
    } catch {
      return { status: "invalid" as const, issues: ["pricing_impossible" as const] };
    }
    const offerId = randomUUID();
    await tx.insert(offers).values({
      id: offerId,
      targetId,
      requestId: file.request.id,
      lessorOrganizationId: viewer.membership.organizationId,
      financedAmountHt: input.financedAmountHt,
      durationMonths: input.durationMonths,
      periodicity: input.periodicity,
      timing: input.timing,
      annualRate: input.annualRate,
      firstRentHt: priced.firstRentHt,
      rentHt: priced.rentHt,
      residualValueHt: input.residualValueHt,
      fileFeesHt: input.fileFeesHt,
      insurancePerPeriodHt: input.insurancePerPeriodHt,
      insuranceRequired: input.insuranceRequired,
      vatRate: DEFAULT_VAT_RATE,
      financingCostHt: priced.normalized.totals.financingCostHt,
      paidTtc: priced.normalized.totals.paidTtc,
      effectiveRate: Math.round(priced.normalized.rates.annualEffectiveRate * 1e6) / 1e6,
      validUntil: input.validUntil,
      conditions: input.conditions,
      submittedBy: viewer.user.id,
    });
    await tx
      .update(routingTargets)
      .set({ status: "offered" })
      .where(eq(routingTargets.id, targetId));
    await recordAudit(tx, {
      action: "offer.submitted",
      entityType: "offer",
      entityId: offerId,
      metadata: {
        requestId: file.request.id,
        rentHt: priced.rentHt,
        effectiveRate: priced.normalized.rates.annualEffectiveRate,
        financingCostHt: priced.normalized.totals.financingCostHt,
      },
    });
    return {
      status: "submitted",
      companyId: file.request.organizationId,
      reference: file.request.reference,
      requestId: file.request.id,
      lessor: viewer.membership.organizationName,
    } as const;
  });
  if (outcome.status !== "submitted") return outcome;
  await notify("offer_received", outcome.companyId, {
    reference: outcome.reference,
    path: `/entreprise/demandes/${outcome.requestId}/offres`,
    lessor: outcome.lessor,
  });
  return { status: "submitted" };
}

export type SimpleResult =
  | { status: "done" }
  | { status: "invalid"; issues: string[] }
  | { status: "forbidden" };

export async function withdrawOffer(targetId: string): Promise<SimpleResult> {
  return asLessor(async (tx, viewer) => {
    if (!can(viewer.membership.role, "offer.submit")) return { status: "forbidden" } as const;
    const updated = await tx
      .update(offers)
      .set({ status: "withdrawn" })
      .where(and(eq(offers.targetId, targetId), eq(offers.status, "submitted")))
      .returning({ id: offers.id });
    const offer = updated[0];
    if (!offer) return { status: "forbidden" } as const;
    await tx
      .update(routingTargets)
      .set({ status: "viewed" })
      .where(eq(routingTargets.id, targetId));
    await recordAudit(tx, { action: "offer.withdrawn", entityType: "offer", entityId: offer.id });
    return { status: "done" } as const;
  });
}

export async function declineTarget(
  targetId: string,
  reason: string,
  note: string,
): Promise<SimpleResult> {
  const issues = declineIssues(reason, note);
  if (issues.length > 0) return { status: "invalid", issues };
  return asLessor(async (tx, viewer) => {
    if (!can(viewer.membership.role, "offer.submit")) return { status: "forbidden" } as const;
    const [target] = await tx.select().from(routingTargets).where(eq(routingTargets.id, targetId));
    if (!target || !["sent", "viewed"].includes(target.status))
      return { status: "forbidden" } as const;
    await tx.insert(targetDeclines).values({
      targetId,
      reason,
      note: note.trim() || null,
      declinedBy: viewer.user.id,
    });
    await tx
      .update(routingTargets)
      .set({ status: "declined" })
      .where(eq(routingTargets.id, targetId));
    await recordAudit(tx, {
      action: "target.declined",
      entityType: "routing_target",
      entityId: targetId,
      metadata: { reason, note: note.trim() || null },
    });
    return { status: "done" } as const;
  });
}

const appetiteSchema = z
  .object({
    active: z.boolean(),
    minAmountHt: z.number().positive(),
    maxAmountHt: z.number().positive(),
    minDurationMonths: z.number().int().min(1),
    maxDurationMonths: z.number().int().max(120),
    sectors: z.array(z.enum(BUSINESS_SECTORS)),
    categories: z.array(z.enum(EQUIPMENT_CATEGORIES)),
    minGrade: z.enum(GRADES),
  })
  .refine((a) => a.maxAmountHt >= a.minAmountHt, { path: ["maxAmountHt"] })
  .refine((a) => a.maxDurationMonths >= a.minDurationMonths, { path: ["maxDurationMonths"] });
export type AppetiteForm = z.input<typeof appetiteSchema>;

export async function saveAppetite(form: AppetiteForm): Promise<SimpleResult> {
  const parsed = appetiteSchema.safeParse(form);
  if (!parsed.success)
    return { status: "invalid", issues: parsed.error.issues.map((i) => String(i.path[0])) };
  return asLessor(async (tx, viewer) => {
    if (!can(viewer.membership.role, "appetite.manage")) return { status: "forbidden" } as const;
    const orgId = viewer.membership.organizationId;
    const before = await appetiteOf(tx, orgId);
    if (before) {
      await tx
        .update(lessorAppetites)
        .set({
          ...parsed.data,
          updatedBy: viewer.user.id,
          updatedAt: new Date(),
          version: before.version + 1,
        })
        .where(eq(lessorAppetites.organizationId, orgId));
    } else {
      await tx
        .insert(lessorAppetites)
        .values({ organizationId: orgId, ...parsed.data, updatedBy: viewer.user.id });
    }
    await recordAudit(tx, {
      action: "appetite.updated",
      entityType: "organization",
      entityId: orgId,
      before: before ? { ...before, updatedAt: undefined } : null,
      after: parsed.data,
    });
    return { status: "done" } as const;
  });
}

export { DECLINE_REASONS };
