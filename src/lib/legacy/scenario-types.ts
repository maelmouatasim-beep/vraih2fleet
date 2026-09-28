/**
 * Types HÉRITÉS du modèle de scénarios de l'ancien moteur (supprimé au
 * bloc 3 de la Phase 3). Conservés UNIQUEMENT pour lire/écrire les
 * tables existantes (scenarios, tco_results, reference_data) et les
 * composants de rapport en attendant leur refonte (bloc 6). Aucune
 * valeur d'hypothèse ici — les calculs vivent dans src/lib/tco.
 */
// ============= TCO Calculation Types =============

export type VehicleType = 'diesel' | 'ev' | 'hydrogen';
export type Region = 
  | 'Canada' | 'CA_ON' | 'CA_BC' | 'CA_QC' | 'CA_AB' | 'CA_MB';

export type Country = 'Canada';

export interface StateProvince {
  code: Region;
  name: string;
  electricityPrice?: number;
  dieselPrice?: number;
  hydrogenPrice?: number;
  currency: 'CAD';
}

export const COUNTRIES: Record<Country, string> = {
  Canada: 'Canada',
};

// Les anciennes listes de prix par province (valeurs non sourcées) ont
// été retirées avec l'ancien moteur : les prix d'énergie vivent dans le
// registre d'hypothèses src/lib/tco (source + statut + date).
export const STATES_PROVINCES: Record<Country, StateProvince[]> = {
  Canada: [
    { code: 'Canada', name: 'National Average', currency: 'CAD' },
    { code: 'CA_QC', name: 'Quebec', currency: 'CAD' },
    { code: 'CA_MB', name: 'Manitoba', currency: 'CAD' },
    { code: 'CA_BC', name: 'British Columbia', currency: 'CAD' },
    { code: 'CA_ON', name: 'Ontario', currency: 'CAD' },
    { code: 'CA_AB', name: 'Alberta', currency: 'CAD' },
  ],
};

// Section A - Vehicle Types
export type VehicleCategory = 'rigid_truck' | 'tractor' | 'standard_bus' | 'articulated_bus' | 'utility' | 'passenger';
export type PTAC = '3.5T' | '7.5T' | '12T' | '19T' | '26T' | '44T';
export type CurrentPowertrain = 'diesel' | 'gasoline' | 'cng' | 'hybrid_diesel';
export type TargetPowertrain = 'diesel' | 'bev' | 'fcev' | 'phev' | 'biomethane';

// Section B - Operational Usage
export type TripType = 'urban' | 'periurban' | 'long_distance' | 'mixed';
export type ChargingTime = 'night_8h' | 'day_2_4h' | 'fast_1h' | 'no_fixed';
export type LoadProfile = 'light' | 'medium' | 'heavy';

// Section C - Environmental Constraints
export type MinTemperature = '-20' | '-10' | '0' | '5';
export type MaxTemperature = '25' | '35' | '40' | '45';
export type TerrainType = 'flat' | 'hilly' | 'mountainous';

export interface FleetGroup {
  name: string;
  vehicleType: VehicleType;
  count: number;
  annualKm: number;
  yearIntroduced: number;
}

// Operational costs configuration
export interface OperationalCostsConfig {
  downtime?: {
    hoursPerYear: number;        // Heures d'immobilisation/an
    costPerHour: number;         // Coût horaire (salaire driver + manque à gagner)
  };
  insurance?: {
    evPremium: number;           // Surprime assurance EV (% ou $)
    h2Premium: number;           // Surprime assurance H₂
    dieselBaseline: number;      // Coût assurance baseline diesel
  };
  telematics?: {
    costPerVehiclePerMonth: number; // Abonnement télématique ($/véhicule/mois)
    provider: 'geotab' | 'samsara' | 'other' | 'none';
  };
}

// Energy costs configuration
export interface EnergyCostsConfig {
  gridCharges?: {
    demandCharge: number;        // $/kW de puissance max
    touRates?: {
      offPeak: number;           // $/kWh hors pointe
      midPeak: number;           // $/kWh mi-pointe
      onPeak: number;            // $/kWh pointe
      offPeakPercentage: number; // % de charge hors pointe (0-100)
    };
  };
}

