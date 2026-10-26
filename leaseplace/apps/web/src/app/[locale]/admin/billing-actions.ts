"use server";

import { revalidatePath } from "next/cache";
import {
  cancelCommission,
  changeMandate,
  createMandate,
  issueInvoice,
  markCommissionPaid,
  type AdminResult,
  type MandateForm,
} from "@/lib/billing/actions";

const refresh = () => {
  revalidatePath("/[locale]/admin", "layout");
};

export async function createMandateAction(
  lessorId: string,
  form: MandateForm,
): Promise<AdminResult> {
  const r = await createMandate(lessorId, form);
  refresh();
  return r;
}

export async function changeMandateAction(
  id: string,
  event: "activate" | "suspend" | "resume" | "terminate",
): Promise<AdminResult> {
  const r = await changeMandate(id, event);
  refresh();
  return r;
}

export async function issueInvoiceAction(commissionId: string): Promise<AdminResult> {
  const r = await issueInvoice(commissionId);
  refresh();
  return r;
}

export async function markPaidAction(
  commissionId: string,
  paidOn: string,
  reference: string,
): Promise<AdminResult> {
  const r = await markCommissionPaid(commissionId, paidOn, reference);
  refresh();
  return r;
}

export async function cancelCommissionAction(
  commissionId: string,
  reason: string,
  note: string,
): Promise<AdminResult> {
  const r = await cancelCommission(commissionId, reason, note);
  refresh();
  return r;
}
