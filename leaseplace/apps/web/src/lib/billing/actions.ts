import "server-only";
import { randomUUID } from "node:crypto";
import { and, eq, ne } from "drizzle-orm";
import { recordAudit, schema, withActor, type Transaction } from "@leaseplace/db";
import {
  can,
  COMMISSION_CANCEL_REASONS,
  gridIssues,
  invoiceDueOn,
  mandateActivationIssues,
  mandateMachine,
  type GridIssue,
  type MandateIssue,
  type MandateStatus,
  type Permission,
} from "@leaseplace/domain";
import { appDb } from "../db";
import { isoDay } from "../format";
import { actorFor, getViewer, type SpaceViewer } from "../viewer";
import { z } from "../zod";
import { gridOf } from "./data";
import { track } from "../analytics";

const { mandates, commissions, invoices } = schema;

export type AdminResult =
  | { status: "done"; id?: string }
  | { status: "invalid"; issues: string[] }
  | { status: "forbidden" };

async function asAdmin<T>(
  permission: Permission,
  fn: (tx: Transaction, viewer: SpaceViewer) => Promise<T>,
): Promise<T | { status: "forbidden" }> {
  const viewer = await getViewer();
  const m = viewer?.membership;
  if (!viewer || m?.organizationType !== "platform" || !can(m.role, permission))
    return { status: "forbidden" };
  const full = { ...viewer, membership: m };
  return withActor(appDb(), await actorFor(full), (tx) => fn(tx, full));
}

const mandateForm = z.object({
  contractVersion: z.string().trim().max(80),
  signedOn: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .or(z.literal("")),
  antiCircumventionMonths: z.number().int(),
  /** Taux saisis en pourcentage (1,5 = 1,5 %). */
  tiers: z
    .array(z.object({ from: z.number(), ratePct: z.number() }))
    .min(1)
    .max(10),
  note: z.string().max(2000),
});
export type MandateForm = z.infer<typeof mandateForm>;

const toGrid = (tiers: MandateForm["tiers"]) =>
  tiers.map((t) => ({ from: t.from, rate: Math.round(t.ratePct * 1000) / 100_000 }));

/** Nouveau mandat (brouillon) : une nouvelle version, jamais la réécriture d'un mandat signé. */
export async function createMandate(lessorId: string, form: MandateForm): Promise<AdminResult> {
  const parsed = mandateForm.safeParse(form);
  if (!parsed.success) return { status: "invalid", issues: ["form_invalid"] };
  const grid = toGrid(parsed.data.tiers);
  const issues: GridIssue[] = gridIssues(grid);
  if (issues.length > 0) return { status: "invalid", issues };
  return asAdmin("mandate.manage", async (tx, viewer) => {
    const id = randomUUID();
    await tx.insert(mandates).values({
      id,
      lessorOrganizationId: lessorId,
      contractVersion: parsed.data.contractVersion,
      signedOn: parsed.data.signedOn ? new Date(`${parsed.data.signedOn}T00:00:00Z`) : null,
      antiCircumvention: true,
      antiCircumventionMonths: parsed.data.antiCircumventionMonths,
      grid,
      note: parsed.data.note,
      createdBy: viewer.user.id,
    });
    await recordAudit(tx, {
      action: "mandate.created",
      entityType: "mandate",
      entityId: id,
      after: { lessorId, contractVersion: parsed.data.contractVersion, grid },
    });
    return { status: "done", id } as const;
  });
}

const EVENT_AUDIT = {
  activate: "mandate.activated",
  suspend: "mandate.suspended",
  resume: "mandate.resumed",
  terminate: "mandate.terminated",
} as const;

/**
 * Transition d'un mandat. L'activation d'une nouvelle version résilie, dans
 * la même transaction, le mandat actif précédent du bailleur.
 */
