/**
 * Exigences du Fonds municipal vert (FCM) pour les études de flotte —
 * logique PURE, chiffres du moteur uniquement (src/lib/tco) :
 *
 *  1. ANALYSE D'ÉQUITÉ : comment les bénéfices de la stratégie retenue se
 *     répartissent entre les services municipaux et les secteurs (garages)
 *     — véhicules zéro émission, CO2e évité au pot d'échappement (qualité
 *     de l'air locale) et sur le cycle complet, VAN des véhicules — et la
 *     part des bénéfices portée par les services utilisés directement par
 *     la population (transport collectif). Les questions qualitatives
 *     (quartiers desservis, emploi, accessibilité…) sont listées à
 *     documenter par la municipalité : rien n'est inventé.
 *
 *  2. SCÉNARIO DE RÉDUCTION / REDIMENSIONNEMENT : véhicules sous-utilisés
 *     (km/an < seuil × km/an type de la catégorie, registre) ; coût total
 *     actualisé et CO2e évités s'ils ne sont pas remplacés (déplacements
 *     absorbés par le parc restant, non chiffrés) ; pistes de déclassement
 *     vers une catégorie plus petite, chiffrées par le moteur « si l'usage
 *     le permet ».
 *
 * Chaque regroupement est re-chiffré par le moteur sur ses seuls véhicules
 * (sans l'infrastructure partagée, présentée à part par secteur).
 */
import {
  calculerPlan,
  DEFAUTS_CATEGORIES,
  HYPOTHESES,
  type CategorieVehicule,
  type PlanTcoEntree,
} from "@/lib/tco";
import { categorieMoteur } from "./categories";
import { analyserDonneesVehicule } from "./feasibility";
import { cleGarage } from "./infrastructure";
import {
  entreeVehiculeMoteur,
  type OptionsStrategie,
  type StrategieConstruite,
  type TechnoAlternative,
  type VehiculeProjet,
} from "./strategies";

export interface LigneEquite {
  /** Service (département) ou secteur (garage) ; null = non renseigné. */
  libelle: string | null;
  vehicules: number;
  zeroEmission: number;
  co2TtwEviteTonnes: number;
  co2WtwEviteTonnes: number;
  /** VAN différentielle des véhicules du groupe (hors infrastructure partagée). */
  vanVehicules: number;
}

export interface LigneSecteur extends LigneEquite {
  /** Infrastructure du secteur (bornes + raccordement + H2), = plan d'infrastructure. */
  infraCapex: number;
}

/** Questions à documenter par la municipalité (non calculées). */
export const QUESTIONS_EQUITE = [
  "quartiers",
  "qualite_air",
  "emploi",
  "accessibilite",
  "cout_citoyens",
  "consultation",
] as const;
export type QuestionEquite = (typeof QUESTIONS_EQUITE)[number];

export interface AnalyseEquite {
  parService: LigneEquite[];
  parSecteur: LigneSecteur[];
  /** Part du CO2e évité au pot portée par le transport collectif (0-1) ; null si rien d'évité. */
  partTransportCollectifCo2: number | null;
  questions: readonly QuestionEquite[];
}

type VehiculeAvecService = VehiculeProjet & { department?: string | null };

function sousPlan(plan: PlanTcoEntree, ids: Set<string>): PlanTcoEntree {
  return { parametres: plan.parametres, vehicules: plan.vehicules.filter((v) => ids.has(v.id)), sitesInfra: [] };
}

function ligne(plan: PlanTcoEntree, libelle: string | null, ids: Set<string>): LigneEquite {
  const p = sousPlan(plan, ids);
  if (p.vehicules.length === 0) {
    return { libelle, vehicules: 0, zeroEmission: 0, co2TtwEviteTonnes: 0, co2WtwEviteTonnes: 0, vanVehicules: 0 };
  }
  const r = calculerPlan(p);
  return {
    libelle,
    vehicules: p.vehicules.length,
    zeroEmission: p.vehicules.filter((v) => v.alternative.technologie !== "diesel").length,
    co2TtwEviteTonnes: r.co2EviteTtwTonnes,
    co2WtwEviteTonnes: r.co2EviteWtwTonnes,
    vanVehicules: r.vanDifferentielle,
  };
}

