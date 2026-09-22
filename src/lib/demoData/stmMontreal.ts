// ============= STM Montreal Demo Data =============
// Based on documented case: STM Montreal Electric Transit (40 buses)
// Source: STM 2025

import type { CreateProjectForm, CreateScenarioForm } from "@/types";

// ============= PROJECT =============
export const DEMO_PROJECT: CreateProjectForm = {
  name: "STM Montreal - Électrification Bus",
  description: "Projet pilote d'électrification de 40 bus urbains pour la Société de transport de Montréal. Basé sur le cas documenté STM 2025.",
  countryOrRegion: "CA_QC",
  currency: "CAD",
  defaultAnalysisHorizonYears: 10,
  defaultDiscountRate: 0.05,
};

// ============= SCENARIOS =============
export const DEMO_SCENARIOS: CreateScenarioForm[] = [
  {
    name: "Baseline Diesel",
    description: "Scénario de référence avec maintien de la flotte diesel actuelle sur 10 ans",
    analysisHorizonYears: 10,
    discountRate: 0.05,
    countryOrRegion: "CA_QC",
    baseCaseFlag: true,
  },
  {
    name: "100% Électrique (BEV)",
    description: "Conversion complète vers bus électriques à batterie - Stratégie optimale STM",
    analysisHorizonYears: 10,
    discountRate: 0.05,
    countryOrRegion: "CA_QC",
    baseCaseFlag: false,
  },
  {
    name: "Mix BEV/FCEV (80/20)",
    description: "Approche hybride: 32 bus électriques + 8 bus hydrogène pour lignes express",
    analysisHorizonYears: 10,
    discountRate: 0.05,
    countryOrRegion: "CA_QC",
    baseCaseFlag: false,
  },
];

// ============= FLEET COMPOSITION BY SCENARIO =============
// Fleet composition uses the standard keys expected by the TCO engine: diesel, ev, hydrogen
export const DEMO_FLEET_COMPOSITIONS = {
  baseline: {
    diesel: { count: 40, annualKm: 60000, fuelConsumption: 45 }, // L/100km
    ev: { count: 0, annualKm: 0, consumption: 0 },
    hydrogen: { count: 0, annualKm: 0, consumption: 0 },
  },
  bev100: {
    diesel: { count: 0, annualKm: 0, fuelConsumption: 0 },
    ev: { count: 40, annualKm: 60000, consumption: 1.8 }, // kWh/km
    hydrogen: { count: 0, annualKm: 0, consumption: 0 },
  },
  mix: {
    diesel: { count: 0, annualKm: 0, fuelConsumption: 0 },
    ev: { count: 32, annualKm: 60000, consumption: 1.8 },
    hydrogen: { count: 8, annualKm: 70000, consumption: 0.09 }, // kg H2/km
  },
};

// ============= TCO RESULTS (Pre-calculated) =============
export interface DemoTCOResult {
  scenarioName: string;
  capex: number;
  opexTotal: number;
  tcoTotal: number;
  tcoPerKm: number;
  co2Total: number;
  co2SavingsPercent: number;
  npv: number;
  paybackYears: number;
  chargingStations: number;
  h2Stations: number;
  appliedDieselPrice: number;
  appliedElectricityPrice: number;
  appliedHydrogenPrice: number;
  yearlyBreakdown: Array<{
    year: number;
    capex: number;
    opex: number;
    co2: number;
    cumulative: number;
  }>;
}

