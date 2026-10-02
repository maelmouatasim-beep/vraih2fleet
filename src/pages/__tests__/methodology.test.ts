import { describe, expect, it } from "vitest";
import { ENGINE_VERSION, LISTE_HYPOTHESES } from "@/lib/tco";
import methodologie from "../../../docs/tco-methodologie.md?raw";
import hypotheses from "../../../docs/tco-hypotheses.md?raw";

describe("méthodologie publique = document de référence du dépôt (Phase 4)", () => {
  it("la spécification publiée décrit la version ACTUELLE du moteur", () => {
    expect(methodologie).toContain(`engineVersion ${ENGINE_VERSION}`);
  });

  it("le registre publié contient chaque hypothèse du moteur", () => {
    for (const h of LISTE_HYPOTHESES) expect(hypotheses).toContain(h.description);
  });
});