// Environmental configuration
export interface EnvironmentalConfig {
  carbonCredits?: {
    enabled: boolean;
    pricePerTonne: number;       // Prix du crédit CO₂ ($/tonne)
    program: 'LCFS' | 'ZEV' | 'none'; // Programme de crédits
  };
  coldWeather?: {
    enabled: boolean;
    averageDeratingPercent: number; // % de perte d'autonomie hiver
    winterMonths: number;        // Nombre de mois d'hiver
  };
}

// Financial parameters for inflation and other adjustments
export interface FinancialParams {
  energyInflationRate?: number;      // Annual energy price inflation (%)
  maintenanceInflationRate?: number; // Annual maintenance cost inflation (%)
}

export interface FleetComposition {
  diesel: { count: number; annualKm: number };
  ev: { count: number; annualKm: number };
  hydrogen: { count: number; annualKm: number };
  
  // PHEV tracking for hybrid calculation (60% electric + 40% diesel)
  phevRatio?: number; // Ratio of EV fleet that is PHEV (0-1)
  
  // Financial parameters for inflation
  financialParams?: FinancialParams;
  
  // Advanced cost configurations (optional)
  operationalCosts?: OperationalCostsConfig;
  energyCosts?: EnergyCostsConfig;
  environmental?: EnvironmentalConfig;
}

// Enhanced vehicle configuration for detailed scenario
// Surcharges expertes de multiplicateurs (modèle hérité, données stockées)
export type MultiplierSource = 'system' | 'expert';
export interface MultiplierOverride {
  value: number;
  source: MultiplierSource;
}

export interface VehicleConfiguration {
  // Section A - Vehicle Type
  category: VehicleCategory;
  ptac?: PTAC;
  currentPowertrain: CurrentPowertrain;
  
  // Single target powertrain (legacy support)
  targetPowertrain?: TargetPowertrain;
  
  // Multiple target powertrains for mixed strategies
  targetPowertrains: TargetPowertrain[];
  // Percentage allocation for each powertrain (must sum to 100)
  targetPowertrainMix: Record<TargetPowertrain, number>;
  
  // Section B - Operational Usage
  annualKm: number;
  tripType: TripType;
  minAutonomy: number;
  chargingTime: ChargingTime;
  loadProfile: LoadProfile;
  vehicleCount: number;
  
  // Section C - Environmental Constraints
  minTemperature: MinTemperature;
  maxTemperature: MaxTemperature;
  terrainTypes: TerrainType[];
  
  // Section D - Economic Data
  currentVehiclePrice: number;
  alternativeVehiclePrice: number;  // Legacy: single price for all alternatives
  // Per-powertrain vehicle prices for mixed strategies
  vehiclePrices?: Partial<Record<TargetPowertrain, number>>;
  currentConsumption: number;
  annualMaintenanceCost: number;
  subsidies?: number;
  
  // Vehicle life and residual value
  vehicleLifeYears?: number;         // Years of vehicle life for depreciation
  residualValuePercent?: number;     // % of purchase price at end of analysis
  
  // Custom consumption per powertrain (overrides defaults)
  consumptionBev?: number;           // kWh/100km
  consumptionH2?: number;            // kg/100km
  consumptionBiomethane?: number;    // kg/100km
  consumptionPhev?: number;          // L/100km (diesel portion of PHEV)
  
  // Custom infrastructure cost
  customInfraEnabled?: boolean;
  infrastructureCostPerVehicle?: number; // $/vehicle (overrides automatic calculation)
  
  // User-provided energy prices (required for calculations)
  electricityPrice: number;    // $/kWh - entered by user
  dieselPrice: number;         // $/L - entered by user
  hydrogenPrice?: number;      // $/kg - required if FCEV
  
  // H2 specific parameters
  h2Type?: 'green' | 'blue' | 'grey';  // Hydrogen source for CO2 emissions
  fcStackReplacementEnabled?: boolean;
  fcStackReplacementCost?: number;   // $ for stack replacement
  fcStackLifespanYears?: number;     // Years before replacement needed
  h2InflationEnabled?: boolean;
  h2InflationRate?: number;          // Annual % change (can be negative)
  h2InfraScaleEnabled?: boolean;
  h2InfraScaleFactor?: number;       // % reduction due to scale
  
  // User-provided maintenance costs (optional, defaults available)
  maintenanceDiesel?: number;  // $/vehicle/year
  maintenanceEv?: number;      // $/vehicle/year
  maintenanceHydrogen?: number; // $/vehicle/year
  
