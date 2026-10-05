/**
 * Point 4 — recalcul planifié des alertes côté serveur : l'écran et le
 * serveur partagent surveillanceProjet.ts (aucune divergence possible).
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import i18next from "i18next";
import fr from "@/i18n/locales/fr/translation.json";
import en from "@/i18n/locales/en/translation.json";
import { normalizeTranslations, type TranslationDict } from "@/i18n/normalize";
import type { ProjectVehicleWithVehicle } from "@/lib/fleet/projectVehicles";
import { genererFlotteDemo, lignesGaragesDemo, planDemo } from "@/lib/demoData/villeDemo";
import { alertesDuProjet, chargeSynchronisation, optionsProjet, prixDuSnapshot, typeOrganismeValide } from "../surveillanceProjet";

const racine = resolve(__dirname, "../../../..");

function vehiculesProjet(anneeCourante: number): ProjectVehicleWithVehicle[] {
  const flotte = genererFlotteDemo();
  const plan = planDemo(flotte, anneeCourante);
  return flotte.map((v, i) => ({
    id: `pv-${i}`,
    project_id: "p",
    vehicle_id: v.unit_number,
    replacement_year: plan[i].replacement_year,
    target_technology: plan[i].target_technology,
    completed_date: null,
    quote_price: null,
    quote_technology: null,
    quote_document_id: null,
    vehicles: { ...v, id: v.unit_number, garage_id: null, notes: null },
  })) as unknown as ProjectVehicleWithVehicle[];
}

function t() {
  const i = i18next.createInstance();
  void i.init({
    resources: {
      fr: { translation: normalizeTranslations(fr as unknown as TranslationDict) },
      en: { translation: normalizeTranslations(en as unknown as TranslationDict) },
    },
    lng: "fr",
    interpolation: { escapeValue: false },
    initImmediate: false,
  });
  return { fr: i.getFixedT("fr"), en: i.getFixedT("en") };
}

const options = optionsProjet({
  anneeReference: 2026,
  horizonAns: 15,
  tauxActualisationStocke: 0.05,
  typeOrganisme: "municipalite",
  surcharges: { dieselParL: undefined, electriciteEffectiveParKwh: undefined, h2LivreParKg: undefined, devisRaccordement: undefined, provenances: [] },
  garages: lignesGaragesDemo(),
});

describe("surveillance d'un projet — module partagé écran / serveur", () => {
  it("options : taux en fraction, garages indexés, type d'organisme validé", () => {
    expect(options.tauxActualisationNominal).toBeCloseTo(0.05, 10);
    expect(options.garages?.size).toBeGreaterThan(0);
    expect(typeOrganismeValide("societe_transport")).toBe("societe_transport");
    expect(typeOrganismeValide("autre")).toBeNull();
  });

  it("déterministe : mêmes lignes → mêmes alertes ; projet sans véhicule → aucune", () => {
    const entree = { aujourdHui: "2026-10-05", options, projectVehicles: vehiculesProjet(2026), confirmeesParVehicule: new Map(), snapshot: null, evenements: [], demandes: [] };
    expect(alertesDuProjet(entree)).toEqual(alertesDuProjet(entree));
    expect(alertesDuProjet({ ...entree, projectVehicles: [] })).toEqual([]);
  });

  it("remplacement en retard détecté (même règle que l'écran)", () => {
    const pv = vehiculesProjet(2026);
    pv[0] = { ...pv[0], replacement_year: 2024 };
    const alertes = alertesDuProjet({ aujourdHui: "2026-10-05", options, projectVehicles: pv, confirmeesParVehicule: new Map(), snapshot: null, evenements: [], demandes: [] });
    expect(alertes.some((a) => a.type === "remplacement_retard")).toBe(true);
  });

  it("charge de synchronisation : textes fr/en rendus et bornés aux limites de la table", () => {
    const pv = vehiculesProjet(2026);
    pv[0] = { ...pv[0], replacement_year: 2024 };
    const alertes = alertesDuProjet({ aujourdHui: "2026-10-05", options, projectVehicles: pv, confirmeesParVehicule: new Map(), snapshot: null, evenements: [], demandes: [] });
    const tr = t();
    const charge = chargeSynchronisation(alertes, tr.fr, tr.en);
    expect(charge).toHaveLength(alertes.length);
    for (const c of charge) {
      expect(c.title_fr.length).toBeGreaterThan(0);
      expect(c.title_fr.length).toBeLessThanOrEqual(300);
      expect(c.message_en.length).toBeLessThanOrEqual(1500);
      expect(c.title_fr).not.toMatch(/journey\.|surveillance\./); // aucune clé brute
    }
  });

  it("prix du dernier rapport : lus seulement s'ils sont complets", () => {
    expect(prixDuSnapshot({ parametres: { prixAnnee0: { dieselParL: 2, electriciteEffectiveParKwh: 0.1, h2LivreParKg: 12 } } })).toEqual({ dieselParL: 2, electriciteEffectiveParKwh: 0.1, h2LivreParKg: 12 });
    expect(prixDuSnapshot({ parametres: { prixAnnee0: { dieselParL: 2 } } })).toBeNull();
  });
});

describe("recalcul planifié : branché partout", () => {
  const lire = (f: string) => readFileSync(resolve(racine, f), "utf8");
  it("l'écran et le serveur appellent le même module", () => {
    expect(lire("src/hooks/usePlanSurveillance.ts")).toContain("alertesDuProjet(");
    expect(lire("src/hooks/useEnergyClientInputs.ts")).toContain("optionsProjet(");
    const serveur = lire("src/lib/journey/recalculAlertesServeur.ts");
    expect(serveur).toContain("alertesDuProjet(");
    expect(serveur).toContain("sync_plan_alerts_serveur");
  });
  it("workflow quotidien avant le résumé courriel + vérification d'absence d'écart en CI", () => {
    const wf = lire(".github/workflows/recalcul-alertes.yml");
    expect(wf).toMatch(/cron: "23 10 \* \* \*"/);
    expect(wf).toContain("node scripts/alertes/recalcul-alertes.mjs --heberge");
    expect(lire(".github/workflows/ci.yml")).toContain("--verifier-aucun-changement");
  });
  it("fonction SQL réservée au service_role", () => {
    const sql = lire("supabase/migrations/20261008020000_sync_plan_alerts_serveur.sql");
    expect(sql).toMatch(/REVOKE ALL ON FUNCTION public\.sync_plan_alerts_serveur\(UUID, JSONB\) FROM anon, authenticated;/);
    expect(sql).toMatch(/GRANT EXECUTE ON FUNCTION public\.sync_plan_alerts_serveur\(UUID, JSONB\) TO service_role;/);
  });
});