export const DEMO_TCO_RESULTS: Record<string, DemoTCOResult> = {
  baseline: {
    scenarioName: "Baseline Diesel",
    capex: 12000000, // $300k x 40 buses
    opexTotal: 30000000, // 10 years fuel + maintenance
    tcoTotal: 42000000,
    tcoPerKm: 1.75,
    co2Total: 67200, // tonnes over 10 years
    co2SavingsPercent: 0,
    npv: 38500000,
    paybackYears: 0,
    chargingStations: 0,
    h2Stations: 0,
    appliedDieselPrice: 1.65,
    appliedElectricityPrice: 0,
    appliedHydrogenPrice: 0,
    yearlyBreakdown: Array.from({ length: 10 }, (_, i) => ({
      year: 2024 + i,
      capex: i === 0 ? 12000000 : 0,
      opex: 3000000,
      co2: 6720,
      cumulative: 12000000 + (i + 1) * 3000000,
    })),
  },
  bev100: {
    scenarioName: "100% Électrique (BEV)",
    capex: 28000000, // $700k x 40 buses
    opexTotal: 8600000, // Much lower energy + maintenance
    tcoTotal: 36600000,
    tcoPerKm: 1.53,
    co2Total: 0, // Zero emissions (Hydro-Québec)
    co2SavingsPercent: 100,
    npv: 31200000,
    paybackYears: 6.2,
    chargingStations: 12,
    h2Stations: 0,
    appliedDieselPrice: 0,
    appliedElectricityPrice: 0.1065,
    appliedHydrogenPrice: 0,
    yearlyBreakdown: Array.from({ length: 10 }, (_, i) => ({
      year: 2024 + i,
      capex: i === 0 ? 28000000 : 0,
      opex: 860000,
      co2: 0,
      cumulative: 28000000 + (i + 1) * 860000,
    })),
  },
  mix: {
    scenarioName: "Mix BEV/FCEV (80/20)",
    capex: 34400000, // 32 BEV + 8 FCEV (more expensive)
    opexTotal: 11200000,
    tcoTotal: 45600000,
    tcoPerKm: 1.82,
    co2Total: 2800, // Some from H2 production
    co2SavingsPercent: 96,
    npv: 39800000,
    paybackYears: 7.8,
    chargingStations: 10,
    h2Stations: 1,
    appliedDieselPrice: 0,
    appliedElectricityPrice: 0.1065,
    appliedHydrogenPrice: 12.5,
    yearlyBreakdown: Array.from({ length: 10 }, (_, i) => ({
      year: 2024 + i,
      capex: i === 0 ? 34400000 : 0,
      opex: 1120000,
      co2: 280,
      cumulative: 34400000 + (i + 1) * 1120000,
    })),
  },
};

// ============= INFRASTRUCTURE PLAN =============
export const DEMO_INFRASTRUCTURE = {
  name: "Infrastructure STM Centre-Ville",
  // EV Infrastructure
  evVehiclesCount: 40,
  evDailyKwh: 7200, // 40 buses x 180km x 1 kWh/km
  evBatteryCapacityKwh: 450,
  evChargingSpeed: "dc_fast",
  evChargingHours: 6,
  chargersSlow: 0,
  chargersFast: 12,
  chargersUltra: 0,
  evCapex: 1800000,
  evInstallation: 400000,
  evGridUpgrade: 600000,
  evOpex: 180000,
  // H2 Infrastructure (for mix scenario)
  h2VehiclesCount: 0,
  h2DailyKg: 0,
  h2StationCapacity: 0,
  h2OperatingHours: 0,
  h2RefuelingFrequency: 0,
  h2StationsCount: 0,
  h2Capex: 0,
  h2LandPermits: 0,
  h2Opex: 0,
  // Totals
  totalCapex: 2800000,
  totalOpex10y: 1800000,
};

// ============= ROADMAP PHASES & MILESTONES =============
export interface DemoPhase {
  name: string;
  description: string;
  startDate: string;
  endDate: string;
  color: string;
  budgetAllocated: number;
  milestones: DemoMilestone[];
}

export interface DemoMilestone {
  title: string;
  type: string;
  dueDate: string;
  description: string;
  isCritical: boolean;
  costEstimate: number;
}

