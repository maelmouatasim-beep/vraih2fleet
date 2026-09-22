// Mock Canadian fleet data generator for telematics import

export interface MockVehicle {
  id: string;
  externalId: string;
  vehicleType: 'Light Van' | 'Medium Truck' | 'Heavy Truck';
  makeModel: string;
  annualKm: number;
  fuelConsumption: number; // L/100km
  routeType: 'Urban' | 'Regional' | 'Long-haul';
  dailyKm: number;
  // Optional: indicates if annualKm comes from real odometer data
  hasRealOdometer?: boolean;
  currentOdometer?: number;
}

const lightVanModels = [
  'Ford Transit Connect',
  'RAM ProMaster City',
  'Mercedes Sprinter 1500',
  'Chevrolet Express 2500',
  'GMC Savana 2500',
];

const mediumTruckModels = [
  'Freightliner M2 106',
  'Hino 268',
  'Isuzu FTR',
  'Kenworth K270',
  'Peterbilt 220',
];

const heavyTruckModels = [
  'Volvo VNL 760',
  'Freightliner Cascadia',
  'Kenworth T680',
  'Peterbilt 579',
  'Mack Anthem',
];

function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFromArray<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateVehicleId(index: number): string {
  const prefix = ['VEH', 'FLT', 'TRK', 'VAN'][Math.floor(Math.random() * 4)];
  return `${prefix}-${String(index).padStart(3, '0')}`;
}

export function generateMockFleet(count: number = 50): MockVehicle[] {
  const vehicles: MockVehicle[] = [];
  let index = 1;

  // Distribution: ~30% vans, ~40% medium trucks, ~30% heavy trucks
  const lightVanCount = Math.round(count * 0.3);
  const mediumTruckCount = Math.round(count * 0.4);
  const heavyTruckCount = count - lightVanCount - mediumTruckCount;

  // Light Vans: 40-80 km/day, 12-18 L/100km, mostly urban
  for (let i = 0; i < lightVanCount; i++) {
    const dailyKm = randomBetween(40, 80);
    vehicles.push({
      id: crypto.randomUUID(),
      externalId: generateVehicleId(index++),
      vehicleType: 'Light Van',
      makeModel: randomFromArray(lightVanModels),
      annualKm: dailyKm * randomBetween(240, 260), // ~250 working days
      fuelConsumption: randomBetween(12, 18),
      routeType: Math.random() > 0.2 ? 'Urban' : 'Regional',
      dailyKm,
    });
  }

  // Medium Trucks: 100-250 km/day, 22-28 L/100km, regional
  for (let i = 0; i < mediumTruckCount; i++) {
    const dailyKm = randomBetween(100, 250);
    vehicles.push({
      id: crypto.randomUUID(),
      externalId: generateVehicleId(index++),
      vehicleType: 'Medium Truck',
      makeModel: randomFromArray(mediumTruckModels),
      annualKm: dailyKm * randomBetween(240, 260),
      fuelConsumption: randomBetween(22, 28),
      routeType: Math.random() > 0.3 ? 'Regional' : 'Urban',
      dailyKm,
    });
  }

  // Heavy Trucks: 300-500 km/day, 32-38 L/100km, long-haul
  for (let i = 0; i < heavyTruckCount; i++) {
    const dailyKm = randomBetween(300, 500);
    vehicles.push({
      id: crypto.randomUUID(),
      externalId: generateVehicleId(index++),
      vehicleType: 'Heavy Truck',
      makeModel: randomFromArray(heavyTruckModels),
      annualKm: dailyKm * randomBetween(240, 260),
      fuelConsumption: randomBetween(32, 38),
      routeType: 'Long-haul',
      dailyKm,
    });
  }

  return vehicles;
}

export interface VehicleGroup {
  id: string;
  name: string;
  vehicles: MockVehicle[];
  avgDailyKm: number;
  recommendation: string;
  badge: string;
  badgeVariant: 'default' | 'secondary' | 'destructive';
  technology: 'BEV' | 'FCEV' | 'MIX';
}

