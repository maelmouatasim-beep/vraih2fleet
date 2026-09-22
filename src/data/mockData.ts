import type {
  Organization,
  User,
  Project,
  VehicleGroup,
  Scenario,
  ScenarioVehicleGroupConfig,
  RefVehicleProfile,
  RefEnergyPrice,
  RefEmissionFactor,
} from '@/types';

// Current user & organization (mock session)
export const mockCurrentUser: User = {
  id: 'user-1',
  organizationId: 'org-1',
  email: 'jean.dupont@transport-nord.fr',
  name: 'Jean Dupont',
  role: 'admin',
  createdAt: '2024-01-15T10:00:00Z',
};

export const mockOrganization: Organization = {
  id: 'org-1',
  name: 'Transport Nord SA',
  createdAt: '2024-01-01T00:00:00Z',
};

// Projects
export const mockProjects: Project[] = [
  {
    id: 'proj-1',
    organizationId: 'org-1',
    name: 'Flotte Régionale Nord',
    description: 'Transition de la flotte régionale de camions de livraison',
    countryOrRegion: 'Canada',
    currency: 'CAD',
    defaultAnalysisHorizonYears: 10,
    defaultDiscountRate: 0.06,
    createdAt: '2024-02-01T10:00:00Z',
    updatedAt: '2024-11-15T14:30:00Z',
  },
  {
    id: 'proj-2',
    organizationId: 'org-1',
    name: 'Transition Bus Urbains',
    description: 'Électrification du réseau de bus de la métropole',
    countryOrRegion: 'CA_QC',
    currency: 'CAD',
    defaultAnalysisHorizonYears: 15,
    defaultDiscountRate: 0.05,
    createdAt: '2024-03-15T08:00:00Z',
    updatedAt: '2024-11-10T11:00:00Z',
  },
  {
    id: 'proj-3',
    organizationId: 'org-1',
    name: 'Logistique Dernier Km',
    description: 'Passage aux véhicules électriques pour la livraison urbaine',
    countryOrRegion: 'CA_ON',
    currency: 'CAD',
    defaultAnalysisHorizonYears: 8,
    defaultDiscountRate: 0.06,
    createdAt: '2024-05-20T09:00:00Z',
    updatedAt: '2024-11-18T16:45:00Z',
  },
];

// Vehicle Groups for project 1
export const mockVehicleGroups: VehicleGroup[] = [
  {
    id: 'vg-1',
    projectId: 'proj-1',
    name: 'Camions 26t régionaux',
    vehicleType: 'truck',
    powertrainCurrent: 'diesel',
    count: 25,
    avgKmPerYear: 80000,
    fuelConsumptionLPer100km: 32,
    fuelPricePerLitre: 1.52,
    maintenanceCostPerYearPerVehicle: 6500,
    co2PerLitre: 2.68,
  },
  {
    id: 'vg-2',
    projectId: 'proj-1',
    name: 'Camions 12t urbains',
    vehicleType: 'truck',
    powertrainCurrent: 'diesel',
    count: 15,
    avgKmPerYear: 45000,
    fuelConsumptionLPer100km: 22,
    fuelPricePerLitre: 1.52,
    maintenanceCostPerYearPerVehicle: 4500,
    co2PerLitre: 2.68,
  },
  {
    id: 'vg-3',
    projectId: 'proj-1',
    name: 'Fourgons livraison',
    vehicleType: 'van',
    powertrainCurrent: 'diesel',
    count: 30,
    avgKmPerYear: 35000,
    fuelConsumptionLPer100km: 12,
    fuelPricePerLitre: 1.52,
    maintenanceCostPerYearPerVehicle: 2500,
    co2PerLitre: 2.68,
  },
];

// Scenarios for project 1
export const mockScenarios: Scenario[] = [
  {
    id: 'scen-1',
    projectId: 'proj-1',
    name: 'Baseline Diesel',
    description: 'Maintien de la flotte 100% diesel (scénario de référence)',
    analysisHorizonYears: 10,
    discountRate: 0.06,
    countryOrRegion: 'Canada',
    baseCaseFlag: true,
    createdAt: '2024-02-05T10:00:00Z',
  },
  {
    id: 'scen-2',
    projectId: 'proj-1',
    name: 'Mix H₂ + BEV',
    description: 'Transition progressive: camions lourds vers H₂, véhicules légers vers électrique',
    analysisHorizonYears: 10,
    discountRate: 0.06,
    countryOrRegion: 'CA_QC',
    baseCaseFlag: false,
    createdAt: '2024-02-10T14:00:00Z',
  },
  {
    id: 'scen-3',
    projectId: 'proj-1',
    name: '100% Électrique',
    description: 'Électrification complète de la flotte',
    analysisHorizonYears: 10,
    discountRate: 0.06,
    countryOrRegion: 'CA_ON',
    baseCaseFlag: false,
    createdAt: '2024-02-12T09:00:00Z',
  },
];

