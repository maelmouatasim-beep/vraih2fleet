"use server";

import { revalidatePath } from "next/cache";
import {
  cancelErasure,
  executeErasure,
  rejectErasure,
  requestErasure,
  runRetention,
  saveRetention,
  type PrivacyResult,
} from "@/lib/privacy/actions";

const refresh = () => {
  revalidatePath("/[locale]/entreprise/profil", "page");
  revalidatePath("/[locale]/admin", "layout");
};

const after = async (p: Promise<PrivacyResult>) => {
  const r = await p;
  refresh();
  return r;
};

export async function requestErasureAction(note: string): Promise<PrivacyResult> {
  return after(requestErasure(note));
}
export async function cancelErasureAction(id: string): Promise<PrivacyResult> {
  return after(cancelErasure(id));
}
export async function rejectErasureAction(
  id: string,
  reason: string,
  note: string,
): Promise<PrivacyResult> {
  return after(rejectErasure(id, reason, note));
}
export async function executeErasureAction(id: string): Promise<PrivacyResult> {
  return after(executeErasure(id));
}
export async function saveRetentionAction(key: string, days: number): Promise<PrivacyResult> {
  return after(saveRetention(key, days));
}
export async function runRetentionAction(): Promise<PrivacyResult> {
  return after(runRetention());
}
