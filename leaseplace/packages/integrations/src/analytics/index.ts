/**
 * Analyse produit derrière une interface : l'application ne connaît que
 * `AnalyticsSink`. Implémentations : mémoire (tests, mode démo) et PostHog
 * (API de capture HTTP, côté serveur : aucun script tiers dans le
 * navigateur, aucun cookie). Les identifiants sont pseudonymes (HMAC calculé
 * par l'application) ; les propriétés sont filtrées par le domaine avant
 * d'arriver ici.
 */

export type EventValue = string | number | boolean;

export interface CapturedEvent {
  event: string;
  /** Identifiant pseudonyme (hexadécimal), jamais un identifiant en clair. */
  distinctId: string;
  properties: Readonly<Record<string, EventValue>>;
  timestamp: Date;
}

export interface AnalyticsSink {
  readonly name: string;
  capture(event: CapturedEvent): Promise<void>;
}

export class InvalidEventError extends Error {
  constructor(reason: string) {
    super(`Événement refusé : ${reason}`);
    this.name = "InvalidEventError";
  }
}

const NAME = /^[a-z]+_[a-z]+$/;
const DISTINCT = /^[0-9a-f]{16,64}$/;

export function validateEvent(e: CapturedEvent): CapturedEvent {
  if (!NAME.test(e.event)) throw new InvalidEventError("nom hors convention objet_action");
  if (!DISTINCT.test(e.distinctId)) throw new InvalidEventError("identifiant non pseudonyme");
  for (const [k, v] of Object.entries(e.properties)) {
    if (!/^[a-z_]{1,40}$/.test(k)) throw new InvalidEventError(`propriété ${k}`);
    if (typeof v === "string" && v.length > 80) throw new InvalidEventError(`valeur de ${k}`);
  }
  return e;
}

export function createMemoryAnalytics(): AnalyticsSink & { readonly events: CapturedEvent[] } {
  const events: CapturedEvent[] = [];
  return {
    name: "memory",
    events,
    async capture(e) {
      await Promise.resolve();
      events.push(validateEvent(e));
    },
  };
}

export interface PostHogOptions {
  /** Hôte d'ingestion (région UE de préférence), https obligatoire. */
  host: string;
  apiKey: string;
  fetch?: typeof globalThis.fetch;
  timeoutMs?: number;
}

/** Capture PostHog : profils de personnes désactivés, aucune IP transmise. */
export function createPostHogAnalytics(options: PostHogOptions): AnalyticsSink {
  const url = new URL("/i/v0/e/", options.host);
  if (url.protocol !== "https:" && url.hostname !== "localhost")
    throw new InvalidEventError("hôte PostHog non chiffré");
  if (!options.apiKey) throw new InvalidEventError("clé PostHog absente");
  const doFetch = options.fetch ?? globalThis.fetch;
  return {
    name: "posthog",
    async capture(e) {
      const event = validateEvent(e);
      const res = await doFetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(options.timeoutMs ?? 2000),
        body: JSON.stringify({
          api_key: options.apiKey,
          event: event.event,
          distinct_id: event.distinctId,
          timestamp: event.timestamp.toISOString(),
          properties: {
            ...event.properties,
            $process_person_profile: false,
            $ip: null,
            $lib: "leaseplace-server",
          },
        }),
      });
      if (!res.ok) throw new Error(`PostHog : HTTP ${String(res.status)}`);
    },
  };
}
