import { describe, expect, it } from "vitest";
import {
  InvalidEventError,
  createMemoryAnalytics,
  createPostHogAnalytics,
  type AnalyticsSink,
  type CapturedEvent,
} from "./index";

const calls: { url: string; body: Record<string, unknown> }[] = [];
const fakeFetch = ((url: URL, init: RequestInit) => {
  calls.push({
    url: url.toString(),
    body: JSON.parse(init.body as string) as Record<string, unknown>,
  });
  return Promise.resolve(new Response("{}", { status: 200 }));
}) as unknown as typeof fetch;

const implementations: [string, () => AnalyticsSink][] = [
  ["memory", () => createMemoryAnalytics()],
  [
    "posthog",
    () =>
      createPostHogAnalytics({
        host: "https://eu.i.posthog.com",
        apiKey: "phc_test",
        fetch: fakeFetch,
      }),
  ],
];

const ok: CapturedEvent = {
  event: "request_submitted",
  distinctId: "a1b2c3d4e5f60718",
  properties: { category: "truck", amount_band: "1m_2m" },
  timestamp: new Date("2026-10-26T10:00:00Z"),
};

describe.each(implementations)("contrat AnalyticsSink — %s", (_name, make) => {
  it("accepte un événement objet_action pseudonyme", async () => {
    await expect(make().capture(ok)).resolves.toBeUndefined();
  });

  it.each([
    [{ ...ok, event: "RequestSubmitted" }, /objet_action/],
    [{ ...ok, distinctId: "salma@atlas.ma" }, /pseudonyme/],
    [{ ...ok, properties: { "e-mail": "x" } }, /propriété/],
    [{ ...ok, properties: { category: "x".repeat(81) } }, /valeur/],
  ])("refuse %o", async (e, reason) => {
    await expect(make().capture(e)).rejects.toThrow(InvalidEventError);
    await expect(make().capture(e)).rejects.toThrow(reason);
  });
});

describe("PostHog", () => {
  it("API de capture, sans profil de personne ni IP", async () => {
    calls.length = 0;
    await createPostHogAnalytics({
      host: "https://eu.i.posthog.com",
      apiKey: "phc_test",
      fetch: fakeFetch,
    }).capture(ok);
    expect(calls[0]?.url).toBe("https://eu.i.posthog.com/i/v0/e/");
    expect(calls[0]?.body).toMatchObject({
      api_key: "phc_test",
      event: "request_submitted",
      distinct_id: ok.distinctId,
      properties: { category: "truck", $process_person_profile: false, $ip: null },
    });
  });

  it("refuse un hôte non chiffré ou une clé absente ; signale un refus HTTP", async () => {
    expect(() => createPostHogAnalytics({ host: "http://posthog.example", apiKey: "k" })).toThrow(
      /chiffré/,
    );
    expect(() => createPostHogAnalytics({ host: "https://eu.i.posthog.com", apiKey: "" })).toThrow(
      /clé/,
    );
    const failing = createPostHogAnalytics({
      host: "https://eu.i.posthog.com",
      apiKey: "k",
      fetch: (() => Promise.resolve(new Response("", { status: 401 }))) as unknown as typeof fetch,
    });
    await expect(failing.capture(ok)).rejects.toThrow(/401/);
  });
});
