import "server-only";
import { createHmac } from "node:crypto";
import { amountBand, sanitizeProperties, type AnalyticsEvent } from "@leaseplace/domain";
import {
  createMemoryAnalytics,
  createPostHogAnalytics,
  type AnalyticsSink,
} from "@leaseplace/integrations/analytics";
import { env } from "./env";
import { logger } from "./logger";

export { amountBand };

const globalForAnalytics = globalThis as unknown as { lpAnalytics?: AnalyticsSink };

/** PostHog si une clé est posée hors mode démo ; sinon mémoire (rien ne sort). */
export function analytics(): AnalyticsSink {
  if (!globalForAnalytics.lpAnalytics) {
    const e = env();
    globalForAnalytics.lpAnalytics =
      e.POSTHOG_KEY && !e.LP_DEMO_MODE
        ? createPostHogAnalytics({ host: e.POSTHOG_HOST, apiKey: e.POSTHOG_KEY })
        : createMemoryAnalytics();
  }
  return globalForAnalytics.lpAnalytics;
}

/**
 * Identifiant pseudonyme stable : HMAC de l'identifiant interne, clé dérivée
 * du secret de l'application. L'outil d'analyse ne peut pas remonter à
 * l'organisation sans ce secret.
 */
export function pseudonym(id: string): string {
  const key = createHmac("sha256", env().BETTER_AUTH_SECRET).update("analytics/v1").digest();
  return createHmac("sha256", key).update(id).digest("hex").slice(0, 32);
}

/**
 * Événement produit, à l'échelle de l'organisation (l'entonnoir suit une
 * entreprise, pas une personne). N'échoue jamais : une panne de l'outil
 * d'analyse n'interrompt aucun parcours.
 */
export function track(
  event: AnalyticsEvent,
  subjectId: string,
  properties: Readonly<Record<string, unknown>> = {},
): void {
  const sink = analytics();
  sink
    .capture({
      event,
      distinctId: pseudonym(subjectId),
      properties: sanitizeProperties(event, properties),
      timestamp: new Date(),
    })
    .then(() => {
      logger.debug({ event, sink: sink.name }, "analytics.captured");
    })
    .catch((error: unknown) => {
      logger.warn({ err: error, event }, "analytics.capture a échoué");
    });
}