function regrouper(vehicules: VehiculeAvecService[], cle: (v: VehiculeAvecService) => string | null) {
  const groupes = new Map<string, { libelle: string | null; ids: Set<string> }>();
  for (const v of vehicules) {
    const libelle = cle(v)?.trim() || null;
    const k = libelle?.toLocaleLowerCase("fr") ?? "";
    const g = groupes.get(k) ?? { libelle, ids: new Set<string>() };
    g.ids.add(v.id);
    groupes.set(k, g);
  }
  return [...groupes.values()];
}

const trier = <T extends LigneEquite>(l: T[]) =>
  l.sort((a, b) => b.co2WtwEviteTonnes - a.co2WtwEviteTonnes || (a.libelle ?? "￿").localeCompare(b.libelle ?? "￿", "fr"));

export function analyserEquite(strategie: StrategieConstruite, vehicules: VehiculeProjet[]): AnalyseEquite {
  const plan = strategie.plan;
  if (!plan) return { parService: [], parSecteur: [], partTransportCollectifCo2: null, questions: QUESTIONS_EQUITE };
  const dansPlan = new Set(plan.vehicules.map((v) => v.id));
  const vs = (vehicules as VehiculeAvecService[]).filter((v) => dansPlan.has(v.id));

  const parService = trier(regrouper(vs, (v) => v.department ?? null).map((g) => ligne(plan, g.libelle, g.ids)));
  const infraParCle = new Map(strategie.infra.garages.map((g) => [g.cle, g.capexTotal]));
  const parSecteur = trier(
    regrouper(vs, (v) => v.depot ?? null).map((g) => ({
      ...ligne(plan, g.libelle, g.ids),
      infraCapex: infraParCle.get(cleGarage(g.libelle)) ?? 0,
    })),
  );

  const transport = new Set(vs.filter((v) => categorieMoteur(v.category) === "autobus_urbain_12m").map((v) => v.id));
  const total = ligne(plan, null, dansPlan).co2TtwEviteTonnes;
  const partTransportCollectifCo2 =
    total > 1e-9 ? Math.max(0, ligne(plan, null, transport).co2TtwEviteTonnes) / total : null;

  return { parService, parSecteur, partTransportCollectifCo2, questions: QUESTIONS_EQUITE };
}

// ---------------------------------------------------------------------------
// Scénario de réduction / redimensionnement
// ---------------------------------------------------------------------------

export interface CandidatReduction {
  id: string;
  unit_number?: string;
  categorie: CategorieVehicule;
  kmParAn: number;
  kmParAnType: number;
  /** km/an ÷ km/an type. */
  ratio: number;
  /** Technologie prévue par la stratégie retenue. */
  technologie: TechnoAlternative;
  /** Coût total actualisé évité si le véhicule n'est pas remplacé (moteur). */
  tcoEvite: number;
  /** CO2e évité sur le cycle complet s'il n'est pas remplacé (t, horizon). */
  co2WtwEviteTonnes: number;
  /** Véhicule saisonnier ou d'urgence (déneigement) : à juger par le service. */
  aJugerParLeService: boolean;
}

export interface PisteDeclassement {
  id: string;
  unit_number?: string;
  de: CategorieVehicule;
  vers: CategorieVehicule;
  /** Coût total actualisé du véhicule actuel − véhicule plus petit (moteur, même km). */
  economie: number;
}

