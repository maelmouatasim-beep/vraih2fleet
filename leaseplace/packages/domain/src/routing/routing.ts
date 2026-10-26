import { defineMachine } from "../common/state-machine";
import type { BusinessSector } from "../kyc/company";
import type { EquipmentCategory } from "../requests/requests";
import { GRADES, type Grade } from "../scoring/model";

/**
 * Orientation d'un dossier qualifié vers les bailleurs (phase 6). Chaque
 * bailleur déclare son appétit ; un bailleur est éligible s'il en satisfait
 * tous les critères, et chaque exclusion est motivée. Parmi les éligibles,
 * l'ordre est une rotation équitable (empreinte de la demande et du
 * bailleur) : aucune position n'est vendue, aucun bailleur n'est favorisé.
 * L'entreprise choisit ensuite, nommément, à qui le dossier est transmis.
 */
export interface Appetite {
  lessorId: string;
  active: boolean;
  minAmountHt: number;
  maxAmountHt: number;
  minDurationMonths: number;
  maxDurationMonths: number;
  /** Secteurs acceptés ; liste vide = tous. */
  sectors: readonly BusinessSector[];
  /** Catégories d'actifs acceptées ; liste vide = toutes. */
  categories: readonly EquipmentCategory[];
  /** Indice minimal accepté (A = le plus exigeant). */
  minGrade: Grade;
}

export interface RoutingProfile {
  requestId: string;
  amountHt: number;
  durationMonths: number;
  sector: BusinessSector;
  category: EquipmentCategory;
  grade: Grade;
}

export const ROUTING_EXCLUSIONS = [
  "inactive",
  "amount_below_min",
  "amount_above_max",
  "duration_out_of_range",
  "sector_excluded",
  "category_excluded",
  "grade_below_min",
] as const;
export type RoutingExclusion = (typeof ROUTING_EXCLUSIONS)[number];

/** Nombre de bailleurs par dossier : configurable entre 3 et 5. */
export const TARGET_LIMITS = { min: 3, max: 5, default: 4 } as const;

export function clampMaxTargets(n: number): number {
  return Math.min(TARGET_LIMITS.max, Math.max(TARGET_LIMITS.min, Math.round(n)));
}

export function exclusionsOf(profile: RoutingProfile, a: Appetite): RoutingExclusion[] {
  const out: RoutingExclusion[] = [];
  if (!a.active) out.push("inactive");
  if (profile.amountHt < a.minAmountHt) out.push("amount_below_min");
  if (profile.amountHt > a.maxAmountHt) out.push("amount_above_max");
  if (profile.durationMonths < a.minDurationMonths || profile.durationMonths > a.maxDurationMonths)
    out.push("duration_out_of_range");
  if (a.sectors.length > 0 && !a.sectors.includes(profile.sector)) out.push("sector_excluded");
  if (a.categories.length > 0 && !a.categories.includes(profile.category))
    out.push("category_excluded");
  if (GRADES.indexOf(profile.grade) > GRADES.indexOf(a.minGrade)) out.push("grade_below_min");
  return out;
}

