import { describe, expect, it, vi } from "vitest";
vi.mock("@react-pdf/renderer", () => ({ Document: () => null, Page: () => null, StyleSheet: { create: (x: unknown) => x }, Text: () => null, View: () => null, pdf: () => ({}) }));
import { DEVIS_VEHICULE_DEMO, FACTURE_DIESEL_DEMO } from "../piecesDemo";
import { deriverValeurs } from "@/lib/documents/derivation";

const montant = (t: string) => Number(t.replace(/[^\d,]/g, "").replace(",", "."));
const val = (tab: string[][], cle: string) => montant(tab.find(([a]) => a === cle)![1]);

describe("pièces fictives de la démo (cohérentes, marquées fictives)", () => {
  it("facture de diesel : sous-total = litres × prix ; TPS 5 % ; TVQ 9,975 % ; total", () => {
    const t = FACTURE_DIESEL_DEMO.tableau;
    const ht = val(t, "Sous-total avant taxes");
    expect(Math.round(6840 * 1.398 * 100) / 100).toBe(ht);
    expect(val(t, "TPS (5 %)")).toBe(Math.round(ht * 0.05 * 100) / 100);
    expect(val(t, "TVQ (9,975 %)")).toBe(Math.round(ht * 0.09975 * 100) / 100);
    expect(val(t, "Total")).toBeCloseTo(ht + val(t, "TPS (5 %)") + val(t, "TVQ (9,975 %)"), 2);
    expect(deriverValeurs("fuel_invoice", { carburant: "diesel", litres: 6840, montant_avant_taxes: ht }).cibles[0]).toMatchObject({ valeur: 1.398 });
  });

  it("devis de véhicules : 3 × prix unitaire = sous-total ; taxes et total cohérents", () => {
    const t = DEVIS_VEHICULE_DEMO.tableau;
    const ht = val(t, "Sous-total avant taxes");
    expect(3 * val(t, "Prix unitaire avant taxes")).toBe(ht);
    expect(val(t, "Total")).toBeCloseTo(ht + val(t, "TPS (5 %)") + val(t, "TVQ (9,975 %)"), 2);
  });
});
