import { describe, expect, it } from "vitest";
import { PUBLIC_PAGES } from "@leaseplace/domain";
import { publicPageOf } from "./analytics-client";

describe("pages publiques suivies", () => {
  it("regroupe les chemins en familles de pages, jamais l'URL exacte", () => {
    expect(publicPageOf("/")).toBe("landing");
    expect(publicPageOf("/simulateur")).toBe("simulator");
    expect(publicPageOf("/secteurs/transport")).toBe("sector");
    expect(publicPageOf("/bailleurs")).toBe("lessors");
    expect(publicPageOf("/mentions-legales")).toBe("legal");
    for (const p of ["/", "/simulateur", "/secteurs/btp", "/bailleurs", "/mentions-legales"])
      expect(PUBLIC_PAGES).toContain(publicPageOf(p));
  });
  it("les espaces connectés ne sont pas suivis par le navigateur", () => {
    expect(publicPageOf("/entreprise")).toBeNull();
    expect(publicPageOf("/connexion")).toBeNull();
  });
});
