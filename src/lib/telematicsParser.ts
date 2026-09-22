// Telematics API response parsers for Geotab and Samsara
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

// Estimate annual km based on vehicle type
function estimateAnnualKm(vehicleType: 'Light Van' | 'Medium Truck' | 'Heavy Truck'): number {
  const baseWorkingDays = 250;
  switch (vehicleType) {
    case 'Light Van':
      return Math.floor((40 + Math.random() * 40) * baseWorkingDays); // 40-80 km/day
    case 'Medium Truck':
      return Math.floor((100 + Math.random() * 150) * baseWorkingDays); // 100-250 km/day
    case 'Heavy Truck':
      return Math.floor((300 + Math.random() * 200) * baseWorkingDays); // 300-500 km/day
  }
}

// Estimate fuel consumption based on vehicle type
function estimateFuelConsumption(vehicleType: 'Light Van' | 'Medium Truck' | 'Heavy Truck'): number {
  switch (vehicleType) {
    case 'Light Van':
      return 12 + Math.floor(Math.random() * 6); // 12-18 L/100km
    case 'Medium Truck':
      return 22 + Math.floor(Math.random() * 6); // 22-28 L/100km
    case 'Heavy Truck':
      return 32 + Math.floor(Math.random() * 6); // 32-38 L/100km
  }
}

// Determine route type based on vehicle type
function determineRouteType(vehicleType: 'Light Van' | 'Medium Truck' | 'Heavy Truck'): 'Urban' | 'Regional' | 'Long-haul' {
  switch (vehicleType) {
    case 'Light Van':
      return Math.random() > 0.2 ? 'Urban' : 'Regional';
    case 'Medium Truck':
      return Math.random() > 0.3 ? 'Regional' : 'Urban';
    case 'Heavy Truck':
      return 'Long-haul';
  }
}

// Calculate daily km from annual km
function calculateDailyKm(annualKm: number): number {
  return Math.round(annualKm / 250); // ~250 working days
}

/**
 * Parse Geotab Device to our internal MockVehicle format
 * Uses real odometer data if available, otherwise estimates
 */
export function parseGeotabVehicle(device: GeotabDevice): MockVehicle {
  const vehicleType = detectVehicleType(device.name, device.deviceType);
  
  // Use real annual km from odometer if available, otherwise estimate
  const annualKm = device.annualKm && device.annualKm > 0 
    ? device.annualKm 
    : estimateAnnualKm(vehicleType);
  
  const hasRealOdometer = device.annualKm !== null && device.annualKm !== undefined && device.annualKm > 0;
  
  return {
    id: crypto.randomUUID(),
    externalId: device.id,
    vehicleType,
    makeModel: device.name,
    annualKm,
    fuelConsumption: estimateFuelConsumption(vehicleType),
    routeType: determineRouteType(vehicleType),
    dailyKm: calculateDailyKm(annualKm),
    hasRealOdometer,
    currentOdometer: device.currentOdometer || undefined,
  };
}

/**
 * Parse Samsara Vehicle to our internal MockVehicle format
 * Uses real odometer data if available, otherwise estimates
 */
export function parseSamsaraVehicle(vehicle: SamsaraVehicle): MockVehicle {
  const vehicleType = detectVehicleType(vehicle.name, vehicle.vehicleType);
  
  // Use real annual km from odometer if available, otherwise estimate
  const annualKm = vehicle.annualKm && vehicle.annualKm > 0 
    ? vehicle.annualKm 
    : estimateAnnualKm(vehicleType);
  
  const hasRealOdometer = vehicle.annualKm !== null && vehicle.annualKm !== undefined && vehicle.annualKm > 0;
  
  const makeModel = vehicle.make && vehicle.model 
    ? `${vehicle.make} ${vehicle.model}${vehicle.year ? ` ${vehicle.year}` : ''}`
    : vehicle.name;
  
  return {
    id: crypto.randomUUID(),
    externalId: vehicle.id,
    vehicleType,
    makeModel,
    annualKm,
    fuelConsumption: estimateFuelConsumption(vehicleType),
    routeType: determineRouteType(vehicleType),
    dailyKm: calculateDailyKm(annualKm),
    hasRealOdometer,
    currentOdometer: vehicle.currentOdometer || undefined,
  };
}

/**
 * Parse an array of Geotab devices to MockVehicles
 */
export function parseGeotabFleet(devices: GeotabDevice[]): MockVehicle[] {
  return devices.map(parseGeotabVehicle);
}

/**
 * Parse an array of Samsara vehicles to MockVehicles
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
