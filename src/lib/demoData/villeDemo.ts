/**
 * Flotte de DÉMONSTRATION : « Ville de Rivière-Claire », municipalité
 * QUÉBÉCOISE FICTIVE d'environ 40 véhicules. Données DÉTERMINISTES
 * (aucun aléatoire) et clairement étiquetées fictives — elles servent à
 * montrer le parcours, jamais à suggérer un client réel ni des
 * résultats prouvés. Les calculs, eux, sont faits en direct par le
 * moteur src/lib/tco sur ces véhicules.
 */
import { anneeRemplacementSuggeree } from "@/lib/fleet/replacement";

export const NOM_PROJET_DEMO = "Démo — Ville de Rivière-Claire";
export const MARQUEUR_DEMO = "demo-h2fleet";

/** Un véhicule de la démo se reconnaît à son marqueur dans les notes (C7). */
export function estVehiculeDemo(notes: string | null | undefined): boolean {
  return !!notes && notes.includes(MARQUEUR_DEMO);
}

export interface VehiculeDemo {
  unit_number: string;
  /** Classe de poids PNBV CONFIRMÉE (fiche technique du modèle, fictive). */
  gvwr_class: string;
  /** Kilométrage journalier maximal relevé (fictif) — diagnostic hiver. */
  max_daily_km: number;
  make: string;
  model: string;
  model_year: number;
  category: string;
  fuel_type: string;
  annual_km: number;
  consumption_per_100km: number;
  consumption_source: string;
  usage_profile: string;
  department: string;
  depot: string;
  status: string;
  notes: string;
}

export interface PlanVehiculeDemo {
  unit_number: string;
  replacement_year: number;
  target_technology: "diesel" | "bev" | "fcev";
}

interface GabaritCategorie {
  prefixe: string;
  nombre: number;
  category: string;
  makes: [string, string];
  models: [string, string];
  /** Classe PNBV de chaque modèle (fiches techniques usuelles). */
  classes: [string, string];
  /** Jours de service par an (km journalier max ≈ km/an ÷ jours × 1,4). */
  joursService: number;
  kmBase: number;
  kmPas: number;
  consoBase: number;
  consoPas: number;
  usage: string;
  departments: string[];
}

// ~40 véhicules municipaux plausibles : consommations réparties autour
// des défauts de catégorie du moteur, âges étalés (fins de vie 2027+).
const GABARITS: GabaritCategorie[] = [
  {
    prefixe: "VL", nombre: 10, category: "vehicule_leger",
    makes: ["Toyota", "Chevrolet"], models: ["Corolla", "Equinox"], classes: ["1", "1"], joursService: 230,
    kmBase: 12000, kmPas: 1500, consoBase: 7.8, consoPas: 0.35,
    usage: "urbain", departments: ["Inspection", "Administration", "Loisirs"],
  },
  {
    prefixe: "C", nombre: 12, category: "camionnette",
    makes: ["Ford", "RAM"], models: ["F-250", "2500"], classes: ["2b", "2b"], joursService: 240,
    kmBase: 16000, kmPas: 1800, consoBase: 13.5, consoPas: 0.45,
    usage: "urbain", departments: ["Travaux publics", "Parcs", "Aqueduc"],
  },
  {
    prefixe: "CM", nombre: 9, category: "camion_moyen",
    makes: ["Freightliner", "International"], models: ["M2 106", "MV607"], classes: ["6", "7"], joursService: 240,
    kmBase: 18000, kmPas: 2600, consoBase: 24, consoPas: 0.9,
    usage: "regional", departments: ["Voirie", "Collecte"],
  },
  {
    prefixe: "CL", nombre: 5, category: "camion_lourd",
    makes: ["Mack", "Western Star"], models: ["Granite", "47X"], classes: ["8", "8"], joursService: 220,
    kmBase: 26000, kmPas: 4200, consoBase: 33, consoPas: 1.4,
    usage: "regional", departments: ["Voirie", "Déneigement"],
  },
  {
    prefixe: "B", nombre: 4, category: "autobus_urbain_12m",
    makes: ["Nova Bus", "Nova Bus"], models: ["LFS", "LFS"], classes: ["8", "8"], joursService: 300,
    kmBase: 46000, kmPas: 3500, consoBase: 43, consoPas: 1.2,
    usage: "urbain", departments: ["Transport collectif"],
  },
];

function arrondi(n: number, decimales = 1): number {
  const f = Math.pow(10, decimales);
  return Math.round(n * f) / f;
}

export function genererFlotteDemo(): VehiculeDemo[] {
  const vehicules: VehiculeDemo[] = [];
  for (const g of GABARITS) {
    for (let i = 0; i < g.nombre; i++) {
      const numero = String(i + 1).padStart(2, "0");
      const unite = `${g.prefixe}-${numero}`;
      // CL-01 : transport de sel sur la route régionale (longues journées
      // l'hiver) — le cas où l'autonomie d'un camion électrique ne suffit pas.
      const routeRegionale = unite === UNITE_ROUTE_REGIONALE;
      const annual_km = routeRegionale ? 52000 : g.kmBase + i * g.kmPas;
      vehicules.push({
        unit_number: unite,
        gvwr_class: g.classes[i % 2],
        max_daily_km: routeRegionale ? 420 : Math.round((annual_km / g.joursService) * 1.4),
        make: g.makes[i % 2],
        model: g.models[i % 2],
        // âges étalés de façon déterministe (2010..2021 selon la position)
        model_year: 2010 + ((i * 5 + g.nombre) % 12),
        category: g.category,
        fuel_type: "diesel",
        annual_km,
        consumption_per_100km: arrondi(g.consoBase + (i % 5) * g.consoPas),
        // C7 : donnée FICTIVE, jamais présentée comme une saisie réelle
        consumption_source: "estimation",
        usage_profile: g.usage,
        department: routeRegionale ? "Déneigement — route régionale" : g.departments[i % g.departments.length],
        depot: i % 3 === 0 ? "Dépôt Nord" : "Garage central",
        status: "actif",
        notes: `Donnée fictive de démonstration (${MARQUEUR_DEMO})`,
      });
    }
  }
  return vehicules;
}

