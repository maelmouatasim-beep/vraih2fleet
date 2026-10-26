/**
 * Catalogue des événements produit (`objet_action`). Chaque événement a une
 * liste fermée de propriétés : aucune donnée personnelle (nom, courriel,
 * téléphone, ICE, montant exact) ne part vers l'outil d'analyse ; les
 * montants sont ramenés à des tranches.
 */
export const ANALYTICS_EVENTS = {
  page_viewed: ["page", "locale"],
  simulator_used: ["amount_band", "duration_months"],
  request_started: ["category"],
  request_submitted: ["category", "amount_band"],
  kyc_completed: [],
  request_routed: ["targets"],
  offer_submitted: ["first"],
  offer_accepted: ["offers"],
  deal_financed: ["amount_band"],
  lead_submitted: ["kind"],
  commission_invoiced: [],
} as const satisfies Record<string, readonly string[]>;
export type AnalyticsEvent = keyof typeof ANALYTICS_EVENTS;
export const ANALYTICS_EVENT_NAMES = Object.keys(ANALYTICS_EVENTS) as AnalyticsEvent[];

/** Entonnoir du tableau de bord produit, dans l'ordre. */
export const ANALYTICS_FUNNEL: readonly AnalyticsEvent[] = [
  "page_viewed",
  "simulator_used",
  "request_started",
  "request_submitted",
  "kyc_completed",
  "request_routed",
  "offer_submitted",
  "offer_accepted",
  "deal_financed",
];

/** Événements que le navigateur peut émettre (pages publiques, sans compte). */
export const CLIENT_ANALYTICS_EVENTS: readonly AnalyticsEvent[] = ["page_viewed", "simulator_used"];

export const PUBLIC_PAGES = ["landing", "simulator", "sector", "lessors", "legal"] as const;

const NAME_PATTERN = /^[a-z]+_[a-z]+$/;

export function isWellFormedEventName(name: string): boolean {
  return NAME_PATTERN.test(name);
}

export function isAnalyticsEvent(name: unknown): name is AnalyticsEvent {
  return typeof name === "string" && Object.hasOwn(ANALYTICS_EVENTS, name);
}

export type AnalyticsValue = string | number | boolean;

/** Ne garde que les propriétés autorisées de l'événement, de type simple, textes bornés. */
export function sanitizeProperties(
  event: AnalyticsEvent,
  properties: Readonly<Record<string, unknown>>,
): Record<string, AnalyticsValue> {
  const allowed: readonly string[] = ANALYTICS_EVENTS[event];
  const out: Record<string, AnalyticsValue> = {};
  for (const key of allowed) {
    const v = properties[key];
    if (typeof v === "number" && Number.isFinite(v)) out[key] = v;
    else if (typeof v === "boolean") out[key] = v;
    else if (typeof v === "string" && /^[a-z0-9_-]{1,40}$/.test(v)) out[key] = v;
  }
  return out;
}

const BANDS = [
  [250_000, "lt_250k"],
  [500_000, "250k_500k"],
  [1_000_000, "500k_1m"],
  [2_000_000, "1m_2m"],
  [5_000_000, "2m_5m"],
] as const;

/** Tranche de montant (HT, DH) : jamais le montant exact. */
export function amountBand(amountHt: number): string {
  return BANDS.find(([limit]) => amountHt < limit)?.[1] ?? "gte_5m";
}