/** Empreinte FNV-1a 32 bits : rotation équitable, reproductible, sans tirage. */
export function rotationKey(requestId: string, lessorId: string): number {
  let h = 0x811c9dc5;
  for (const ch of `${requestId}:${lessorId}`) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

export interface RoutingCandidate {
  lessorId: string;
  eligible: boolean;
  exclusions: RoutingExclusion[];
  /** Rang dans la rotation (éligibles seulement), à partir de 1. */
  rank: number | null;
  /** Présélectionné pour l'entreprise (dans la limite du nombre de bailleurs). */
  proposed: boolean;
}

export function routeRequest(
  profile: RoutingProfile,
  appetites: readonly Appetite[],
  maxTargets: number = TARGET_LIMITS.default,
): RoutingCandidate[] {
  const limit = clampMaxTargets(maxTargets);
  // Base stable (identifiants triés), puis rotation : à empreinte égale, l'ordre des identifiants.
  const evaluated = [...appetites]
    .sort((x, y) => x.lessorId.localeCompare(y.lessorId))
    .map((a) => ({ lessorId: a.lessorId, exclusions: exclusionsOf(profile, a) }));
  const eligible = evaluated
    .filter((e) => e.exclusions.length === 0)
    .sort(
      (x, y) =>
        rotationKey(profile.requestId, x.lessorId) - rotationKey(profile.requestId, y.lessorId),
    )
    .map((e, i) => ({ ...e, eligible: true, rank: i + 1, proposed: i < limit }));
  const excluded = evaluated
    .filter((e) => e.exclusions.length > 0)
    .map((e) => ({ ...e, eligible: false, rank: null, proposed: false }));
  return [...eligible, ...excluded];
}

/** L'entreprise choisit parmi les éligibles, au plus `maxTargets`, au moins un. */
export function selectionIssues(
  candidates: readonly RoutingCandidate[],
  selected: readonly string[],
  maxTargets: number,
): ("none_selected" | "too_many" | "not_eligible")[] {
  const issues: ("none_selected" | "too_many" | "not_eligible")[] = [];
  const unique = new Set(selected);
  if (unique.size === 0) issues.push("none_selected");
  if (unique.size > clampMaxTargets(maxTargets)) issues.push("too_many");
  const eligible = new Set(candidates.filter((c) => c.eligible).map((c) => c.lessorId));
  if ([...unique].some((id) => !eligible.has(id))) issues.push("not_eligible");
  return issues;
}

// ── Transmission à un bailleur : statuts et délai de réponse ──────────────

export const TARGET_STATUSES = [
  "eligible",
  "excluded",
  "sent",
  "viewed",
  "offered",
  "declined",
] as const;
export type TargetStatus = (typeof TARGET_STATUSES)[number];
export const TARGET_EVENTS = ["send", "view", "offer", "decline", "withdraw"] as const;
export type TargetEvent = (typeof TARGET_EVENTS)[number];

export const targetMachine = defineMachine<TargetStatus, TargetEvent>({
  eligible: { send: "sent" },
  excluded: {},
  sent: { view: "viewed", offer: "offered", decline: "declined" },
  viewed: { offer: "offered", decline: "declined" },
  offered: { withdraw: "viewed" },
  declined: {},
});

/** Statuts où le bailleur a reçu le dossier (et peut le lire). */
export const RECEIVED_TARGET_STATUSES: readonly TargetStatus[] = [
  "sent",
  "viewed",
  "offered",
  "declined",
];

/** Délai de réponse visé : 72 heures après l'envoi. */
export const RESPONSE_SLA_HOURS = 72;

export function slaDueAt(sentAt: Date): Date {
  return new Date(sentAt.getTime() + RESPONSE_SLA_HOURS * 3_600_000);
}

export interface SlaState {
  /** Heures restantes, arrondies vers le bas ; négatif en retard. */
  hoursLeft: number;
  overdue: boolean;
}

export function slaState(dueAt: Date, now: Date): SlaState {
  const ms = dueAt.getTime() - now.getTime();
  return { hoursLeft: Math.floor(ms / 3_600_000), overdue: ms < 0 };
}

export const DECLINE_REASONS = [
  "outside_appetite",
  "insufficient_financials",
  "sector_exposure",
  "asset_risk",
  "incomplete_file",
  "pricing_not_competitive",
  "other",
] as const;
export type DeclineReason = (typeof DECLINE_REASONS)[number];

/** Motif structuré ; « autre » exige une précision (10 caractères). */
export function declineIssues(
  reason: string,
  note: string,
): ("reason_invalid" | "note_required")[] {
  if (!(DECLINE_REASONS as readonly string[]).includes(reason)) return ["reason_invalid"];
  return reason === "other" && note.trim().length < 10 ? ["note_required"] : [];
}
