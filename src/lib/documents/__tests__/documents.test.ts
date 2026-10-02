import { describe, expect, it } from "vitest";
import { deriverValeurs, tarifHq, technologieDevis, typeBorneDepuisPuissance } from "../derivation";
import {
  CHAMPS_DOCUMENT,
  nombreRetrouve,
  nombresDuTexte,
  SCHEMA_EXTRACTION,
  TYPES_DOCUMENT,
  verifierExtraction,
} from "../../../../supabase/functions/_shared/documentSchema";
import { construireStrategie, type VehiculeProjet } from "@/lib/journey/strategies";
import { evaluerFaisabiliteVehicule } from "@/lib/journey/feasibility";
import { BORNES, cleGarage, planifierInfrastructure } from "@/lib/journey/infrastructure";
import { lireDevisBornes } from "@/lib/fleet/garagesModel";
import { HYPOTHESES } from "@/lib/tco";

const OPTIONS = { anneeReference: 2026, horizonAns: 10, tauxActualisationNominal: 0.05, typeOrganisme: "municipalite" as const };

describe("dérivation des valeurs « donnée client » (formule affichée, jamais devinée)", () => {
  it("facture de carburant : prix au litre AVANT taxes = sous-total ÷ litres ; sinon total − TPS − TVQ", () => {
    const r = deriverValeurs("fuel_invoice", { carburant: "Diesel coloré", litres: 4512, montant_avant_taxes: 6411.55 });
    expect(r.cibles).toEqual([
      {
        cible: "diesel_price_per_l",
        valeur: 1.421,
        formule: { operation: "division", operandes: [{ champ: "montant_avant_taxes", valeur: 6411.55 }, { champ: "litres", valeur: 4512 }] },
      },
    ]);
    const sansHt = deriverValeurs("fuel_invoice", { litres: 4512, montant_total: 7371.68, montant_tps: 320.58, montant_tvq: 639.55 });
    expect(sansHt.cibles[0]).toMatchObject({ cible: "diesel_price_per_l", valeur: 1.421, formule: { operation: "soustraction_division" } });
  });

  it("rien n'est dérivé sans les données nécessaires (et la raison est donnée)", () => {
    expect(deriverValeurs("fuel_invoice", { litres: 100, montant_total: 200 }).nonDerivees).toEqual([
      { cible: "diesel_price_per_l", raison: "montant_avant_taxes_absent" },
    ]);
    expect(deriverValeurs("fuel_invoice", { montant_avant_taxes: 200 }).nonDerivees[0].raison).toBe("quantite_absente");
    expect(deriverValeurs("fuel_invoice", { carburant: "Essence", litres: 100, montant_avant_taxes: 150 }).nonDerivees[0].raison).toBe(
      "carburant_non_diesel",
    );
    // prix absurde (erreur de lecture probable) : refusé
    expect(deriverValeurs("fuel_invoice", { litres: 1, montant_avant_taxes: 6411.55 }).nonDerivees[0].raison).toBe("valeur_hors_bornes");
  });

  it("facture Hydro-Québec : coût effectif $/kWh avant taxes + code tarifaire", () => {
    const r = deriverValeurs("electricity_invoice", { kwh: 48210, montant_avant_taxes: 4987.32, tarif: "Tarif M" });
    expect(r.cibles).toEqual([
      expect.objectContaining({ cible: "electricity_cost_per_kwh", valeur: 0.1034 }),
      { cible: "hq_rate", valeur: "M", formule: null },
    ]);
    expect(tarifHq("lg")).toBe("LG");
    expect(tarifHq("Tarif D")).toBe("autre");
    expect(tarifHq("")).toBeNull();
  });

  it("devis de véhicule : prix unitaire imprimé, sinon total ÷ quantité ; technologie reconnue", () => {
    expect(deriverValeurs("vehicle_quote", { technologie: "100 % électrique", prix_unitaire_avant_taxes: 78500 }).cibles[0]).toMatchObject({
      cible: "vehicle_quote_price",
      valeur: 78500,
      technologie: "bev",
    });
    expect(deriverValeurs("vehicle_quote", { technologie: "Pile à combustible hydrogène", montant_avant_taxes: 900000, quantite: 3 }).cibles[0]).toMatchObject({
      valeur: 300000,
      technologie: "fcev",
    });
    expect(deriverValeurs("vehicle_quote", { technologie: "Hybride rechargeable", prix_unitaire_avant_taxes: 60000 }).nonDerivees[0].raison).toBe(
      "technologie_non_zero_emission",
    );
    expect(technologieDevis("Battery electric (BEV)")).toBe("bev");
  });

  it("devis de bornes : coût unitaire installé = total ÷ nombre ; type selon la puissance (modifiable)", () => {
    const r = deriverValeurs("charger_quote", { nombre_bornes: 4, puissance_kw_par_borne: 19.2, montant_avant_taxes: 38000 });
    expect(r.cibles[0]).toMatchObject({ cible: "charger_unit_cost", valeur: 9500, typeBorne: "niveau2" });
    expect(deriverValeurs("charger_quote", { nombre_bornes: 2, montant_avant_taxes: 96000 }, { typeBorne: "rapide50" }).cibles[0]).toMatchObject({
      typeBorne: "rapide50",
      valeur: 48000,
    });
    expect(deriverValeurs("charger_quote", { nombre_bornes: 2, montant_avant_taxes: 96000 }).nonDerivees[0].raison).toBe("puissance_borne_absente");
    expect([typeBorneDepuisPuissance(7.2), typeBorneDepuisPuissance(50), typeBorneDepuisPuissance(180)]).toEqual(["niveau2", "rapide50", "rapide150"]);
  });

  it("devis de raccordement : montant avant taxes", () => {
    expect(deriverValeurs("grid_quote", { montant_avant_taxes: 85000 }).cibles[0]).toMatchObject({ cible: "grid_connection_quote", valeur: 85000 });
  });
});