export function groupVehicles(vehicles: MockVehicle[]): VehicleGroup[] {
  const shortRange = vehicles.filter(v => v.dailyKm < 100);
  const mediumRange = vehicles.filter(v => v.dailyKm >= 100 && v.dailyKm <= 300);
  const longRange = vehicles.filter(v => v.dailyKm > 300);

  const calcAvg = (arr: MockVehicle[]) => 
    arr.length > 0 ? Math.round(arr.reduce((sum, v) => sum + v.dailyKm, 0) / arr.length) : 0;

  return [
    {
      id: 'short-range',
      name: 'Short Range Fleet',
      vehicles: shortRange,
      avgDailyKm: calcAvg(shortRange),
      recommendation: 'Ideal for Battery Electric (BEV)',
      badge: 'High conversion potential',
      badgeVariant: 'default',
      technology: 'BEV',
    },
    {
      id: 'medium-range',
      name: 'Medium Range Fleet',
      vehicles: mediumRange,
      avgDailyKm: calcAvg(mediumRange),
      recommendation: 'Mix of BEV (urban routes) and FCEV (regional)',
      badge: 'Moderate complexity',
      badgeVariant: 'secondary',
      technology: 'MIX',
    },
    {
      id: 'long-range',
      name: 'Long Range Fleet',
      vehicles: longRange,
      avgDailyKm: calcAvg(longRange),
      recommendation: 'Hydrogen Fuel Cell (FCEV) or remain Diesel',
      badge: 'Requires infrastructure planning',
      badgeVariant: 'destructive',
      technology: 'FCEV',
    },
  ];
}

export interface ScenarioRecommendation {
  id: string;
  name: string;
  type: 'Conservative' | 'Balanced' | 'Aggressive';
  bevPercent: number;
  fcevPercent: number;
  dieselPercent: number;
  bevCount: number;
  fcevCount: number;
  dieselCount: number;
  tcoSavings: number;
  co2Reduction: number;
  infrastructureNeeded: string;
  color: string;
}

export function generateScenarioRecommendations(vehicles: MockVehicle[]): ScenarioRecommendation[] {
  const total = vehicles.length;
  const avgAnnualKm = vehicles.reduce((sum, v) => sum + v.annualKm, 0) / total;
  
  // Base TCO savings calculation (simplified)
  const baseSavings = Math.round(total * avgAnnualKm * 0.05); // ~$0.05/km savings
  const baseCo2 = Math.round(total * avgAnnualKm * 0.0025); // ~2.5kg CO2/km diesel

  return [
    {
      id: 'conservative',
      name: 'Conservative',
      type: 'Conservative',
      bevPercent: 30,
      fcevPercent: 10,
      dieselPercent: 60,
      bevCount: Math.round(total * 0.3),
      fcevCount: Math.round(total * 0.1),
      dieselCount: Math.round(total * 0.6),
      tcoSavings: Math.round(baseSavings * 0.4),
      co2Reduction: Math.round(baseCo2 * 0.35),
      infrastructureNeeded: '3-5 chargers, 0-1 H₂ stations',
      color: 'bg-blue-500',
    },
    {
      id: 'balanced',
      name: 'Balanced',
      type: 'Balanced',
      bevPercent: 50,
      fcevPercent: 25,
      dieselPercent: 25,
      bevCount: Math.round(total * 0.5),
      fcevCount: Math.round(total * 0.25),
      dieselCount: Math.round(total * 0.25),
      tcoSavings: Math.round(baseSavings * 0.7),
      co2Reduction: Math.round(baseCo2 * 0.65),
      infrastructureNeeded: '8-12 chargers, 1-2 H₂ stations',
      color: 'bg-green-500',
    },
    {
      id: 'aggressive',
      name: 'Aggressive',
      type: 'Aggressive',
      bevPercent: 60,
      fcevPercent: 40,
      dieselPercent: 0,
      bevCount: Math.round(total * 0.6),
      fcevCount: Math.round(total * 0.4),
      dieselCount: 0,
      tcoSavings: baseSavings,
      co2Reduction: baseCo2,
      infrastructureNeeded: '15-20 chargers, 2-3 H₂ stations',
      color: 'bg-purple-500',
    },
  ];
}