export const DEMO_ROADMAP: DemoPhase[] = [
  {
    name: "Phase 1 - Planification",
    description: "Études de faisabilité, demandes de subventions et appels d'offres",
    startDate: "2024-01-15",
    endDate: "2024-09-30",
    color: "#3B82F6",
    budgetAllocated: 500000,
    milestones: [
      {
        title: "Étude de faisabilité technique",
        type: "study",
        dueDate: "2024-02-28",
        description: "Analyse des besoins énergétiques et infrastructure requise",
        isCritical: true,
        costEstimate: 75000,
      },
      {
        title: "Demande subvention iMHZEV",
        type: "funding",
        dueDate: "2024-03-15",
        description: "Dépôt dossier programme fédéral iMHZEV (jusqu'à 50% CAPEX)",
        isCritical: true,
        costEstimate: 0,
      },
      {
        title: "Demande Écocamionnage Québec",
        type: "funding",
        dueDate: "2024-04-01",
        description: "Programme provincial complémentaire pour infrastructure",
        isCritical: false,
        costEstimate: 0,
      },
      {
        title: "Appel d'offres véhicules",
        type: "procurement",
        dueDate: "2024-06-30",
        description: "Publication AO pour 40 bus électriques (Lion, Nova Bus, BYD)",
        isCritical: true,
        costEstimate: 50000,
      },
      {
        title: "Sélection fournisseur",
        type: "procurement",
        dueDate: "2024-09-15",
        description: "Évaluation des soumissions et attribution du contrat",
        isCritical: true,
        costEstimate: 25000,
      },
    ],
  },
  {
    name: "Phase 2 - Infrastructure",
    description: "Installation des bornes de recharge et mise à niveau électrique",
    startDate: "2024-10-01",
    endDate: "2025-06-30",
    color: "#10B981",
    budgetAllocated: 2800000,
    milestones: [
      {
        title: "Permis Hydro-Québec",
        type: "permit",
        dueDate: "2024-11-15",
        description: "Demande de raccordement haute puissance (2 MW)",
        isCritical: true,
        costEstimate: 25000,
      },
      {
        title: "Travaux électriques dépôt",
        type: "construction",
        dueDate: "2025-02-28",
        description: "Installation transformateur et câblage principal",
        isCritical: true,
        costEstimate: 600000,
      },
      {
        title: "Installation bornes DC",
        type: "installation",
        dueDate: "2025-04-30",
        description: "12 bornes de recharge rapide 150 kW (FLO/ChargePoint)",
        isCritical: true,
        costEstimate: 1800000,
      },
      {
        title: "Tests et mise en service",
        type: "testing",
        dueDate: "2025-06-15",
        description: "Validation du système de recharge et intégration logicielle",
        isCritical: false,
        costEstimate: 100000,
      },
    ],
  },
  {
    name: "Phase 3 - Déploiement",
    description: "Livraison des véhicules et mise en service progressive",
    startDate: "2025-07-01",
    endDate: "2026-12-31",
    color: "#8B5CF6",
    budgetAllocated: 28000000,
    milestones: [
      {
        title: "Livraison Lot 1 (10 bus)",
        type: "delivery",
        dueDate: "2025-09-30",
        description: "Premiers véhicules pour lignes pilotes 24 et 80",
        isCritical: true,
        costEstimate: 7000000,
      },
      {
        title: "Formation chauffeurs Phase 1",
        type: "training",
        dueDate: "2025-10-15",
        description: "50 chauffeurs formés à la conduite électrique",
        isCritical: false,
        costEstimate: 75000,
      },
      {
        title: "Mise en service lignes pilotes",
        type: "operation",
        dueDate: "2025-11-01",
        description: "Démarrage commercial sur lignes 24 (Sherbrooke) et 80 (Parc)",
        isCritical: true,
        costEstimate: 0,
      },
      {
        title: "Livraison Lot 2 (15 bus)",
        type: "delivery",
        dueDate: "2026-03-31",
        description: "Extension aux lignes du réseau central",
        isCritical: false,
        costEstimate: 10500000,
      },
      {
        title: "Livraison Lot 3 (15 bus)",
        type: "delivery",
        dueDate: "2026-09-30",
        description: "Complétion de la flotte de 40 véhicules",
        isCritical: false,
        costEstimate: 10500000,
      },
      {
        title: "Opération complète",
        type: "operation",
        dueDate: "2026-12-15",
        description: "40 bus électriques en service - Objectif atteint",
        isCritical: true,
        costEstimate: 0,
      },
    ],
  },
];

// ============= MOCK TELEMATICS FLEET =============
export interface DemoVehicle {
  externalId: string;
  vehicleType: string;
  makeModel: string;
  annualKm: number;
  fuelConsumption: number;
  routeType: string;
  dailyKm: number;
}

export const DEMO_FLEET: DemoVehicle[] = Array.from({ length: 40 }, (_, i) => {
  const lineNumber = [24, 80, 55, 121, 165, 45, 51, 67, 90, 105][i % 10];
  const isExpress = lineNumber > 100;
  const baseDailyKm = isExpress ? 220 : 180;
  const variation = Math.floor(Math.random() * 40) - 20;
  
  return {
    externalId: `STM-BUS-${String(i + 1).padStart(3, "0")}`,
    vehicleType: "bus",
    makeModel: i < 20 ? "Nova Bus LFS" : "New Flyer Xcelsior",
    annualKm: 60000 + Math.floor(Math.random() * 10000),
    fuelConsumption: 42 + Math.floor(Math.random() * 8), // L/100km diesel
    routeType: isExpress ? "regional" : "urban",
    dailyKm: baseDailyKm + variation,
  };
});

// ============= SUMMARY STATS =============
export const DEMO_SUMMARY = {
  totalVehicles: 40,
  totalAnnualKm: 2400000,
  annualSavings: 3140000, // $3.14M/year
  co2ReductionTonnes: 6720,
  paybackYears: 6.2,
  tcoSavings: 5400000, // vs diesel over 10 years
  electricityRate: 0.1065,
  region: "Québec",
  operator: "Société de transport de Montréal",
};