// Scenario configs for scen-2 (Mix H2 + BEV)
export const mockScenarioConfigs: ScenarioVehicleGroupConfig[] = [
  {
    id: 'cfg-1',
    scenarioId: 'scen-2',
    vehicleGroupId: 'vg-1',
    targetPowertrain: 'fuel_cell_h2',
    conversionYear: 2027,
    newVehicleCapexPerUnit: 300000,
    hydrogenConsumptionKgPer100km: 8,
    electricityConsumptionKwhPer100km: null,
    hydrogenPricePerKg: 12,
    electricityPricePerKwh: null,
    subsidyPerVehicle: 200000,
    maintenanceCostPerYearPerVehicleNew: 6500,
  },
  {
    id: 'cfg-2',
    scenarioId: 'scen-2',
    vehicleGroupId: 'vg-2',
    targetPowertrain: 'bev',
    conversionYear: 2026,
    newVehicleCapexPerUnit: 180000,
    hydrogenConsumptionKgPer100km: null,
    electricityConsumptionKwhPer100km: 90,
    hydrogenPricePerKg: null,
    electricityPricePerKwh: 0.12,
    subsidyPerVehicle: 30000,
    maintenanceCostPerYearPerVehicleNew: 4000,
  },
  {
    id: 'cfg-3',
    scenarioId: 'scen-2',
    vehicleGroupId: 'vg-3',
    targetPowertrain: 'bev',
    conversionYear: 2025,
    newVehicleCapexPerUnit: 65000,
    hydrogenConsumptionKgPer100km: null,
    electricityConsumptionKwhPer100km: 35,
    hydrogenPricePerKg: null,
    electricityPricePerKwh: 0.12,
    subsidyPerVehicle: 10000,
    maintenanceCostPerYearPerVehicleNew: 2000,
  },
];

// Reference Data - Vehicle Profiles
export const refVehicleProfiles: RefVehicleProfile[] = [
  {
    id: 'ref-vp-1',
    name: 'Truck 26t diesel',
    vehicleType: 'truck',
    powertrain: 'diesel',
    defaultCapex: 120000,
    defaultConsumptionLPer100km: 30,
    defaultConsumptionKgH2Per100km: null,
    defaultConsumptionKwhPer100km: null,
    defaultMaintenanceCostPerYear: 6000,
  },
  {
    id: 'ref-vp-2',
    name: 'Truck 26t H₂',
    vehicleType: 'truck',
    powertrain: 'fuel_cell_h2',
    defaultCapex: 300000,
    defaultConsumptionLPer100km: null,
    defaultConsumptionKgH2Per100km: 8,
    defaultConsumptionKwhPer100km: null,
    defaultMaintenanceCostPerYear: 6500,
  },
  {
    id: 'ref-vp-3',
    name: 'Truck 26t BEV',
    vehicleType: 'truck',
    powertrain: 'bev',
    defaultCapex: 250000,
    defaultConsumptionLPer100km: null,
    defaultConsumptionKgH2Per100km: null,
    defaultConsumptionKwhPer100km: 130,
    defaultMaintenanceCostPerYear: 5500,
  },
  {
    id: 'ref-vp-4',
    name: 'City bus diesel',
    vehicleType: 'bus',
    powertrain: 'diesel',
    defaultCapex: 300000,
    defaultConsumptionLPer100km: 40,
    defaultConsumptionKgH2Per100km: null,
    defaultConsumptionKwhPer100km: null,
    defaultMaintenanceCostPerYear: 9000,
  },
  {
    id: 'ref-vp-5',
    name: 'City bus H₂',
    vehicleType: 'bus',
    powertrain: 'fuel_cell_h2',
    defaultCapex: 600000,
    defaultConsumptionLPer100km: null,
    defaultConsumptionKgH2Per100km: 10,
    defaultConsumptionKwhPer100km: null,
    defaultMaintenanceCostPerYear: 9500,
  },
  {
    id: 'ref-vp-6',
    name: 'City bus BEV',
    vehicleType: 'bus',
    powertrain: 'bev',
    defaultCapex: 550000,
    defaultConsumptionLPer100km: null,
    defaultConsumptionKgH2Per100km: null,
    defaultConsumptionKwhPer100km: 160,
    defaultMaintenanceCostPerYear: 8500,
  },
  {
    id: 'ref-vp-7',
    name: 'Delivery van diesel',
    vehicleType: 'van',
    powertrain: 'diesel',
    defaultCapex: 45000,
    defaultConsumptionLPer100km: 12,
    defaultConsumptionKgH2Per100km: null,
    defaultConsumptionKwhPer100km: null,
    defaultMaintenanceCostPerYear: 2500,
  },
  {
    id: 'ref-vp-8',
    name: 'Delivery van BEV',
    vehicleType: 'van',
    powertrain: 'bev',
    defaultCapex: 65000,
    defaultConsumptionLPer100km: null,
    defaultConsumptionKgH2Per100km: null,
    defaultConsumptionKwhPer100km: 35,
    defaultMaintenanceCostPerYear: 2000,
  },
];

