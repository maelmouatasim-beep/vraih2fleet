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
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
});

export type Env = z.infer<typeof schema>;

let cached: Env | undefined;

/** Variables validées au premier accès (jamais au build). */
export function env(): Env {
  cached ??= schema.parse(process.env);
  return cached;
}

/** Boîte d'envoi lisible : démo ou développement, jamais en production réelle. */
export function outboxReadable(): boolean {
  const e = env();
  return e.LP_DEMO_MODE || e.NODE_ENV !== "production";
}
