/**
 * D5 — Import télématique → « Ma flotte » (logique PURE, testée).
 * La télématique ne modifie JAMAIS Ma flotte sans confirmation : cette
 * fonction produit un PLAN (mises à jour, créations, ignorés + raison)
 * que l'écran affiche avant écriture.
 * Rapprochement : lien existant (vehicles.telematics_vehicle_id), puis
 * NIV identique, puis numéro d'unité = identifiant du fournisseur.
 * Règles d'honnêteté :
 * - une donnée du client n'est jamais écrasée par une donnée vide ou
 *   d'identité (NIV/marque/modèle/année seulement si le champ est vide) ;
 * - km/an importé seulement s'il vient d'un odomètre réel ;
 * - consommation importée seulement si mesurée (« telematique ») ;
 * - lignes « a_reverifier » (générées avant la correction de la
 *   phase 2c, valeurs aléatoires) : identité seulement, jamais de mesure.
 */
import type { VehicleInsert, VehicleRow } from "./vehicles";

export interface VehiculeTelematique {
  id: string;
  external_id: string;
  vin: string | null;
  make: string | null;
  model: string | null;
  model_year: number | null;
  vehicle_type: string;
  annual_km: number | null;
  has_real_odometer: boolean | null;
  fuel_consumption: number | null;
  consumption_source: string; // telematique | estimation | a_reverifier
}

export type VehiculeFlotte = Pick<
  VehicleRow,
  "id" | "unit_number" | "vin" | "make" | "model" | "model_year" | "telematics_vehicle_id"
>;

export type RaisonIgnore = "doublon_vin" | "vehicule_deja_rapproche" | "categorie_inconnue" | "choix_creation_absent";

export interface PlanImportTelematique {
  misesAJour: { vehicleId: string; unite: string; telematicsId: string; patch: Partial<VehicleInsert>; par: "lien" | "vin" | "unite" }[];
  creations: { telematicsId: string; vehicule: VehicleInsert }[];
  ignores: { telematicsId: string; externalId: string; raison: RaisonIgnore }[];
  aReverifier: number;
}

/** Correspondance des classes fournisseur → catégories du moteur (null = inconnue). */
export const CATEGORIE_PAR_TYPE: Record<string, string> = {
  "light van": "camionnette",
  van: "camionnette",
  pickup: "camionnette",
  "medium truck": "camion_moyen",
  "heavy truck": "camion_lourd",
  bus: "autobus_urbain_12m",
  car: "vehicule_leger",
};

const normVin = (v: string | null | undefined) => (v ?? "").replace(/\s/g, "").toUpperCase();

function mesures(tv: VehiculeTelematique): Partial<VehicleInsert> {
  if (tv.consumption_source === "a_reverifier") return {};
  const patch: Partial<VehicleInsert> = {};
  if (tv.has_real_odometer && tv.annual_km != null && tv.annual_km > 0) patch.annual_km = tv.annual_km;
  if (tv.consumption_source === "telematique" && tv.fuel_consumption != null && tv.fuel_consumption > 0) {
    patch.consumption_per_100km = tv.fuel_consumption;
    patch.consumption_source = "telematique";
  }
  return patch;
}

export function planifierImportTelematique(
  telematiques: VehiculeTelematique[],
  flotte: VehiculeFlotte[],
  organizationId: string,
  choixCreation: { fuel_type: string; category?: string } | null,
): PlanImportTelematique {
  const plan: PlanImportTelematique = { misesAJour: [], creations: [], ignores: [], aReverifier: 0 };
  const parLien = new Map(flotte.filter((v) => v.telematics_vehicle_id).map((v) => [v.telematics_vehicle_id!, v]));
  const parVin = new Map(flotte.filter((v) => normVin(v.vin)).map((v) => [normVin(v.vin), v]));
  const parUnite = new Map(flotte.map((v) => [v.unit_number.trim(), v]));
  const flotteUtilisee = new Set<string>();
  const vinsVus = new Set<string>();

  for (const tv of telematiques) {
    if (tv.consumption_source === "a_reverifier") plan.aReverifier += 1;
    const vin = normVin(tv.vin);
    if (vin) {
      if (vinsVus.has(vin)) {
        plan.ignores.push({ telematicsId: tv.id, externalId: tv.external_id, raison: "doublon_vin" });
        continue;
      }
      vinsVus.add(vin);
    }

    let cible: VehiculeFlotte | undefined;
    let par: "lien" | "vin" | "unite" = "lien";
    if (parLien.has(tv.id)) {
      cible = parLien.get(tv.id);
    } else if (vin && parVin.has(vin)) {
      cible = parVin.get(vin);
      par = "vin";
    } else if (parUnite.has(tv.external_id.trim())) {
      cible = parUnite.get(tv.external_id.trim());
      par = "unite";
    }

    if (cible) {
      if (flotteUtilisee.has(cible.id)) {
        plan.ignores.push({ telematicsId: tv.id, externalId: tv.external_id, raison: "vehicule_deja_rapproche" });
        continue;
      }
      // un véhicule déjà lié à une AUTRE ligne télématique n'est pas re-lié
      if (cible.telematics_vehicle_id && cible.telematics_vehicle_id !== tv.id) {
        plan.ignores.push({ telematicsId: tv.id, externalId: tv.external_id, raison: "vehicule_deja_rapproche" });
        continue;
      }
      flotteUtilisee.add(cible.id);
      const patch: Partial<VehicleInsert> = { telematics_vehicle_id: tv.id, ...mesures(tv) };
      if (!cible.vin && vin) patch.vin = tv.vin!.trim();
      if (!cible.make && tv.make) patch.make = tv.make;
      if (!cible.model && tv.model) patch.model = tv.model;
      if (cible.model_year == null && tv.model_year != null) patch.model_year = tv.model_year;
      plan.misesAJour.push({ vehicleId: cible.id, unite: cible.unit_number, telematicsId: tv.id, patch, par });
      continue;
    }

    // Création : carburant choisi EXPLICITEMENT par l'utilisateur (jamais deviné)
    if (!choixCreation) {
      plan.ignores.push({ telematicsId: tv.id, externalId: tv.external_id, raison: "choix_creation_absent" });
      continue;
    }
    const categorie = CATEGORIE_PAR_TYPE[tv.vehicle_type.trim().toLowerCase()] ?? choixCreation.category;
    if (!categorie) {
      plan.ignores.push({ telematicsId: tv.id, externalId: tv.external_id, raison: "categorie_inconnue" });
      continue;
    }
    const m = mesures(tv);
    plan.creations.push({
      telematicsId: tv.id,
      vehicule: {
        organization_id: organizationId,
        unit_number: tv.external_id.trim(),
        vin: vin ? tv.vin!.trim() : null,
        make: tv.make,
        model: tv.model,
        model_year: tv.model_year,
        category: categorie,
        fuel_type: choixCreation.fuel_type,
        annual_km: m.annual_km ?? null,
        consumption_per_100km: m.consumption_per_100km ?? null,
        consumption_source: m.consumption_source ?? "estimation",
        status: "actif",
        telematics_vehicle_id: tv.id,
      } as VehicleInsert,
    });
  }
  return plan;
}
