"use server";

import { revalidatePath } from "next/cache";
import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import {
  markAllNotificationsRead,
  openNotification,
  savePreferences,
  type PreferencesResult,
} from "@/lib/notifications/data";

/** Ouvre une notification (lue) et mène à l'écran concerné. */
export async function openNotificationAction(id: string) {
  const path = await openNotification(id);
  const locale = await getLocale();
  revalidatePath("/[locale]", "layout");
  // Chemin interne enregistré par le serveur (contrainte SQL : « /… » sans « // »).
  if (path) redirect({ href: path, locale });
}

export async function markAllReadAction() {
  await markAllNotificationsRead();
  revalidatePath("/[locale]", "layout");
}

export async function savePreferencesAction(input: {
  email: boolean;
  sms: boolean;
  whatsapp: boolean;
  phone: string;
}): Promise<PreferencesResult> {
  const result = await savePreferences(input);
  revalidatePath("/[locale]", "layout");
  return result;
}