  // Expert overrides for condition multipliers
  multiplierOverrides?: Record<string, MultiplierOverride>;
}

export interface Scenario {
  id: string;
  projectId: string;
  name: string;
  region: Region;
  analysisYears: number;
  discountRate: number;
  fleetComposition: FleetComposition;
  vehicleConfiguration?: VehicleConfiguration;
  createdAt: string;
}

export interface ReferenceData {
  // Vehicle costs (CAD)
  diesel_truck: number;
  ev_truck: number;
  hydrogen_truck: number;
  
  // Fuel prices
  diesel_price: number;      // $/L
  electricity_price: number; // $/kWh
  hydrogen_price: number;    // $/kg
  
  // CO2 factors
  co2_factor_diesel: number; // kg CO2/L
  co2_factor_grid: number;   // kg CO2/MWh
  
  // Maintenance costs ($/year)
  maintenance_diesel: number;
  maintenance_ev: number;
  maintenance_hydrogen: number;
}

export interface TCOResult {
  scenarioId: string;
  scenarioName: string;
  
  // Costs
  capex: number;
  opexTotal: number;
  tcoTotal: number;
  tcoPerKm: number;
  npv: number;
  residualValue: number;
  paybackPeriodYears: number | null;
  
  // Baseline comparison (for portfolio analytics)
  baselineTco?: number;           // TCO of equivalent diesel-only scenario
  tcoSavings?: number;            // baselineTco - tcoTotal (positive = savings)
  
  // Detailed baseline breakdown for methodology transparency
  baselineBreakdown?: {
    capex: number;              // CAPEX véhicules diesel
    opexNominal: number;        // OPEX total nominal (avec inflation, sans actualisation)
    opexPV: number;             // OPEX en valeur actualisée (PV)
    residualNominal: number;    // Valeur résiduelle nominale
    residualPV: number;         // Valeur résiduelle actualisée
    totalNominal: number;       // TCO nominal = CAPEX + OPEX - Residual
    discountRate: number;       // Taux d'actualisation utilisé (%)
    inflationRate: number;      // Taux d'inflation énergie appliqué (%)
  };
  
  // Emissions
  co2Total: number;
  co2Savings: number;
  co2SavingsPercent: number;
  
  // Infrastructure
  chargingStations: number;
  chargingStationsCost: number;
  h2Stations: number;
  h2StationsCost: number;
  totalInfrastructureCost: number;
  
  // Advanced cost breakdowns (optional)
  downtimeCost?: number;          // Coût d'immobilisation total
  insuranceCost?: number;         // Coût d'assurance différentiel
  telematicsCost?: number;        // Coût télématique total
  gridDemandCost?: number;        // Coût appel de puissance réseau
  carbonCreditsValue?: number;    // Valeur POSITIVE (revenu crédits CO₂)
  coldWeatherImpact?: number;     // Coût additionnel énergie (hiver)
  
  // Hydrogen-specific costs
  fcStackReplacementCost?: number;     // Coût remplacement pile FCEV
  h2InfraScaleDiscount?: number;       // Économies d'échelle infra H₂
  
  // Applied consumption rates (for transparency)
  appliedConsumption?: {
    bev?: number;       // kWh/100km utilisé
    h2?: number;        // kg/100km utilisé  
    biomethane?: number;// kg/100km utilisé
    diesel?: number;    // L/100km utilisé
  };
  
  // Applied energy prices (for What-If analysis synchronization)
  appliedPrices?: {
    diesel: number;       // $/L utilisé
    electricity: number;  // $/kWh utilisé  
    hydrogen: number;     // $/kg utilisé
  };
  
  // Flags showing which advanced parameters were active
  activeAdvancedParams?: {
    customConsumption: boolean;
    fcStackReplacement: boolean;
    h2Inflation: boolean;
    h2InfraScale: boolean;
    customInfra: boolean;
    touRates: boolean;
    carbonCredits: boolean;
    coldWeather: boolean;
  };
  
  // Breakdown by year
  yearlyBreakdown: YearlyBreakdown[];
  
  // Breakdown by vehicle type
  byVehicleType: {
    diesel: VehicleTypeCosts;
    ev: VehicleTypeCosts;
    hydrogen: VehicleTypeCosts;
  };
}

