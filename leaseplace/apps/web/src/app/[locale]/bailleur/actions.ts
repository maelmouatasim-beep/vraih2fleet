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
