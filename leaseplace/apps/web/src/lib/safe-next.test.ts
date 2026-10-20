import { describe, expect, it } from "vitest";
import { safeNext } from "./safe-next";

describe("safeNext", () => {
  it("accepte les espaces connus", () => {
    expect(safeNext("/bailleur")).toBe("/bailleur");
    expect(safeNext("/admin/journal")).toBe("/admin/journal");
    expect(safeNext("/entreprise")).toBe("/entreprise");
  });

  it("refuse toute redirection ouverte ou inconnue", () => {
    for (const v of [
      null,
      undefined,
      "",
      "https://evil.example",
      "//evil.example",
      "/\\evil",
      "/adminx",
      "/demo",
    ]) {
      expect(safeNext(v)).toBe("/espace");
    }
  });
});
