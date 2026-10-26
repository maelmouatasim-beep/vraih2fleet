import type Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it, vi } from "vitest";
import { createAnthropicProvider } from "./anthropic";

const MODEL = "modele-de-test";
import { DEMO, demoFacts } from "./fixtures.test-helpers";
import { mockExtraction, mockMemo } from "./mock";
import { AiError } from "./provider";

function fakeClient(response: Record<string, unknown> | Error) {
  const parse = vi.fn((_params: unknown) =>
    response instanceof Error ? Promise.reject(response) : Promise.resolve(response),
  );
  return { client: { beta: { messages: { parse } } } as unknown as Anthropic, parse };
}

const usage = { input_tokens: 1200, output_tokens: 300 };
const extractionRequest = {
  type: "rc_extract" as const,
  mimeType: "application/pdf" as const,
  bytes: new Uint8Array([37, 80, 68, 70]),
  fileName: "rc.pdf",
  demo: DEMO,
};

describe("fournisseur Claude", () => {
  it("extraction : document en bloc PDF, repli serveur activé, sortie validée et tracée", async () => {
    const parsed = mockExtraction(extractionRequest);
    const { client, parse } = fakeClient({
      model: MODEL,
      usage,
      stop_reason: "end_turn",
      parsed_output: parsed,
    });
    const provider = createAnthropicProvider({ apiKey: "test", model: MODEL, client });
    expect(provider.real).toBe(true);
    const { output, meta } = await provider.extract(extractionRequest);
    expect(output).toEqual(parsed);
    expect(meta).toMatchObject({
      provider: "anthropic",
      model: MODEL,
      promptVersion: "extraction-v1",
      usage: { inputTokens: 1200, outputTokens: 300 },
    });
    const params = parse.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(params).toMatchObject({
      model: MODEL,
      fallbacks: "default",
      betas: ["server-side-fallback-2026-07-01"],
    });
    const content = (params.messages as { content: { type: string }[] }[])[0]?.content;
    expect(content?.[0]?.type).toBe("document");
    expect(String(params.system)).toContain("UNTRUSTED DATA");
  });

  it("image : bloc image", async () => {
    const { client, parse } = fakeClient({
      model: "m",
      usage,
      stop_reason: "end_turn",
      parsed_output: mockExtraction(extractionRequest),
    });
    await createAnthropicProvider({ apiKey: "t", client, model: "m" }).extract({
      ...extractionRequest,
      mimeType: "image/png",
    });
    const params = parse.mock.calls[0]?.[0] as {
      messages: { content: { type: string }[] }[];
    };
    expect(params.messages[0]?.content[0]?.type).toBe("image");
  });

  it("note : faits en JSON, sortie validée", async () => {
    const { facts } = demoFacts();
    const memo = mockMemo(facts);
    const { client } = fakeClient({
      model: "m",
      usage,
      stop_reason: "end_turn",
      parsed_output: memo,
    });
    const { output, meta } = await createAnthropicProvider({
      apiKey: "t",
      model: MODEL,
      client,
    }).writeMemo(facts);
    expect(output).toEqual(memo);
    expect(meta.promptVersion).toBe("memo-v1");
  });

  it.each([
    ["refusal", "refusal"],
    ["max_tokens", "truncated"],
  ])("arrêt %s → erreur %s, trace conservée", async (stop, code) => {
    const { client } = fakeClient({ model: "m", usage, stop_reason: stop, parsed_output: null });
    const error = await createAnthropicProvider({ apiKey: "t", model: MODEL, client })
      .extract(extractionRequest)
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(AiError);
    expect(error).toMatchObject({ code, meta: { usage: { inputTokens: 1200 } } });
  });

  it("sortie non conforme : rejetée", async () => {
    const { client } = fakeClient({
      model: "m",
      usage,
      stop_reason: "end_turn",
      parsed_output: { readable: "oui" },
    });
    await expect(
      createAnthropicProvider({ apiKey: "t", model: MODEL, client }).extract(extractionRequest),
    ).rejects.toMatchObject({ code: "invalid_output" });
  });

  it("panne réseau ou réponse illisible : erreur typée", async () => {
    const { client } = fakeClient(new Error("socket hang up"));
    await expect(
      createAnthropicProvider({ apiKey: "t", model: MODEL, client }).extract(extractionRequest),
    ).rejects.toMatchObject({ code: "invalid_output" });
  });
});
