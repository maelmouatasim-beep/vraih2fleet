import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { MemoFacts } from "./facts";
import {
  EXTRACTION_PROMPT_VERSION,
  EXTRACTION_SYSTEM,
  extractionInstructions,
} from "./prompts/extraction";
import { MEMO_PROMPT_VERSION, MEMO_SYSTEM } from "./prompts/memo";
import {
  AiError,
  type AiCallMeta,
  type AiProvider,
  type AiResult,
  type ExtractionRequest,
} from "./provider";
import {
  extractionOutputSchema,
  memoOutputSchema,
  type ExtractionOutput,
  type MemoOutput,
} from "./schemas";

export const DEFAULT_MODEL = "claude-opus-5-5";

export interface AnthropicOptions {
  apiKey: string;
  model?: string;
  /** Pour les tests : client injecté. */
  client?: Anthropic;
}

/**
 * Fournisseur réel : API Claude, sorties structurées validées par Zod,
 * repli côté serveur en cas de refus (`fallbacks: "default"`). Le document
 * est envoyé tel quel (PDF ou image) ; il est traité comme une donnée.
 */
export function createAnthropicProvider(options: AnthropicOptions): AiProvider {
  const client =
    options.client ?? new Anthropic({ apiKey: options.apiKey, maxRetries: 2, timeout: 180_000 });
  const model = options.model ?? DEFAULT_MODEL;

  async function call<T>(
    promptVersion: string,
    system: string,
    content: Anthropic.Beta.BetaContentBlockParam[],
    schema: typeof extractionOutputSchema | typeof memoOutputSchema,
  ): Promise<AiResult<T>> {
    const started = Date.now();
    let response;
    try {
      response = await client.beta.messages.parse({
        model,
        max_tokens: 16000,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        system,
        output_config: { effort: "medium", format: betaZodOutputFormat(schema) },
        messages: [{ role: "user", content }],
      });
    } catch (error) {
      if (error instanceof Anthropic.RateLimitError)
        throw new AiError("rate_limited", "Limite de débit de l'API atteinte");
      if (error instanceof Anthropic.AuthenticationError)
        throw new AiError("not_configured", "Clé d'API refusée");
      if (error instanceof Anthropic.APIError)
        throw new AiError("api_error", `Erreur de l'API (${String(error.status)})`);
      throw new AiError("invalid_output", "Réponse illisible du modèle");
    }
    const meta: AiCallMeta = {
      provider: "anthropic",
      model: response.model,
      promptVersion,
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      },
      durationMs: Date.now() - started,
    };
    if (response.stop_reason === "refusal")
      throw new AiError("refusal", "Le modèle a refusé la demande", meta);
    if (response.stop_reason === "max_tokens")
      throw new AiError("truncated", "Réponse tronquée", meta);
    const parsed = schema.safeParse(response.parsed_output);
    if (!parsed.success) throw new AiError("invalid_output", "Sortie non conforme au schéma", meta);
    return { output: parsed.data as T, meta };
  }

  return {
    name: "anthropic",
    real: true,
    extract(request: ExtractionRequest) {
      const data = Buffer.from(request.bytes).toString("base64");
      const document: Anthropic.Beta.BetaContentBlockParam =
        request.mimeType === "application/pdf"
          ? { type: "document", source: { type: "base64", media_type: "application/pdf", data } }
          : { type: "image", source: { type: "base64", media_type: request.mimeType, data } };
      return call<ExtractionOutput>(
        EXTRACTION_PROMPT_VERSION,
        EXTRACTION_SYSTEM,
        [document, { type: "text", text: extractionInstructions(request.type) }],
        extractionOutputSchema,
      );
    },
    writeMemo(facts: MemoFacts) {
      return call<MemoOutput>(
        MEMO_PROMPT_VERSION,
        MEMO_SYSTEM,
        [{ type: "text", text: `Faits du dossier (JSON) :\n${JSON.stringify(facts, null, 2)}` }],
        memoOutputSchema,
      );
    },
  };
}
