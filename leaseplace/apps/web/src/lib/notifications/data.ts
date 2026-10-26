import "server-only";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { recordAudit, schema, withActor, type Transaction } from "@leaseplace/db";
import {
  DEFAULT_PREFERENCES,
  isNotificationKind,
  normalizeMoroccanMobile,
  type NotificationKind,
  type NotificationPreferences,
} from "@leaseplace/domain";
import { appDb } from "../db";
import { actorFor, getViewer, type SpaceViewer } from "../viewer";
import { z } from "../zod";

const { notifications, notificationPreferences } = schema;

export interface NotificationItem {
  id: string;
  kind: NotificationKind;
  params: Record<string, string>;
  path: string;
  createdAt: Date;
  readAt: Date | null;
}

export async function unreadNotificationCount(tx: Transaction, userId: string): Promise<number> {
  const [row] = await tx
    .select({ n: sql<number>`count(*)::int` })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
  return row?.n ?? 0;
}

export async function listNotifications(
  tx: Transaction,
  userId: string,
  limit = 50,
): Promise<NotificationItem[]> {
  const rows = await tx
    .select()
    .from(notifications)
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(limit);
  return rows.flatMap((r) =>
    isNotificationKind(r.kind)
      ? [
          {
            id: r.id,
            kind: r.kind,
            params: r.params as Record<string, string>,
            path: r.path,
            createdAt: r.createdAt,
            readAt: r.readAt,
          },
        ]
      : [],
  );
}

export async function preferencesOf(
  tx: Transaction,
  userId: string,
): Promise<NotificationPreferences> {
  const [row] = await tx
    .select()
    .from(notificationPreferences)
    .where(eq(notificationPreferences.userId, userId));
  return row
    ? { email: row.email, sms: row.sms, whatsapp: row.whatsapp, phone: row.phone }
    : DEFAULT_PREFERENCES;
}

async function asViewer<T>(fn: (tx: Transaction, viewer: SpaceViewer) => Promise<T>) {
  const viewer = await getViewer();
  const m = viewer?.membership;
  if (!viewer || !m) return null;
  const full = { ...viewer, membership: m };
  return withActor(appDb(), await actorFor(full), (tx) => fn(tx, full));
}

/** Ouvre une notification : marquée lue, renvoie l'écran concerné (chemin interne). */
export async function openNotification(id: string): Promise<string | null> {
  return asViewer(async (tx, viewer) => {
    const [row] = await tx
      .update(notifications)
      .set({ readAt: sql`coalesce(${notifications.readAt}, now())` })
      .where(and(eq(notifications.id, id), eq(notifications.userId, viewer.user.id)))
      .returning({ path: notifications.path });
    return row?.path ?? null;
  });
}

export async function markAllNotificationsRead(): Promise<void> {
  await asViewer((tx, viewer) =>
    tx
      .update(notifications)
      .set({ readAt: new Date() })
      .where(and(eq(notifications.userId, viewer.user.id), isNull(notifications.readAt))),
  );
}

export type PreferencesResult =
  | { status: "saved" }
  | { status: "invalid"; issues: ("phone_invalid" | "phone_required")[] };

/** Préférences de l'utilisateur ; SMS et WhatsApp exigent un mobile marocain. */
const preferencesSchema = z.object({
  email: z.boolean(),
  sms: z.boolean(),
  whatsapp: z.boolean(),
  phone: z.string().max(40),
});

export async function savePreferences(input: {
  email: boolean;
  sms: boolean;
  whatsapp: boolean;
  phone: string;
}): Promise<PreferencesResult> {
  const parsed = preferencesSchema.safeParse(input);
  if (!parsed.success) return { status: "invalid", issues: ["phone_invalid"] };
  const raw = parsed.data.phone.trim();
  const phone = raw === "" ? null : normalizeMoroccanMobile(raw);
  if (raw !== "" && !phone) return { status: "invalid", issues: ["phone_invalid"] };
  if ((parsed.data.sms || parsed.data.whatsapp) && !phone)
    return { status: "invalid", issues: ["phone_required"] };
  const values = {
    email: parsed.data.email,
    sms: parsed.data.sms,
    whatsapp: parsed.data.whatsapp,
    phone,
    updatedAt: new Date(),
  };
  await asViewer(async (tx, viewer) => {
    await tx
      .insert(notificationPreferences)
      .values({ userId: viewer.user.id, ...values })
      .onConflictDoUpdate({ target: notificationPreferences.userId, set: values });
    await recordAudit(tx, {
      action: "notification.preferences_updated",
      entityType: "user",
      entityId: viewer.user.id,
      metadata: {
        email: values.email,
        sms: values.sms,
        whatsapp: values.whatsapp,
        phone: phone !== null,
      },
    });
  });
  return { status: "saved" };
}
