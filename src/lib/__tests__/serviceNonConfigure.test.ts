import { describe, expect, it } from "vitest";
import { estServiceNonConfigure } from "../serviceNonConfigure";

const reponse = (status: number, corps: unknown) =>
  new Response(typeof corps === "string" ? corps : JSON.stringify(corps), { status });

describe("estServiceNonConfigure", () => {
  it("503 service_non_configure (erreur functions.invoke avec context) → vrai", async () => {
    expect(await estServiceNonConfigure({ context: reponse(503, { error: "service_non_configure" }) })).toBe(true);
  });

  it("Response directe (fetch) → vrai ; corps relisible ensuite", async () => {
    const r = reponse(503, { error: "service_non_configure" });
    expect(await estServiceNonConfigure(r)).toBe(true);
    expect(await r.json()).toEqual({ error: "service_non_configure" });
  });

  it("autres erreurs → faux (500, 503 d'une autre cause, corps illisible, pas de contexte)", async () => {
    expect(await estServiceNonConfigure({ context: reponse(500, { error: "service_non_configure" }) })).toBe(false);
    expect(await estServiceNonConfigure({ context: reponse(503, { error: "Too busy" }) })).toBe(false);
    expect(await estServiceNonConfigure({ context: reponse(503, "<html>") })).toBe(false);
    expect(await estServiceNonConfigure(new Error("réseau"))).toBe(false);
    expect(await estServiceNonConfigure(null)).toBe(false);
  });
});
