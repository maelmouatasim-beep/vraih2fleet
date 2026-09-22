// ============= H2Fleet Planner Domain Types =============

// Enums
export type VehicleType = 'truck' | 'bus' | 'van' | 'other';
export type PowertrainType = 'diesel' | 'gasoline' | 'cng' | 'bev' | 'fuel_cell_h2' | 'other';
export type TargetPowertrain = 'keep_diesel' | 'bev' | 'fuel_cell_h2' | 'mixed';
export type UserRole = 'admin' | 'analyst' | 'viewer';
export type EnergyType = 'diesel' | 'electricity' | 'hydrogen' | 'hydrogen_green' | 'hydrogen_grey';

// Organization & Users
export interface Organization {
  id: string;
  name: string;
  createdAt: string;
}

export interface User {
  id: string;
  organizationId: string;
  email: string;
  name: string;
  role: UserRole;
  createdAt: string;
}

// Project
export interface Project {
  id: string;
  organizationId: string;
  name: string;
  description: string;
  countryOrRegion: string;
  currency: string;
  defaultAnalysisHorizonYears: number;
  defaultDiscountRate: number;
  createdAt: string;
  updatedAt: string;
}

// Vehicle Group
export interface VehicleGroup {
  id: string;
  projectId: string;
  name: string;
  vehicleType: VehicleType;
  powertrainCurrent: PowertrainType;
  count: number;
  avgKmPerYear: number;
  fuelConsumptionLPer100km: number;
  fuelPricePerLitre: number;
  maintenanceCostPerYearPerVehicle: number;
  co2PerLitre: number;
}

// Scenario
export interface Scenario {
  id: string;
  projectId: string;
  name: string;
  description: string;
  analysisHorizonYears: number;
  discountRate: number;
  countryOrRegion: string;
  baseCaseFlag: boolean;
  createdAt: string;
}

// Scenario Vehicle Group Configuration
export interface ScenarioVehicleGroupConfig {
  id: string;
  scenarioId: string;
  vehicleGroupId: string;
  targetPowertrain: TargetPowertrain;
  conversionYear: number;
  newVehicleCapexPerUnit: number;
  hydrogenConsumptionKgPer100km: number | null;
  electricityConsumptionKwhPer100km: number | null;
  hydrogenPricePerKg: number | null;
  electricityPricePerKwh: number | null;
  subsidyPerVehicle: number;
  maintenanceCostPerYearPerVehicleNew: number;
}

// Deployment Phase
export interface DeploymentPhase {
  id: string;
  scenarioId: string;
  name: string;
  startYear: number;
  endYear: number;
  vehicleConversions: Record<string, number>; // vehicleGroupId -> vehicles converted
}

// Reference Data
export interface RefVehicleProfile {
  id: string;
  name: string;
  vehicleType: VehicleType;
  powertrain: PowertrainType;
  defaultCapex: number;
  defaultConsumptionLPer100km: number | null;
  defaultConsumptionKgH2Per100km: number | null;
  defaultConsumptionKwhPer100km: number | null;
  defaultMaintenanceCostPerYear: number;
}

export interface RefEnergyPrice {
  id: string;
  countryOrRegion: string;
  energyType: EnergyType;
  unit: string;
  pricePerUnit: number;
  year: number;
}

export interface RefEmissionFactor {
  id: string;
  countryOrRegion: string;
  energyType: EnergyType;
  co2PerUnitKg: number;
}

// Calculation Results
export interface YearlyResult {
  year: number;
  vehiclesDiesel: number;
  vehiclesBev: number;
  vehiclesH2: number;
  capex: number;
  opexFuel: number;
  opexMaintenance: number;
  opexTotal: number;
  totalCost: number;
  co2Tonnes: number;
  kmTotal: number;
}

export interface ScenarioResults {
  scenarioId: string;
  scenarioName: string;
  yearlyData: YearlyResult[];
  totals: {
    totalCapex: number;
    totalOpex: number;
    totalCost: number;
    npv: number;
    tcoPerKm: number;
    tcoPerVehicle: number;
    totalCo2Tonnes: number;
    co2AvoidedVsBaseline: number;
  };
  energyDemand: {
    totalH2Kg: number;
    totalKwh: number;
    avgH2KgPerDay: number;
    avgKwhPerDay: number;
  };
  infrastructure: {
    h2StationsNeeded: number;
    evChargersNeeded: number;
  };
}

// Form types
export interface CreateProjectForm {
  name: string;
  description: string;
  countryOrRegion: string;
  currency: string;
  defaultAnalysisHorizonYears: number;
  defaultDiscountRate: number;
}

export interface CreateVehicleGroupForm {
  name: string;
  vehicleType: VehicleType;
  powertrainCurrent: PowertrainType;
  count: number;
  avgKmPerYear: number;
  fuelConsumptionLPer100km: number;
  fuelPricePerLitre: number;
  maintenanceCostPerYearPerVehicle: number;
  co2PerLitre: number;
}

export interface CreateScenarioForm {
  name: string;
  description: string;
  analysisHorizonYears: number;
  discountRate: number;
  countryOrRegion: string;
  baseCaseFlag: boolean;
}
