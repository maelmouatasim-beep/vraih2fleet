import { describe, expect, it } from "vitest";
import Papa from "papaparse";
import { modeleCsv, modeleImport } from "../importTemplate";
import { validerLignes } from "../importVehicles";

describe("modèle d'import (bloc 2.5)", () => {
  for (const langue of ["fr", "en"] as const) {
    it(`le modèle ${langue} rempli tel quel s'importe sans erreur, tous les champs reconnus`, () => {
      const { data } = Papa.parse<Record<string, unknown>>(modeleCsv(langue), { header: true, skipEmptyLines: true, dynamicTyping: true });
      const r = validerLignes(data, "org", new Map());
      expect(r.erreurs).toEqual([]);
      expect(r.valides).toHaveLength(3);
      const [corolla, f150, deneigeuse] = r.valides;
      expect(corolla).toMatchObject({ category: "vehicule_leger", fuel_type: "essence", consumption_per_100km: 6.5, depot: "Hôtel de ville", gvwr_class: "1", max_daily_km: 80 });
      expect(f150).toMatchObject({ category: "camionnette", gvwr_class: "2a", depot: "Travaux publics" });
      expect(deneigeuse).toMatchObject({ category: "deneigeuse", gvwr_class: "8", usage_profile: "hors_route", in_service_date: "2012-11-01" });
    });
  }

  it("Lisez-moi : une ligne par colonne avec obligatoire, description et valeurs acceptées (synonymes FR/EN)", () => {
    const m = modeleImport("fr");
    const parColonne = new Map(m.lisezMoi.slice(5).map((l) => [l[0], l]));
    expect(parColonne.size).toBe(m.entetes.length);
    expect(parColonne.get("Unité")![1]).toBe("oui");
    expect(String(parColonne.get("Catégorie")![3])).toContain("deneigeuse (chasse_neige");
    expect(String(parColonne.get("Catégorie")![3])).toContain("dump_truck");
    expect(String(parColonne.get("Classe PNBV")![3])).toBe("1, 2a, 2b, 3, 4, 5, 6, 7, 8");
  });
});