export async function changeMandate(
  id: string,
  event: keyof typeof EVENT_AUDIT,
): Promise<AdminResult> {
  return asAdmin("mandate.manage", async (tx) => {
    const [m] = await tx.select().from(mandates).where(eq(mandates.id, id));
    if (!m) return { status: "forbidden" } as const;
    const status = m.status as MandateStatus;
    if (!mandateMachine.can(status, event))
      return { status: "invalid", issues: ["transition_invalid"] } as const;
    if (event === "activate") {
      const issues: MandateIssue[] = mandateActivationIssues(
        {
          contractVersion: m.contractVersion,
          signedOn: m.signedOn,
          antiCircumvention: m.antiCircumvention,
          antiCircumventionMonths: m.antiCircumventionMonths,
          grid: gridOf(m),
        },
        new Date(`${isoDay()}T23:59:59Z`),
      );
      if (issues.length > 0) return { status: "invalid", issues } as const;
    }
    if (event === "resume") {
      const [other] = await tx
        .select({ id: mandates.id })
        .from(mandates)
        .where(
          and(
            eq(mandates.lessorOrganizationId, m.lessorOrganizationId),
            eq(mandates.status, "active"),
          ),
        );
      // Une version plus récente est en vigueur : l'ancienne ne se réactive pas.
      if (other) return { status: "invalid", issues: ["another_active"] } as const;
    }
    if (event === "activate") {
      const previous = await tx
        .update(mandates)
        .set({ status: "terminated" })
        .where(
          and(
            eq(mandates.lessorOrganizationId, m.lessorOrganizationId),
            eq(mandates.status, "active"),
            ne(mandates.id, id),
          ),
        )
        .returning({ id: mandates.id });
      for (const p of previous)
        await recordAudit(tx, {
          action: "mandate.terminated",
          entityType: "mandate",
          entityId: p.id,
          metadata: { replacedBy: id },
        });
    }
    await tx
      .update(mandates)
      .set({ status: mandateMachine.next(status, event) })
      .where(eq(mandates.id, id));
    await recordAudit(tx, { action: EVENT_AUDIT[event], entityType: "mandate", entityId: id });
    return { status: "done" } as const;
  });
}

/** Facture d'une commission due : numérotée par la base, échéance à 30 jours. */
export async function issueInvoice(commissionId: string): Promise<AdminResult> {
  return asAdmin("commission.manage", async (tx, viewer) => {
    const [c] = await tx.select().from(commissions).where(eq(commissions.id, commissionId));
    if (c?.status !== "due") return { status: "forbidden" } as const;
    const issuedOn = new Date(`${isoDay()}T00:00:00Z`);
    const id = randomUUID();
    await tx.insert(invoices).values({
      id,
      number: "",
      lessorOrganizationId: c.lessorOrganizationId,
      issuedOn,
      dueOn: invoiceDueOn(issuedOn),
      amountHt: c.amountHt,
      vatRate: c.vatRate,
      vat: c.vat,
      amountTtc: c.amountTtc,
      createdBy: viewer.user.id,
    });
    await tx
      .update(commissions)
      .set({ status: "invoiced", invoiceId: id })
      .where(eq(commissions.id, commissionId));
    await recordAudit(tx, {
      action: "commission.invoiced",
      entityType: "commission",
      entityId: commissionId,
      metadata: { invoiceId: id, amountTtc: c.amountTtc },
    });
    track("commission_invoiced", c.lessorOrganizationId);
    return { status: "done", id } as const;
  });
}

export async function markCommissionPaid(
  commissionId: string,
  paidOn: string,
  reference: string,
): Promise<AdminResult> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(paidOn) || paidOn > isoDay())
    return { status: "invalid", issues: ["paid_on_invalid"] };
  if (reference.trim().length < 3 || reference.length > 80)
    return { status: "invalid", issues: ["reference_required"] };
  return asAdmin("commission.manage", async (tx) => {
    const updated = await tx
      .update(commissions)
      .set({
        status: "paid",
        paidOn: new Date(`${paidOn}T00:00:00Z`),
        paymentReference: reference.trim(),
      })
      .where(and(eq(commissions.id, commissionId), eq(commissions.status, "invoiced")))
      .returning({ id: commissions.id });
    if (updated.length === 0) return { status: "forbidden" } as const;
    await recordAudit(tx, {
      action: "commission.paid",
      entityType: "commission",
      entityId: commissionId,
      metadata: { paidOn, reference: reference.trim() },
    });
    return { status: "done" } as const;
  });
}

export async function cancelCommission(
  commissionId: string,
  reason: string,
  note: string,
): Promise<AdminResult> {
  if (!(COMMISSION_CANCEL_REASONS as readonly string[]).includes(reason))
    return { status: "invalid", issues: ["reason_invalid"] };
  if (reason === "other" && note.trim().length < 10)
    return { status: "invalid", issues: ["note_required"] };
  return asAdmin("commission.manage", async (tx) => {
    const updated = await tx
      .update(commissions)
      .set({ status: "cancelled", cancelReason: reason, cancelNote: note.trim() || null })
      .where(eq(commissions.id, commissionId))
      .returning({ id: commissions.id });
    if (updated.length === 0) return { status: "forbidden" } as const;
    await recordAudit(tx, {
      action: "commission.cancelled",
      entityType: "commission",
      entityId: commissionId,
      metadata: { reason, note: note.trim() || null },
    });
    return { status: "done" } as const;
  });
}
