"use server";

import { redirect } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { endSupportAccess, startSupportAccess, type SupportResult } from "@/lib/support/actions";

export async function startSupportAccessAction(
  targetUserId: string,
  organizationId: string,
  reason: string,
): Promise<SupportResult> {
  return startSupportAccess(targetUserId, organizationId, reason);
}

export async function endSupportAccessAction(locale: Locale): Promise<never> {
  await endSupportAccess();
  return redirect({ href: "/admin/utilisateurs", locale });
}