describe("vérification d'une extraction contre le texte du document", () => {
  const texte = "Total 7 371,68 $ — Sous-total 6,411.55 — 4 512,0 L — Tarif M";
  it("nombres imprimés en convention fr ou en", () => {
    const n = nombresDuTexte(texte);
    expect(nombreRetrouve(7371.68, n)).toBe(true);
    expect(nombreRetrouve(6411.55, n)).toBe(true);
    expect(nombreRetrouve(4512, n)).toBe(true);
    expect(nombreRetrouve(4513, n)).toBe(false);
  });

  it("un champ par clé (le plus sûr), champs hors type rejetés", () => {
    const { extraction, rejets } = verifierExtraction(
      {
        type_detecte: "electricity_invoice",
        fournisseur: "Hydro-Québec",
        date_document: "2026-09-30",
        garage_propose: "",
        champs: [
          { champ: "tarif", valeur_nombre: null, valeur_texte: "M", extrait: "Tarif M", page: 1, certitude: "probable" },
          { champ: "tarif", valeur_nombre: null, valeur_texte: "M", extrait: "Tarif M", page: 1, certitude: "sure" },
          { champ: "litres", valeur_nombre: 10, valeur_texte: "", extrait: "", page: 1, certitude: "sure" },
          { champ: "kwh", valeur_nombre: -5, valeur_texte: "", extrait: "", page: 1, certitude: "sure" },
        ],
      },
      "electricity_invoice",
      texte,
      [],
    );
    expect(extraction.champs).toHaveLength(1);
    expect(extraction.champs[0]).toMatchObject({ champ: "tarif", certitude: "sure", retrouve: true });
    expect(rejets).toBe(3);
  });

  it("le schéma imposé couvre tous les champs de tous les types", () => {
    const enumere = new Set(SCHEMA_EXTRACTION.properties.champs.items.properties.champ.enum);
    for (const t of TYPES_DOCUMENT) for (const c of CHAMPS_DOCUMENT[t]) expect(enumere.has(c.cle)).toBe(true);
  });
});

describe("le moteur utilise les devis confirmés", () => {
  const vehicule = (patch: Partial<VehiculeProjet> = {}): VehiculeProjet => ({
    id: "v1",
    category: "camionnette",
    fuel_type: "diesel",
    annual_km: 30000,
    consumption_per_100km: 16,
    consumption_source: "saisie",
    usage_profile: "urbain",
    replacement_year: 2027,
    target_technology: "bev",
    ...patch,
  });

  it("prix devisé du véhicule : remplace le prix du registre dans SA technologie seulement", () => {
    const base = construireStrategie([vehicule()], "plan_actuel", OPTIONS);
    const devis = construireStrategie([vehicule({ prixDevis: { technologie: "BEV", prix: 61000 } })], "plan_actuel", OPTIONS);
    expect(devis.plan!.vehicules[0].alternative.prixAvantTaxes).toBe(61000);
    expect(base.plan!.vehicules[0].alternative.prixAvantTaxes).not.toBe(61000);
    const autreTechno = construireStrategie(
      [vehicule({ target_technology: "fcev", prixDevis: { technologie: "BEV", prix: 61000 } })],
      "plan_actuel",
      OPTIONS,
    );
    expect(autreTechno.plan!.vehicules[0].alternative.prixAvantTaxes).not.toBe(61000);
    // Faisabilité : même prix que le Plan
    const f = evaluerFaisabiliteVehicule(vehicule({ prixDevis: { technologie: "BEV", prix: 61000 } }), OPTIONS);
    const fBase = evaluerFaisabiliteVehicule(vehicule(), OPTIONS);
    const bev = (x: typeof f) => x.evaluations!.find((e) => e.technologie === "BEV")!;
    expect(bev(f).economieActualisee).toBeGreaterThan(bev(fBase).economieActualisee);
  });

  it("devis de bornes d'un garage : coût unitaire devisé au lieu du registre, source « devis »", () => {
    const vehicules = [
      { id: "a", category: "camionnette", depot: "Garage municipal", technologie: "BEV" as const, anneeAcquisition: 0 },
      { id: "b", category: "camionnette", depot: "Garage municipal", technologie: "BEV" as const, anneeAcquisition: 0 },
    ];
    const registre = planifierInfrastructure(vehicules, { anneeReference: 2026 });
    expect(registre.garages[0].capexBornes).toBe(2 * BORNES.niveau2.capex);
    expect(registre.garages[0].bornesSource).toBe("registre");
    const garages = new Map([[cleGarage("Garage municipal"), { coutBorneDevis: lireDevisBornes({ niveau2: 9500, inconnu: 3, rapide50: -1 }) }]]);
    const devis = planifierInfrastructure(vehicules, { anneeReference: 2026, garages });
    expect(devis.garages[0].capexBornes).toBe(19000);
    expect(devis.garages[0].bornesSource).toBe("devis");
    expect(lireDevisBornes({ niveau2: 9500, inconnu: 3, rapide50: -1 })).toEqual({ niveau2: 9500 });
    expect(HYPOTHESES.borne_niveau2_installee.valeur).toBe(BORNES.niveau2.capex);
  });
});

