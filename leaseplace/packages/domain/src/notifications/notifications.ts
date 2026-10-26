/**
 * Notifications : toujours dans l'application ; par e-mail selon la
 * préférence (activé par défaut) ; par SMS ou WhatsApp seulement pour les
 * étapes importantes, si l'utilisateur a donné un numéro mobile et accepté
 * le canal.
 */
export const NOTIFICATION_CHANNELS = ["email", "sms", "whatsapp"] as const;
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

export type NotificationAudience = "company" | "lessor";

export const NOTIFICATION_KINDS = {
  // Entreprise
  request_needs_info: { audience: "company", urgent: true },
  request_qualified: { audience: "company", urgent: false },
  offer_received: { audience: "company", urgent: true },
  message_from_lessor: { audience: "company", urgent: false },
  deal_signed: { audience: "company", urgent: false },
  deal_delivered: { audience: "company", urgent: false },
  deal_activated: { audience: "company", urgent: true },
  deal_cancelled_by_lessor: { audience: "company", urgent: true },
  // Bailleur
  request_received: { audience: "lessor", urgent: true },
  message_from_company: { audience: "lessor", urgent: false },
  offer_accepted: { audience: "lessor", urgent: true },
  offer_not_retained: { audience: "lessor", urgent: false },
  deal_cancelled_by_company: { audience: "lessor", urgent: true },
} as const satisfies Record<string, { audience: NotificationAudience; urgent: boolean }>;
export type NotificationKind = keyof typeof NOTIFICATION_KINDS;
export const NOTIFICATION_KIND_LIST = Object.keys(NOTIFICATION_KINDS) as NotificationKind[];

export function isNotificationKind(value: string): value is NotificationKind {
  return Object.hasOwn(NOTIFICATION_KINDS, value);
}

export interface NotificationPreferences {
  email: boolean;
  sms: boolean;
  whatsapp: boolean;
  /** Mobile au format E.164 (+2126…, +2127…), ou null. */
  phone: string | null;
}

export const DEFAULT_PREFERENCES: NotificationPreferences = {
  email: true,
  sms: false,
  whatsapp: false,
  phone: null,
};

/** Canaux externes à utiliser pour une notification (l'application est toujours servie). */
export function channelsFor(
  kind: NotificationKind,
  prefs: NotificationPreferences,
): NotificationChannel[] {
  const channels: NotificationChannel[] = [];
  if (prefs.email) channels.push("email");
  if (NOTIFICATION_KINDS[kind].urgent && prefs.phone) {
    if (prefs.sms) channels.push("sms");
    if (prefs.whatsapp) channels.push("whatsapp");
  }
  return channels;
}

/**
 * Numéro mobile marocain (06 / 07) normalisé en E.164, ou null. Accepte
 * 0612345678, 06 12 34 56 78, +212 6 12…, 00212612… ; refuse les fixes
 * (05) : ils ne reçoivent ni SMS ni WhatsApp.
 */
export function normalizeMoroccanMobile(input: string): string | null {
  const compact = input.replace(/[\s.\-()]/g, "");
  const digits = /^(?:\+212|00212|0)([67]\d{8})$/.exec(compact)?.[1];
  return digits ? `+212${digits}` : null;
}
