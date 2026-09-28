// Parseurs des réponses API télématique (Geotab, Samsara).
//
// Règle (Phase 2c refonte) : AUCUNE valeur inventée. Une donnée vient de
// l'API (mesurée) ou c'est le DÉFAUT DE CATÉGORIE du moteur TCO
// (déterministe, sourcé — src/lib/tco/assumptions), marqué « estimation ».
// Le hasard n'a pas sa place dans des données présentées comme réelles.
import { DEFAUTS_CATEGORIES } from '@/lib/tco';
import type { CategorieVehicule } from '@/lib/tco';
import { MockVehicle } from './mockTelematicsData';

// Geotab Device interface (with odometer data from API)
interface GeotabDevice {
  id: string;
  name: string;
  serialNumber?: string;
  vin?: string;
  deviceType?: string;
  engineVehicleIdentificationNumber?: string;
  vehicleIdentificationNumber?: string;
  licensePlate?: string;
  comment?: string;
  // Odometer data from API
  currentOdometer?: number | null;
  annualKm?: number | null;
}

// Samsara Vehicle interface (with odometer data from API)
interface SamsaraVehicle {
  id: string;
  name: string;
  vin?: string;
  make?: string;
  model?: string;
  year?: number;
  vehicleType?: string;
  licensePlate?: string;
  notes?: string;
  externalIds?: Record<string, string>;
  // Odometer data from API
  currentOdometer?: number | null;
  annualKm?: number | null;
}

// Vehicle type detection based on name/model
function detectVehicleType(name: string, vehicleType?: string): 'Light Van' | 'Medium Truck' | 'Heavy Truck' {
  const lowerName = (name + ' ' + (vehicleType || '')).toLowerCase();

  // Light Van indicators
  if (lowerName.includes('van') || lowerName.includes('transit') || lowerName.includes('sprinter') ||
      lowerName.includes('promaster') || lowerName.includes('express') || lowerName.includes('savana')) {
    return 'Light Van';
  }

  // Heavy Truck indicators
  if (lowerName.includes('semi') || lowerName.includes('trailer') || lowerName.includes('cascadia') ||
      lowerName.includes('vnl') || lowerName.includes('t680') || lowerName.includes('579') ||
      lowerName.includes('anthem') || lowerName.includes('class 8') || lowerName.includes('heavy')) {
    return 'Heavy Truck';
  }

  // Default to Medium Truck
  return 'Medium Truck';
}

/** Catégorie du moteur TCO correspondant au type détecté. */
export function categorieTco(vehicleType: 'Light Van' | 'Medium Truck' | 'Heavy Truck'): CategorieVehicule {
  switch (vehicleType) {
    case 'Light Van':
      return 'camionnette';
    case 'Medium Truck':
      return 'camion_moyen';
    case 'Heavy Truck':
      return 'camion_lourd';
  }
}

/** Défaut de catégorie (déterministe, sourcé) pour le km annuel. */
function kmParAnParDefaut(vehicleType: 'Light Van' | 'Medium Truck' | 'Heavy Truck'): number {
  return DEFAUTS_CATEGORIES[categorieTco(vehicleType)].kmParAnDefaut;
}

/** Défaut de catégorie (déterministe, sourcé) pour la consommation diesel. */
function consommationParDefaut(vehicleType: 'Light Van' | 'Medium Truck' | 'Heavy Truck'): number {
  return DEFAUTS_CATEGORIES[categorieTco(vehicleType)].consommation.diesel.valeur;
}

// Type de trajet : jamais fourni par ces APIs — attribution DÉTERMINISTE
// par type de véhicule, marquée estimation via consumptionSource côté
// consommation et hasRealOdometer côté kilométrage.
function routeTypeParDefaut(vehicleType: 'Light Van' | 'Medium Truck' | 'Heavy Truck'): 'Urban' | 'Regional' | 'Long-haul' {
  switch (vehicleType) {
    case 'Light Van':
      return 'Urban';
    case 'Medium Truck':
      return 'Regional';
    case 'Heavy Truck':
      return 'Long-haul';
  }
}

// Calculate daily km from annual km
function calculateDailyKm(annualKm: number): number {
  return Math.round(annualKm / 250); // ~250 working days
}

/**
 * Parse Geotab Device to our internal vehicle format.
 * Odomètre réel si l'API le fournit ; sinon défaut de catégorie marqué
 * estimation (hasRealOdometer=false). VIN importé quand présent.
 */
export function parseGeotabVehicle(device: GeotabDevice): MockVehicle {
  const vehicleType = detectVehicleType(device.name, device.deviceType);

  const hasRealOdometer = device.annualKm !== null && device.annualKm !== undefined && device.annualKm > 0;
  const annualKm = hasRealOdometer ? (device.annualKm as number) : kmParAnParDefaut(vehicleType);

  return {
    id: crypto.randomUUID(),
    externalId: device.id,
    vehicleType,
    makeModel: device.name,
    vin:
      device.vin ||
      device.vehicleIdentificationNumber ||
      device.engineVehicleIdentificationNumber ||
      undefined,
    annualKm,
    fuelConsumption: consommationParDefaut(vehicleType),
    consumptionSource: 'estimation',
    routeType: routeTypeParDefaut(vehicleType),
    dailyKm: calculateDailyKm(annualKm),
    hasRealOdometer,
    currentOdometer: device.currentOdometer || undefined,
  };
}

/**
 * Parse Samsara Vehicle to our internal vehicle format.
 * VIN, marque, modèle et année importés quand l'API les fournit.
 */
export function parseSamsaraVehicle(vehicle: SamsaraVehicle): MockVehicle {
  const vehicleType = detectVehicleType(vehicle.name, vehicle.vehicleType);

  const hasRealOdometer = vehicle.annualKm !== null && vehicle.annualKm !== undefined && vehicle.annualKm > 0;
  const annualKm = hasRealOdometer ? (vehicle.annualKm as number) : kmParAnParDefaut(vehicleType);

  const makeModel = vehicle.make && vehicle.model
    ? `${vehicle.make} ${vehicle.model}${vehicle.year ? ` ${vehicle.year}` : ''}`
    : vehicle.name;

  return {
    id: crypto.randomUUID(),
    externalId: vehicle.id,
    vehicleType,
    makeModel,
    vin: vehicle.vin || undefined,
    make: vehicle.make || undefined,
    model: vehicle.model || undefined,
    modelYear: vehicle.year || undefined,
    annualKm,
    fuelConsumption: consommationParDefaut(vehicleType),
    consumptionSource: 'estimation',
    routeType: routeTypeParDefaut(vehicleType),
    dailyKm: calculateDailyKm(annualKm),
    hasRealOdometer,
    currentOdometer: vehicle.currentOdometer || undefined,
  };
}

/**
 * Parse an array of Geotab devices to vehicles
 */
export function parseGeotabFleet(devices: GeotabDevice[]): MockVehicle[] {
  return devices.map(parseGeotabVehicle);
}

/**
 * Parse an array of Samsara vehicles to vehicles
 */
export function parseSamsaraFleet(vehicles: SamsaraVehicle[]): MockVehicle[] {
  return vehicles.map(parseSamsaraVehicle);
}

/**
 * Generic parser that detects provider and parses accordingly
 */
export function parseProviderFleet(provider: string, data: unknown[]): MockVehicle[] {
  if (provider === 'geotab') {
    return parseGeotabFleet(data as GeotabDevice[]);
  } else if (provider === 'samsara') {
    return parseSamsaraFleet(data as SamsaraVehicle[]);
  }
  throw new Error(`Unknown provider: ${provider}`);
}