// Reference Data - Energy Prices (Canada only, updated Jan 2025)
export const refEnergyPrices: RefEnergyPrice[] = [
  { id: 'ref-ep-1', countryOrRegion: 'Canada', energyType: 'diesel', unit: 'L', pricePerUnit: 1.48, year: 2025 },
  { id: 'ref-ep-2', countryOrRegion: 'Canada', energyType: 'electricity', unit: 'kWh', pricePerUnit: 0.12, year: 2025 },
  { id: 'ref-ep-3', countryOrRegion: 'Canada', energyType: 'hydrogen', unit: 'kg', pricePerUnit: 12.00, year: 2025 },
  { id: 'ref-ep-4', countryOrRegion: 'CA_QC', energyType: 'diesel', unit: 'L', pricePerUnit: 1.52, year: 2025 },
  { id: 'ref-ep-5', countryOrRegion: 'CA_QC', energyType: 'electricity', unit: 'kWh', pricePerUnit: 0.078, year: 2025 },
  { id: 'ref-ep-6', countryOrRegion: 'CA_QC', energyType: 'hydrogen', unit: 'kg', pricePerUnit: 12.00, year: 2025 },
  { id: 'ref-ep-7', countryOrRegion: 'CA_ON', energyType: 'diesel', unit: 'L', pricePerUnit: 1.48, year: 2025 },
  { id: 'ref-ep-8', countryOrRegion: 'CA_ON', energyType: 'electricity', unit: 'kWh', pricePerUnit: 0.171, year: 2025 },
  { id: 'ref-ep-9', countryOrRegion: 'CA_ON', energyType: 'hydrogen', unit: 'kg', pricePerUnit: 13.00, year: 2025 },
  { id: 'ref-ep-10', countryOrRegion: 'CA_BC', energyType: 'diesel', unit: 'L', pricePerUnit: 1.55, year: 2025 },
  { id: 'ref-ep-11', countryOrRegion: 'CA_BC', energyType: 'electricity', unit: 'kWh', pricePerUnit: 0.14, year: 2025 },
  { id: 'ref-ep-12', countryOrRegion: 'CA_BC', energyType: 'hydrogen', unit: 'kg', pricePerUnit: 12.50, year: 2025 },
];

// Reference Data - Emission Factors (Canada only)
export const refEmissionFactors: RefEmissionFactor[] = [
  { id: 'ref-ef-1', countryOrRegion: 'global', energyType: 'diesel', co2PerUnitKg: 2.68 },
  { id: 'ref-ef-2', countryOrRegion: 'global', energyType: 'electricity', co2PerUnitKg: 0.2 },
  { id: 'ref-ef-3', countryOrRegion: 'global', energyType: 'hydrogen_green', co2PerUnitKg: 0.1 },
  { id: 'ref-ef-4', countryOrRegion: 'global', energyType: 'hydrogen_grey', co2PerUnitKg: 10 },
  { id: 'ref-ef-5', countryOrRegion: 'Canada', energyType: 'electricity', co2PerUnitKg: 0.12 },
  { id: 'ref-ef-6', countryOrRegion: 'CA_QC', energyType: 'electricity', co2PerUnitKg: 0.002 },
  { id: 'ref-ef-7', countryOrRegion: 'CA_ON', energyType: 'electricity', co2PerUnitKg: 0.04 },
  { id: 'ref-ef-8', countryOrRegion: 'CA_BC', energyType: 'electricity', co2PerUnitKg: 0.01 },
  { id: 'ref-ef-9', countryOrRegion: 'CA_AB', energyType: 'electricity', co2PerUnitKg: 0.54 },
];

// Countries/regions for dropdown (Canada only)
export const availableRegions = [
  { value: 'Canada', label: 'Canada' },
  { value: 'CA_QC', label: 'Québec' },
  { value: 'CA_ON', label: 'Ontario' },
  { value: 'CA_BC', label: 'Colombie-Britannique' },
  { value: 'CA_AB', label: 'Alberta' },
  { value: 'CA_MB', label: 'Manitoba' },
];

// Currencies (CAD only)
export const availableCurrencies = [
  { value: 'CAD', label: '$ Canadian Dollar' },
];