export interface ScenarioReduction {
  /** Seuil du registre (seuil_sous_utilisation_flotte). */
  seuil: number;
  candidats: CandidatReduction[];
  tcoEviteTotal: number;
  co2WtwEviteTotal: number;
  /** Nombre de véhicules du plan (base du pourcentage de réduction). */
  vehiculesDuPlan: number;
  pistes: PisteDeclassement[];
}

const CATEGORIE_PLUS_PETITE: Partial<Record<CategorieVehicule, CategorieVehicule>> = {
  camionnette: "vehicule_leger",
  camion_moyen: "camionnette",
};

/** Mots qui signalent un service saisonnier ou d'urgence dans le nom du département. */
const SERVICES_A_JUGER = /d[ée]neig|urgence|incendie|police|s[ée]curit[ée]/i;

function tcoSeul(plan: PlanTcoEntree, vehicule: PlanTcoEntree["vehicules"][number]) {
  const r = calculerPlan({ parametres: plan.parametres, vehicules: [vehicule], sitesInfra: [] });
  return {
    tco: r.alternative.tcoActualise,
    co2: r.alternative.emissionsWtwTonnes,
  };
}

export function scenarioReduction(
  strategie: StrategieConstruite,
  vehicules: VehiculeProjet[],
  options: OptionsStrategie,
): ScenarioReduction {
  const seuil = HYPOTHESES.seuil_sous_utilisation_flotte.valeur;
  const plan = strategie.plan;
  if (!plan) return { seuil, candidats: [], tcoEviteTotal: 0, co2WtwEviteTotal: 0, vehiculesDuPlan: 0, pistes: [] };
  const parId = new Map((vehicules as VehiculeAvecService[]).map((v) => [v.id, v]));

  const candidats: CandidatReduction[] = [];
  const pistes: PisteDeclassement[] = [];
  for (const pv of plan.vehicules) {
    const v = parId.get(pv.id);
    const categorie = v ? categorieMoteur(v.category) : null;
    if (!v || !categorie) continue;
    const kmParAnType = DEFAUTS_CATEGORIES[categorie].kmParAnDefaut;
    const ratio = pv.kmParAn / kmParAnType;
    if (ratio >= seuil) continue;
    const technologie = pv.alternative.technologie as TechnoAlternative;
    const seul = tcoSeul(plan, pv);
    candidats.push({
      id: pv.id,
      unit_number: v.unit_number,
      categorie,
      kmParAn: pv.kmParAn,
      kmParAnType,
      ratio,
      technologie,
      tcoEvite: seul.tco,
      co2WtwEviteTonnes: seul.co2,
      aJugerParLeService: SERVICES_A_JUGER.test(v.department ?? ""),
    });

    // Déclassement vers une catégorie plus petite (consommation type de
    // cette catégorie, même kilométrage, même technologie, même année).
    const vers = CATEGORIE_PLUS_PETITE[categorie];
    if (vers) {
      const petit = entreeVehiculeMoteur(
        { ...v, category: vers, consumption_per_100km: null, gvwr_class: null, prixDevis: null },
        technologie,
        pv.anneeAcquisition ?? 0,
        options,
      );
      if (petit && analyserDonneesVehicule({ ...v, category: vers }).defauts) {
        const economie = seul.tco - tcoSeul(plan, { ...petit.vehicule, kmParAn: pv.kmParAn }).tco;
        if (economie > 0) pistes.push({ id: pv.id, unit_number: v.unit_number, de: categorie, vers, economie });
      }
    }
  }
  candidats.sort((a, b) => a.ratio - b.ratio || (a.unit_number ?? a.id).localeCompare(b.unit_number ?? b.id, "fr"));
  pistes.sort((a, b) => b.economie - a.economie);
  return {
    seuil,
    candidats,
    tcoEviteTotal: candidats.reduce((s, c) => s + c.tcoEvite, 0),
    co2WtwEviteTotal: candidats.reduce((s, c) => s + c.co2WtwEviteTonnes, 0),
    vehiculesDuPlan: plan.vehicules.length,
    pistes,
  };
}
