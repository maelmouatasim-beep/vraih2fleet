import type { AcceptedMimeType, DocumentType, RevenueBand } from "@leaseplace/domain";
import type { MemoFacts } from "./facts";
import type { ExtractionOutput, MemoOutput } from "./schemas";

export interface AiUsage {
  inputTokens: number;
  outputTokens: number;
}

/** Trace d'un appel : ce qui est conservé dans `ai_runs` (jamais le document lui-même). */
export interface AiCallMeta {
  provider: "anthropic" | "mock";
  model: string;
  promptVersion: string;
  usage: AiUsage;
  durationMs: number;
}

/**
 * Profil déclaré, utilisé SEULEMENT par le simulateur de démonstration pour
 * fabriquer des valeurs plausibles. Le fournisseur réel ne le lit pas : il
 * lit le document.
 */
export interface DemoContext {
  legalName: string;
  ice: string;
  rcNumber: string | null;
  city: string;
  revenueBand: RevenueBand | null;
  directorName: string;
  requestAmountHt: number | null;
  supplierName: string | null;
  now: Date;
}

export interface ExtractionRequest {
  type: DocumentType;
  mimeType: AcceptedMimeType;
  bytes: Uint8Array;
  fileName: string;
  demo: DemoContext;
}

export interface AiResult<T> {
  output: T;
  meta: AiCallMeta;
}

export interface AiProvider {
  readonly name: "anthropic" | "mock";
  /** Faux = simulateur de démonstration, à signaler à l'écran. */
  readonly real: boolean;
  extract(request: ExtractionRequest): Promise<AiResult<ExtractionOutput>>;
  writeMemo(facts: MemoFacts): Promise<AiResult<MemoOutput>>;
}

export const AI_ERROR_CODES = [
  "not_configured",
  "refusal",
  "truncated",
  "invalid_output",
  "rate_limited",
  "api_error",
] as const;
export type AiErrorCode = (typeof AI_ERROR_CODES)[number];

export class AiError extends Error {
  constructor(
    readonly code: AiErrorCode,
    message: string,
    readonly meta: AiCallMeta | null = null,
  ) {
    super(message);
    this.name = "AiError";
  }
}