describe("écritures d'une pièce confirmée (aperçu avant → après)", () => {
  const ctx = {
    portee: "organisation" as const,
    energieActuelle: { diesel_price_per_l: 1.52, electricity_cost_per_kwh: null },
    garage: { id: "g1", name: "Garage municipal", hq_rate: "G", grid_connection_quote: null, charger_unit_quote: { rapide50: 48000 } },
    vehicules: [
      { id: "pv1", unite: "GM-01", quote_price: null, quote_technology: null },
      { id: "pv2", unite: "GM-02", quote_price: 70000, quote_technology: "bev" },
    ],
  };

  it("prix d'énergie, tarif, devis de bornes (autres types conservés), raccordement, devis de véhicules", async () => {
    const { planifierEcritures, changementsJournal } = await import("../application");
    const { ecritures, blocages } = planifierEcritures(
      [
        ...deriverValeurs("fuel_invoice", { litres: 4512, montant_avant_taxes: 6411.55 }).cibles,
        ...deriverValeurs("electricity_invoice", { kwh: 1000, montant_avant_taxes: 103.4, tarif: "M" }).cibles,
        ...deriverValeurs("charger_quote", { nombre_bornes: 4, puissance_kw_par_borne: 19.2, montant_avant_taxes: 38000 }).cibles,
        ...deriverValeurs("grid_quote", { montant_avant_taxes: 85000 }).cibles,
        ...deriverValeurs("vehicle_quote", { technologie: "électrique", prix_unitaire_avant_taxes: 78500 }).cibles,
      ],
      ctx,
    );
    expect(blocages).toEqual([]);
    expect(changementsJournal(ecritures)).toEqual([
      { cible: "organisation", champ: "diesel_price_per_l", avant: 1.52, apres: 1.421 },
      { cible: "organisation", champ: "electricity_cost_per_kwh", avant: null, apres: 0.1034 },
      { cible: "Garage municipal", champ: "hq_rate", avant: "G", apres: "M" },
      { cible: "Garage municipal", champ: "charger_unit_quote.niveau2", avant: null, apres: 9500 },
      { cible: "Garage municipal", champ: "grid_connection_quote", avant: null, apres: 85000 },
      { cible: "GM-01", champ: "quote_price", avant: null, apres: 78500 },
      { cible: "GM-02", champ: "quote_price", avant: 70000, apres: 78500 },
    ]);
    const bornes = ecritures.find((e) => e.champ === "charger_unit_quote");
    expect(bornes && "devisComplet" in bornes ? bornes.devisComplet : null).toEqual({ rapide50: 48000, niveau2: 9500 });
  });

  it("garage ou véhicules manquants : bloqué (rien d'écrit en silence)", async () => {
    const { planifierEcritures } = await import("../application");
    const r = planifierEcritures(
      [...deriverValeurs("grid_quote", { montant_avant_taxes: 85000 }).cibles, ...deriverValeurs("vehicle_quote", { technologie: "BEV", prix_unitaire_avant_taxes: 1 }).cibles],
      { ...ctx, garage: null, vehicules: [] },
    );
    expect(r.ecritures).toEqual([]);
    expect(r.blocages.sort()).toEqual(["garage_requis", "vehicules_requis"]);
  });
});
