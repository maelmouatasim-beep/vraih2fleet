import { defineMachine } from "../common/state-machine";
import type { DealStatus } from "../deals/deals";
import type { RequestStatus } from "../requests/requests";

/**
 * Droits des personnes (loi 09-08) et conservation des données.
 *
 * Accès et portabilité : export immédiat, en libre-service, par le
 * titulaire de l'entreprise. Effacement : une demande, traitée par la
 * plateforme (effacement des données personnelles et des pièces ; les
 * enregistrements que la loi impose de garder sont conservés, rendus
 * pseudonymes). Conservation : durées réglables par l'administrateur,
 * appliquées par une purge planifiée.
 */
export const PRIVACY_REQUEST_KINDS = ["erasure"] as const;
export type PrivacyRequestKind = (typeof PRIVACY_REQUEST_KINDS)[number];

export const PRIVACY_REQUEST_STATUSES = ["pending", "completed", "rejected", "cancelled"] as const;
export type PrivacyRequestStatus = (typeof PRIVACY_REQUEST_STATUSES)[number];
export const PRIVACY_REQUEST_EVENTS = ["complete", "reject", "cancel"] as const;
export type PrivacyRequestEvent = (typeof PRIVACY_REQUEST_EVENTS)[number];

export const privacyRequestMachine = defineMachine<PrivacyRequestStatus, PrivacyRequestEvent>({
  pending: { complete: "completed", reject: "rejected", cancel: "cancelled" },
  completed: {},
  rejected: {},
  cancelled: {},
});

/** Délai de réponse que la plateforme s'impose (à confirmer par l'avocat). */
export const PRIVACY_RESPONSE_DAYS = 30;

export function privacyResponseDueOn(requestedAt: Date): Date {
  return new Date(requestedAt.getTime() + PRIVACY_RESPONSE_DAYS * 86_400_000);
}

/** Demandes en cours chez la plateforme ou les bailleurs : à retirer avant l'effacement. */
export const ERASURE_BLOCKING_REQUEST_STATUSES: readonly RequestStatus[] = [
  "submitted",
  "in_review",
  "qualified",
  "routed",
  "accepted",
];

/** Opérations en cours de signature ou de livraison : le bailleur travaille encore sur le dossier. */
export const ERASURE_BLOCKING_DEAL_STATUSES: readonly DealStatus[] = [
  "accepted",
  "signed",
  "delivered",
];

export type ErasureIssue = "requests_in_progress" | "deals_in_progress";

export function erasureIssues(state: {
  requestStatuses: readonly string[];
  dealStatuses: readonly string[];
}): ErasureIssue[] {
  const issues: ErasureIssue[] = [];
  if (
    state.requestStatuses.some((s) => (ERASURE_BLOCKING_REQUEST_STATUSES as string[]).includes(s))
  )
    issues.push("requests_in_progress");
  if (state.dealStatuses.some((s) => (ERASURE_BLOCKING_DEAL_STATUSES as string[]).includes(s)))
    issues.push("deals_in_progress");
  return issues;
}

export const ERASURE_REJECT_REASONS = ["identity_unverified", "legal_hold", "other"] as const;
export type ErasureRejectReason = (typeof ERASURE_REJECT_REASONS)[number];

/** Ce que l'effacement supprime et ce qu'il conserve (affiché avant la demande). */
export const ERASURE_SCOPE = {
  erased: ["accounts", "documents", "extractions", "ai_runs", "notifications", "leads"],
  kept: ["requests", "consents", "offers", "deals", "invoices", "audit"],
} as const;

/**
 * Règles de conservation. La clé est aussi la valeur de la contrainte
 * CHECK de `privacy.retention_settings` (vérifiée par un test).
 */
export const RETENTION_RULES = {
  /** Courriels et SMS de démonstration (boîte d'envoi). */
  outbox_messages: { defaultDays: 30, minDays: 1, maxDays: 365 },
  /** Notifications lues. */
  read_notifications: { defaultDays: 180, minDays: 30, maxDays: 730 },
  /** Sessions et jetons expirés (après expiration). */
  expired_sessions: { defaultDays: 7, minDays: 0, maxDays: 90 },
  /** Prospects (formulaire bailleurs, rappels) sans suite. */
  marketing_leads: { defaultDays: 365, minDays: 90, maxDays: 1095 },
  /** Brouillons de demande abandonnés (sans modification). */
  draft_requests: { defaultDays: 180, minDays: 30, maxDays: 730 },
  /** Pièces du coffre-fort supprimées par l'entreprise : purge du fichier chiffré. */
  deleted_documents: { defaultDays: 30, minDays: 0, maxDays: 365 },
} as const;
export type RetentionKey = keyof typeof RETENTION_RULES;
export const RETENTION_KEYS = Object.keys(RETENTION_RULES) as RetentionKey[];

/** Conservation fixée par la loi, non réglable (affichée pour information). */
export const LEGAL_RETENTION_YEARS = {
  /** Pièces comptables (factures, commissions) : 10 ans (Code de commerce, art. 22). */
  accounting: 10,
  /** Journal d'audit : immuable, conservé avec les pièces comptables. */
  audit: 10,
} as const;

export function isRetentionKey(value: string): value is RetentionKey {
  return (RETENTION_KEYS as string[]).includes(value);
}

export type RetentionIssue = "unknown_rule" | "not_integer" | "below_minimum" | "above_maximum";

export function retentionIssues(key: string, days: number): RetentionIssue[] {
  if (!isRetentionKey(key)) return ["unknown_rule"];
  if (!Number.isInteger(days)) return ["not_integer"];
  const rule = RETENTION_RULES[key];
  if (days < rule.minDays) return ["below_minimum"];
  if (days > rule.maxDays) return ["above_maximum"];
  return [];
}

/** Durées effectives : réglage enregistré s'il est valide, sinon la valeur par défaut. */
export function effectiveRetention(
  saved: readonly { key: string; days: number }[],
): Record<RetentionKey, number> {
  const result = Object.fromEntries(
    RETENTION_KEYS.map((k) => [k, RETENTION_RULES[k].defaultDays]),
  ) as Record<RetentionKey, number>;
  for (const s of saved)
    if (isRetentionKey(s.key) && retentionIssues(s.key, s.days).length === 0)
      result[s.key] = s.days;
  return result;
}

/** Date limite : tout ce qui est antérieur est purgé. */
export function retentionCutoff(days: number, now: Date): Date {
  return new Date(now.getTime() - days * 86_400_000);
}

/** Adresse de remplacement d'un compte effacé (unique, jamais routable). */
export function erasedEmail(userId: string): string {
  return `efface-${userId}@leaseplace.invalid`;
}
