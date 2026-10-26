import "server-only";
import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  /** Rôle lp_app (sans BYPASSRLS) : toutes les requêtes applicatives. */
  DATABASE_URL: z.url(),
  /** Rôle lp_auth : Better-Auth seulement (tables identity). */
  DATABASE_URL_AUTH: z.url(),
  BETTER_AUTH_SECRET: z.string().min(32, "BETTER_AUTH_SECRET : 32 caractères minimum"),
  BETTER_AUTH_URL: z.url(),
  /** Mode démo : bandeau visible, comptes fictifs, boîte d'envoi lisible. */
  LP_DEMO_MODE: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
  /** Répertoire du stockage local des documents (développement, démonstration). */
  LP_STORAGE_DIR: z.string().min(1).default(".storage"),
  /** Clé AES-256 du chiffrement au repos des documents, en base64 (32 octets). */
  LP_STORAGE_KEY: z
    .string()
    .refine((v) => Buffer.from(v, "base64").length === 32, "LP_STORAGE_KEY : 32 octets en base64"),
  /**
   * IA : « mock » = simulateur de démonstration (aucun appel externe) ;
   * « anthropic » = API Claude, clé ANTHROPIC_API_KEY obligatoire.
   */
  LP_AI_PROVIDER: z.enum(["mock", "anthropic"]).default("mock"),
  ANTHROPIC_API_KEY: z.string().min(1).optional(),
  LP_AI_MODEL: z.string().min(1).optional(),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
  /**
   * Analyse produit (PostHog, région UE) : sans clé, ou en mode démo, les
   * événements restent en mémoire (journal de débogage). Hôte d'ingestion
   * https ; identifiants pseudonymes (HMAC), aucune donnée personnelle.
   */
  POSTHOG_KEY: z.string().min(1).optional(),
  POSTHOG_HOST: z.url().default("https://eu.i.posthog.com"),
});

export type Env = z.infer<typeof schema>;

const refined = schema
  .refine((e) => e.LP_AI_PROVIDER !== "anthropic" || e.ANTHROPIC_API_KEY, {
    message: "ANTHROPIC_API_KEY requise avec LP_AI_PROVIDER=anthropic",
    path: ["ANTHROPIC_API_KEY"],
  })
  .refine((e) => e.LP_AI_PROVIDER !== "anthropic" || e.LP_AI_MODEL, {
    message: "LP_AI_MODEL requis avec LP_AI_PROVIDER=anthropic",
    path: ["LP_AI_MODEL"],
  });

let cached: Env | undefined;

/** Variables validées au premier accès (jamais au build). */
export function env(): Env {
  cached ??= refined.parse(process.env);
  return cached;
}

/** Boîte d'envoi lisible : démo ou développement, jamais en production réelle. */
export function outboxReadable(): boolean {
  const e = env();
  return e.LP_DEMO_MODE || e.NODE_ENV !== "production";
}