// Advanced costs breakdown for yearly visualization
export interface AdvancedCostsBreakdown {
  downtime: number;
  insurance: number;
  telematics: number;
  gridDemand: number;
  fcStackReplacement: number;  // Only in specific years (year 8, 16, etc.)
  carbonCredits: number;       // Revenue (positive value = money earned)
}

export interface YearlyBreakdown {
  year: number;
  capex: number;
  opex: number;
  
  // Detailed OPEX breakdown for chart visualization
  // Insurance comes from advancedCosts (user form data) for single source of truth
  opexBreakdown: {
    fuel: number;
    maintenance: number;
    insurance: number;  // Populated from advancedCosts.insurance
  };
  
  // Advanced costs breakdown - always present for consistency
  // These values come exclusively from user form input (no automatic calculation)
  advancedCosts: AdvancedCostsBreakdown;
  
  totalCost: number;
  cumulativeCost: number;
  co2: number;
  discountedCost: number;
}

export interface VehicleTypeCosts {
  count: number;
  capex: number;
  opex: number;
  fuelCost: number;
  maintenanceCost: number;
  insuranceCost: number;
  co2: number;
}

// Baseline comparison result
export interface BaselineComparison {
  dieselOnlyTCO: number;
  scenarioTCO: number;
  tcoDifference: number;
  tcoSavingsPercent: number;
  co2Avoided: number;
}

// Form types for creating scenarios
export interface CreateScenarioForm {
  name: string;
  region: Region;
  analysisYears: number;
  discountRate: number;
  fleetComposition: FleetComposition;
  vehicleConfiguration?: VehicleConfiguration;
}

// Region labels for UI
export const REGION_LABELS: Record<Region, string> = {
  Canada: 'Canada (National Average)',
  CA_ON: 'Ontario, Canada',
  CA_BC: 'British Columbia, Canada',
  CA_QC: 'Quebec, Canada',
  CA_AB: 'Alberta, Canada',
  CA_MB: 'Manitoba, Canada',
};

// Labels for vehicle categories
export const VEHICLE_CATEGORY_LABELS: Record<VehicleCategory, string> = {
  rigid_truck: 'Camion rigide',
  tractor: 'Tracteur routier',
  standard_bus: 'Bus standard',
  articulated_bus: 'Bus articulé',
  utility: 'Utilitaire',
  passenger: 'Véhicule particulier',
};

export const PTAC_OPTIONS: PTAC[] = ['3.5T', '7.5T', '12T', '19T', '26T', '44T'];

export const CURRENT_POWERTRAIN_LABELS: Record<CurrentPowertrain, string> = {
  diesel: 'Diesel',
  gasoline: 'Essence',
  cng: 'GNV (Gaz naturel)',
  hybrid_diesel: 'Hybride diesel',
};

export const TARGET_POWERTRAIN_LABELS: Record<TargetPowertrain, string> = {
  diesel: 'Diesel (maintien)',
  bev: 'BEV (Électrique batterie)',
  fcev: 'FCEV (Hydrogène)',
  phev: 'Hybride rechargeable',
  biomethane: 'Biométhane',
};

export const TRIP_TYPE_LABELS: Record<TripType, string> = {
  urban: 'Urbain (<50km/jour)',
  periurban: 'Périurbain (50-150km/jour)',
  long_distance: 'Longue distance (>150km/jour)',
  mixed: 'Mixte',
};

export const CHARGING_TIME_LABELS: Record<ChargingTime, string> = {
  night_8h: 'Nuit (8h+)',
  day_2_4h: 'Journée (2-4h)',
  fast_1h: 'Rapide (<1h)',
  no_fixed: 'Aucun temps fixe',
};

export const LOAD_PROFILE_LABELS: Record<LoadProfile, string> = {
  light: 'Léger (<50% PTAC)',
  medium: 'Moyen (50-80% PTAC)',
  heavy: 'Lourd (>80% PTAC)',
};

export const MIN_TEMPERATURE_LABELS: Record<MinTemperature, string> = {
  '-20': '-20°C',
  '-10': '-10°C',
  '0': '0°C',
  '5': '+5°C',
};

export const MAX_TEMPERATURE_LABELS: Record<MaxTemperature, string> = {
  '25': '+25°C',
  '35': '+35°C',
  '40': '+40°C',
  '45': '+45°C',
};

export const TERRAIN_TYPE_LABELS: Record<TerrainType, string> = {
  flat: 'Plat',
  hilly: 'Vallonné',
  mountainous: 'Montagneux',
};

