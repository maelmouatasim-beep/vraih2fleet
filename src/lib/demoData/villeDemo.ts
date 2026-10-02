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
    makes: ["Toyota", "Chevrolet"], models: ["Corolla", "Equinox"],
    kmBase: 12000, kmPas: 1500, consoBase: 7.8, consoPas: 0.35,
    usage: "urbain", departments: ["Inspection", "Administration", "Loisirs"],
  },
  {
    prefixe: "C", nombre: 12, category: "camionnette",
    makes: ["Ford", "RAM"], models: ["F-250", "2500"],
    kmBase: 16000, kmPas: 1800, consoBase: 13.5, consoPas: 0.45,
    usage: "urbain", departments: ["Travaux publics", "Parcs", "Aqueduc"],
  },
  {
    prefixe: "CM", nombre: 9, category: "camion_moyen",
    makes: ["Freightliner", "International"], models: ["M2 106", "MV607"],
    kmBase: 18000, kmPas: 2600, consoBase: 24, consoPas: 0.9,
    usage: "regional", departments: ["Voirie", "Collecte"],
  },
  {
    prefixe: "CL", nombre: 5, category: "camion_lourd",
    makes: ["Mack", "Western Star"], models: ["Granite", "47X"],
    kmBase: 26000, kmPas: 4200, consoBase: 33, consoPas: 1.4,
    usage: "regional", departments: ["Voirie", "Déneigement"],
  },
  {
    prefixe: "B", nombre: 4, category: "autobus_urbain_12m",
    makes: ["Nova Bus", "Nova Bus"], models: ["LFS", "LFS"],
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
      vehicules.push({
        unit_number: `${g.prefixe}-${numero}`,
        make: g.makes[i % 2],
        model: g.models[i % 2],
        // âges étalés de façon déterministe (2010..2021 selon la position)
        model_year: 2010 + ((i * 5 + g.nombre) % 12),
        category: g.category,
        fuel_type: "diesel",
        annual_km: g.kmBase + i * g.kmPas,
        consumption_per_100km: arrondi(g.consoBase + (i % 5) * g.consoPas),
        // C7 : donnée FICTIVE, jamais présentée comme une saisie réelle
        consumption_source: "estimation",
        usage_profile: g.usage,
        department: g.departments[i % g.departments.length],
        depot: i % 3 === 0 ? "Dépôt Nord" : "Garage central",
        status: "actif",
        notes: `Donnée fictive de démonstration (${MARQUEUR_DEMO})`,
      });
    }
  }
  return vehicules;
}

/**
 * Plan par défaut de la démo : année = suggestion (mise en service +
 * durée de vie de la catégorie, bornée dans l'horizon) ; cible BEV
 * partout sauf les camions lourds (2 FCEV pour montrer l'hydrogène,
 * les autres au diesel — longue distance/déneigement à évaluer).
 */
export function planDemo(vehicules: VehiculeDemo[], anneeCourante: number): PlanVehiculeDemo[] {
  let lourds = 0;
  return vehicules.map((v) => {
    const suggestion =
      anneeRemplacementSuggeree(
        { category: v.category, model_year: v.model_year, in_service_date: null },
        anneeCourante,
      ) ?? anneeCourante + 1;
    const replacement_year = Math.min(Math.max(suggestion, anneeCourante + 1), anneeCourante + 9);
    let target: PlanVehiculeDemo["target_technology"] = "bev";
    if (v.category === "camion_lourd") {
      lourds += 1;
      target = lourds <= 2 ? "fcev" : "diesel";
    }
    return { unit_number: v.unit_number, replacement_year, target_technology: target };
  });
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
