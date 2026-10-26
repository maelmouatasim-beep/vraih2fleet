"use server";

import { revalidatePath } from "next/cache";
import {
  declineTarget,
  saveAppetite,
  submitOffer,
  withdrawOffer,
  type AppetiteForm,
  type OfferForm,
  type OfferResult,
  type SimpleResult,
} from "@/lib/lessor/actions";
import { cancelDeal, recordDealStep, type DealResult } from "@/lib/deals/actions";
import { sendMessage, type SendResult as MessageResult } from "@/lib/messaging/actions";
import type { DealStep } from "@leaseplace/domain";

const refresh = () => {
  revalidatePath("/[locale]/bailleur", "layout");
};

export async function submitOfferAction(targetId: string, form: OfferForm): Promise<OfferResult> {
  const r = await submitOffer(targetId, form);
  refresh();
  return r;
}

export async function withdrawOfferAction(targetId: string): Promise<SimpleResult> {
  const r = await withdrawOffer(targetId);
  refresh();
  return r;
}

export async function declineAction(
  targetId: string,
  reason: string,
  note: string,
): Promise<SimpleResult> {
  const r = await declineTarget(targetId, reason, note);
  refresh();
  return r;
}

export async function saveAppetiteAction(form: AppetiteForm): Promise<SimpleResult> {
  const r = await saveAppetite(form);
  refresh();
  return r;
}

export async function recordDealStepAction(
  dealId: string,
  step: DealStep,
  on: string,
  financedAmountHt?: number,
): Promise<DealResult> {
  const r = await recordDealStep(dealId, step, on, financedAmountHt);
  refresh();
  return r;
}

export async function cancelDealAction(
  dealId: string,
  reason: string,
  note: string,
): Promise<DealResult> {
  const r = await cancelDeal("lessor", dealId, reason, note);
  refresh();
  return r;
}

export async function sendMessageAction(threadId: string, body: string): Promise<MessageResult> {
  const r = await sendMessage(threadId, body);
  refresh();
  return r;
}
