import "server-only";
import { createAnthropicProvider, createMockProvider, type AiProvider } from "@leaseplace/ai";
import { env } from "./env";

const globalForAi = globalThis as unknown as { lpAi?: AiProvider };

/** Fournisseur d'IA choisi par l'environnement ; le simulateur par défaut. */
export function aiProvider(): AiProvider {
  if (!globalForAi.lpAi) {
    const e = env();
    globalForAi.lpAi =
      e.LP_AI_PROVIDER === "anthropic" && e.ANTHROPIC_API_KEY && e.LP_AI_MODEL
        ? createAnthropicProvider({ apiKey: e.ANTHROPIC_API_KEY, model: e.LP_AI_MODEL })
        : createMockProvider();
  }
  return globalForAi.lpAi;
}
