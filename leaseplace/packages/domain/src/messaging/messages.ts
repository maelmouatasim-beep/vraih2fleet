/**
 * Messagerie : un fil par demande et par bailleur (questions et réponses
 * entre l'entreprise et un bailleur, via la plateforme). Messages
 * immuables ; coordonnées signalées avant l'acceptation d'une offre
 * (clause anti-contournement des mandats).
 */
export const MESSAGE_LIMITS = { min: 1, max: 4000 } as const;

export const MESSAGE_ISSUES = ["empty", "too_long"] as const;
export type MessageIssue = (typeof MESSAGE_ISSUES)[number];

export function messageIssues(body: string): MessageIssue[] {
  const length = body.trim().length;
  if (length < MESSAGE_LIMITS.min) return ["empty"];
  return length > MESSAGE_LIMITS.max ? ["too_long"] : [];
}

export const CONTACT_FLAGS = ["email", "phone", "url"] as const;
export type ContactFlag = (typeof CONTACT_FLAGS)[number];

const EMAIL = /[\p{L}\p{N}._%+-]+@[\p{L}\p{N}.-]+\.[\p{L}]{2,}/u;
// Mobile ou fixe marocain (+212 / 00212 / 0, puis 5, 6 ou 7 et 8 chiffres),
// ou numéro international de 9 chiffres et plus ; séparateurs tolérés. Un
// montant (« 650 000 DH ») ne commence ni par 0[5-7] ni par +.
const PHONE =
  /(?:(?:\+|00)212[\s.-]?|\b0)[5-7](?:[\s.-]?\d){8}\b|(?:\+|\b00)[1-9](?:[\s.-]?\d){8,13}\b/;
const URL = /\bhttps?:\/\/\S+|\bwww\.\S+\.\S+/i;

/** Coordonnées repérées dans un message (signalement, jamais un blocage). */
export function contactDetails(text: string): ContactFlag[] {
  const flags: ContactFlag[] = [];
  if (EMAIL.test(text)) flags.push("email");
  if (PHONE.test(text)) flags.push("phone");
  if (URL.test(text)) flags.push("url");
  return flags;
}

export interface MessageLike {
  authorOrganizationId: string;
  createdAt: Date;
}

/** Messages de l'autre partie arrivés après la dernière lecture. */
export function unreadCount(
  messages: readonly MessageLike[],
  myOrganizationId: string,
  lastReadAt: Date | null,
): number {
  return messages.filter(
    (m) =>
      m.authorOrganizationId !== myOrganizationId &&
      (lastReadAt === null || m.createdAt.getTime() > lastReadAt.getTime()),
  ).length;
}

/** Délai sans nouvelle notification quand une partie enchaîne les messages. */
export const MESSAGE_NOTIFY_QUIET_MINUTES = 30;

/**
 * Notifier l'autre partie d'un nouveau message ? Oui pour le premier
 * message, une réponse, ou après un silence de 30 minutes ; non pour une
 * rafale du même auteur (une seule notification suffit).
 */
export function shouldNotifyMessage(
  previous: MessageLike | null,
  myOrganizationId: string,
  now: Date,
): boolean {
  if (!previous || previous.authorOrganizationId !== myOrganizationId) return true;
  return now.getTime() - previous.createdAt.getTime() > MESSAGE_NOTIFY_QUIET_MINUTES * 60_000;
}
