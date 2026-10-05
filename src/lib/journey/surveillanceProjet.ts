/**
 * Surveillance d'un projet — assemblage PUR partagé par l'écran
 * (src/hooks/usePlanSurveillance.ts, src/hooks/useEnergyClientInputs.ts) et
 * le recalcul planifié côté serveur (src/lib/journey/recalculAlertesServeur.ts,
 * lancé chaque nuit par .github/workflows/recalcul-alertes.yml).
 *
 * Une seule fonction construit les options du moteur et les alertes à
 * partir des lignes de la base : l'écran et le serveur ne peuvent pas
 * diverger (vérifié en CI : recalcul serveur après le parcours e2e =
 * aucune alerte nouvelle ni résolue).
 */
import type { TFunction } from "i18next";
import { tauxActualisationDepuisProjet } from "@/lib/projectParams";
import type { SurchargesEnergieClient } from "@/lib/energyClient";
import { caracteristiquesGarages } from "@/lib/fleet/garagesModel";
import type { GarageRow } from "@/lib/fleet/garagesModel";
import type { ProjectVehicleWithVehicle } from "@/lib/fleet/projectVehicles";
import type { SubventionConfirmee } from "@/lib/confirmedSubsidies";
import { construireStrategie, type OptionsStrategie } from "./strategies";
import { vehiculeProjetDepuis } from "./vehiculeProjet";
import { surveillerPlan, type AlertePlan, type PrixEnergie } from "./surveillance";
import { texteAlerte } from "@/components/journey/surveillanceTexts";

export type TypeOrganisme = "municipalite" | "societe_transport" | "entreprise";

export function typeOrganismeValide(v: unknown): TypeOrganisme | null {
  return v === "municipalite" || v === "societe_transport" || v === "entreprise" ? v : null;
}

/** Options du moteur d'un projet : mêmes entrées pour toutes les étapes. */
export function optionsProjet(entree: {
  anneeReference: number;
  horizonAns: number;
  tauxActualisationStocke: number;
  typeOrganisme: TypeOrganisme;
  surcharges: SurchargesEnergieClient;
  garages: GarageRow[];
}): OptionsStrategie {
  return {
    anneeReference: entree.anneeReference,
    horizonAns: entree.horizonAns,
    // fraction décimale (0.05 = 5 %) — anciens instantanés en % convertis
    tauxActualisationNominal: tauxActualisationDepuisProjet(entree.tauxActualisationStocke),
    typeOrganisme: entree.typeOrganisme,
    surchargesEnergie: {
      dieselParL: entree.surcharges.dieselParL,
      electriciteEffectiveParKwh: entree.surcharges.electriciteEffectiveParKwh,
      h2LivreParKg: entree.surcharges.h2LivreParKg,
      devisRaccordement: entree.surcharges.devisRaccordement,
    },
    garages: caracteristiquesGarages(entree.garages),
  };
}

/** Prix utilisés au dernier rapport (snapshot : parameters.parametres.prixAnnee0). */
export function prixDuSnapshot(parameters: unknown): PrixEnergie | null {
  const p = (parameters as { parametres?: { prixAnnee0?: Partial<PrixEnergie> } } | null)?.parametres?.prixAnnee0;
  if (!p || typeof p.dieselParL !== "number" || typeof p.electriciteEffectiveParKwh !== "number" || typeof p.h2LivreParKg !== "number") {
    return null;
  }
  return { dieselParL: p.dieselParL, electriciteEffectiveParKwh: p.electriciteEffectiveParKwh, h2LivreParKg: p.h2LivreParKg };
}

export interface SnapshotSurveillance {
  id: string;
  created_at: string;
  parameters: unknown;
  van: number | null;
  fingerprint: string;
}

export interface EvenementSurveillance {
  id: string;
  program_id: string;
  summary_fr: string;
  summary_en: string;
  validated_at: string | null;
}

/** Alertes calculées par le moteur pour un projet (déterministe). */
export function alertesDuProjet(entree: {
  aujourdHui: string;
  options: OptionsStrategie;
  projectVehicles: ProjectVehicleWithVehicle[];
  confirmeesParVehicule: Map<string, SubventionConfirmee[]>;
  snapshot: SnapshotSurveillance | null;
  evenements: EvenementSurveillance[];
  demandes: { program_id: string; status: string }[];
}): AlertePlan[] {
  const { projectVehicles, snapshot } = entree;
  const vehicules = projectVehicles.map((pv) => vehiculeProjetDepuis(pv, entree.confirmeesParVehicule.get(pv.vehicle_id)));
  if (vehicules.length === 0) return [];
  const strategie = construireStrategie(vehicules, "plan_actuel", entree.options);
  return surveillerPlan({
    aujourdHui: entree.aujourdHui,
    strategie,
    vehicules: projectVehicles.map((pv) => ({
      id: pv.vehicle_id,
      unite: pv.vehicles.unit_number,
      anneeRemplacement: pv.replacement_year,
      realise: !!pv.completed_date,
    })),
    dernierRapport: snapshot
      ? {
          id: snapshot.id,
          date: snapshot.created_at,
          prix: prixDuSnapshot(snapshot.parameters),
          van: snapshot.van,
          empreinte: snapshot.fingerprint,
          parametres: (snapshot.parameters as { parametres?: unknown } | null)?.parametres,
        }
      : null,
    evenements: entree.evenements.map((e) => ({
      id: e.id,
      programId: e.program_id,
      resumeFr: e.summary_fr,
      resumeEn: e.summary_en,
      valideLe: e.validated_at,
    })),
    demandes: entree.demandes.map((a) => ({ programId: a.program_id, statut: a.status })),
  });
}

export interface LigneSynchroAlerte {
  alert_key: string;
  kind: string;
  severity: string;
  title_fr: string;
  title_en: string;
  message_fr: string;
  message_en: string;
}

/** Charge envoyée à sync_plan_alerts (textes fr/en rendus, bornés). */
export function chargeSynchronisation(alertes: AlertePlan[], fr: TFunction, en: TFunction): LigneSynchroAlerte[] {
  return alertes.map((a) => {
    const tFr = texteAlerte(a, fr, "fr");
    const tEn = texteAlerte(a, en, "en");
    return {
      alert_key: a.cle,
      kind: a.type,
      severity: a.gravite,
      title_fr: tFr.titre.slice(0, 300),
      title_en: tEn.titre.slice(0, 300),
      message_fr: tFr.message.slice(0, 1500),
      message_en: tEn.message.slice(0, 1500),
    };
  });
}