/** Camion lourd de la route régionale (seul candidat hydrogène de la démo). */
export const UNITE_ROUTE_REGIONALE = "CL-01";
/** Seuil du gestionnaire FICTIF pour électrifier un camion moyen (km/an). */
export const SEUIL_KM_CAMION_MOYEN_BEV = 22000;

/**
 * Plan ACTUEL de la démo — celui qu'un gestionnaire aurait préparé avant
 * l'outil, raisonnable mais pas optimisé : électrique pour les véhicules
 * légers, camionnettes, autobus et camions moyens qui roulent beaucoup ;
 * diesel pour les camions moyens peu utilisés et les camions lourds ;
 * hydrogène pour le seul camion lourd de la route régionale, dont les
 * journées d'hiver dépassent l'autonomie d'un camion électrique. L'outil
 * montre ensuite où ce plan gagne, où il perd, et ce qu'il faut trancher.
 * Année = suggestion (mise en service + durée de vie), bornée à l'horizon.
 */
export function planDemo(vehicules: VehiculeDemo[], anneeCourante: number): PlanVehiculeDemo[] {
  return vehicules.map((v) => {
    const suggestion =
      anneeRemplacementSuggeree(
        { category: v.category, model_year: v.model_year, in_service_date: null },
        anneeCourante,
      ) ?? anneeCourante + 1;
    const replacement_year = Math.min(Math.max(suggestion, anneeCourante + 1), anneeCourante + 9);
    let target: PlanVehiculeDemo["target_technology"] = "bev";
    if (v.category === "camion_moyen" && v.annual_km < SEUIL_KM_CAMION_MOYEN_BEV) target = "diesel";
    if (v.category === "camion_lourd") target = v.unit_number === UNITE_ROUTE_REGIONALE ? "fcev" : "diesel";
    return { unit_number: v.unit_number, replacement_year, target_technology: target };
  });
}

/** Garages FICTIFS de la démo : puissance disponible relevée (plus de
 *  valeur « présumée »), fenêtre de recharge, tarif Hydro-Québec, places. */
export interface GarageDemo {
  name: string;
  address: string;
  available_power_kw: number;
  parking_spots: number;
  return_time: string;
  departure_time: string;
  hq_rate: string;
  notes: string;
}

export const GARAGES_DEMO: GarageDemo[] = [
  {
    name: "Garage central",
    address: "1200, boulevard des Pionniers, Rivière-Claire (adresse fictive)",
    available_power_kw: 350,
    parking_spots: 32,
    return_time: "17:30",
    departure_time: "06:30",
    hq_rate: "M",
    notes: `Garage fictif de démonstration — puissance disponible relevée sur le panneau principal (${MARQUEUR_DEMO})`,
  },
  {
    name: "Dépôt Nord",
    address: "45, chemin du Lac-Vert, Rivière-Claire (adresse fictive)",
    available_power_kw: 120,
    parking_spots: 16,
    return_time: "16:30",
    departure_time: "06:00",
    hq_rate: "G",
    notes: `Garage fictif de démonstration — puissance disponible relevée sur le panneau principal (${MARQUEUR_DEMO})`,
  },
];

/** Subvention PAGTCP FICTIVE « confirmée par le client » pour chaque
 *  autobus électrique du plan : montant plausible (≈ 2/3 du surcoût d'un
 *  autobus électrique de 12 m), versé l'année suivant l'achat. */
export const MONTANT_PAGTCP_DEMO = 650_000;

export interface SubventionConfirmeeDemo {
  unit_number: string;
  program_id: "pagtcp";
  label: string;
  amount: number;
  payment_year: number;
  document_reference: string;
  notes: string;
}

export function subventionsConfirmeesDemo(plan: PlanVehiculeDemo[]): SubventionConfirmeeDemo[] {
  return plan
    .filter((p) => p.unit_number.startsWith("B-") && p.target_technology === "bev")
    .map((p, i) => ({
      unit_number: p.unit_number,
      program_id: "pagtcp" as const,
      label: "PAGTCP — électrification des autobus (montant FICTIF de démonstration)",
      amount: MONTANT_PAGTCP_DEMO,
      payment_year: p.replacement_year + 1,
      document_reference: `FICTIF — démo PAGTCP-RC-${String(i + 1).padStart(2, "0")}`,
      notes: `Montant FICTIF de démonstration : aucune lettre d'octroi réelle (${MARQUEUR_DEMO})`,
    }));
}

/**
 * Contraintes de démonstration de l'optimiseur (Phase 5.1) — des SAISIES
 * fictives d'utilisateur, pas des hypothèses : budget d'investissement
 * annuel, cible de part zéro émission, places de recharge du Dépôt Nord
 * avec agrandissement prévu. Elles montrent reports, maintiens au diesel
 * et électrifications expliqués. Années relatives à l'année courante.
 */
export function contraintesDemo(anneeCourante: number) {
  return {
    objectif: "economies" as const,
    budgetInvestissementAnnuel: 1_500_000,
    ciblesZe: [{ annee: anneeCourante + 4, part: 0.4 }],
    garages: {
      // clé = nom du garage normalisé (cleGarage)
      "dépôt nord": { places: 6, augmentation: { annee: anneeCourante + 5, places: 12 } },
    },
    reportMaxAns: 2,
    avanceMaxAns: 0,
  };
}
