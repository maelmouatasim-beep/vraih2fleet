/**
 * Case Studies Calculation Module
 * 
 * Standardized calculations for CO2 emissions, ROI, and TCO
 * using industry-standard assumptions documented for transparency.
 */

// ============= INDUSTRY STANDARD ASSUMPTIONS =============
// Sources: NRCan, EPA, NACFE, DOE

export const ASSUMPTIONS = {
  // Diesel consumption (L/100km) by vehicle type
  dieselConsumption: {
    transitBus: 45.0,      // Urban transit bus (40-50 L/100km typical)
    cityBus: 40.0,         // Smaller city bus
    classLHDTruck: 35.0,   // Class 8 heavy-duty truck
    mediumTruck: 25.0,     // Medium-duty truck
  },
  
  // CO2 emission factor (kg CO2 per liter diesel)
  // Source: Environment and Climate Change Canada
  co2PerLiterDiesel: 2.68,
  
  // Electricity consumption (kWh/km) by vehicle type
  electricityConsumption: {
    transitBus: 1.5,       // Electric transit bus (1.2-1.8 kWh/km)
    cityBus: 1.2,
    truck: 2.0,            // Electric heavy truck
  },
  
  // Hydrogen consumption (kg/100km) by vehicle type
  hydrogenConsumption: {
    transitBus: 9.0,       // Fuel cell bus
    heavyTruck: 10.0,      // Fuel cell heavy truck
  },
  
  // Grid CO2 factor by province (g CO2/kWh)
  // Source: Environment Canada 2023
  gridCO2Factor: {
    quebec: 2,             // Hydro-dominant
    manitoba: 3,           // Hydro-dominant
    ontario: 30,
    alberta: 450,          // Coal/gas heavy
    bc: 10,
    saskatchewan: 650,
  },
  
  // H2 CO2 factor (kg CO2/kg H2) by type
  h2CO2Factor: {
    green: 0.5,
    blue: 3.0,
    grey: 10.0,
  },
};

// ============= CALCULATION INTERFACES =============

export interface FleetParams {
  vehicleCount: number;
  annualKmPerVehicle: number;
  vehicleType: 'transitBus' | 'cityBus' | 'classLHDTruck' | 'mediumTruck';
}

export interface DieselCostParams {
  fleet: FleetParams;
  dieselPricePerLiter: number;
  dieselConsumptionOverride?: number; // L/100km
}

export interface ElectricCostParams {
  fleet: FleetParams;
  electricityPricePerKwh: number;
  consumptionKwhPerKm?: number;
}

export interface HydrogenCostParams {
  fleet: FleetParams;
  h2PricePerKg: number;
  consumptionKgPer100km?: number;
}

export interface ROIParams {
  infrastructureCost: number;
  annualSavings: number;
}

export interface CO2CalculationResult {
  annualCO2Tonnes: number;
  breakdown: {
    totalKm: number;
    fuelConsumed: number;
    fuelUnit: string;
    emissionFactor: number;
    emissionFactorUnit: string;
  };
}

// ============= CALCULATION FUNCTIONS =============

/**
 * Calculate annual diesel cost
 */
export function calculateAnnualDieselCost(params: DieselCostParams): number {
  const { fleet, dieselPricePerLiter, dieselConsumptionOverride } = params;
  const consumption = dieselConsumptionOverride ?? ASSUMPTIONS.dieselConsumption[fleet.vehicleType];
  const totalKm = fleet.vehicleCount * fleet.annualKmPerVehicle;
  const litersConsumed = (totalKm / 100) * consumption;
  return litersConsumed * dieselPricePerLiter;
}

/**
 * Calculate annual diesel CO2 emissions
 * Formula: (vehicles × km/year × L/100km / 100) × kg CO2/L
 */
export function calculateDieselCO2(fleet: FleetParams, consumptionOverride?: number): CO2CalculationResult {
  const consumption = consumptionOverride ?? ASSUMPTIONS.dieselConsumption[fleet.vehicleType];
  const totalKm = fleet.vehicleCount * fleet.annualKmPerVehicle;
  const litersConsumed = (totalKm / 100) * consumption;
  const co2Kg = litersConsumed * ASSUMPTIONS.co2PerLiterDiesel;
  
  return {
    annualCO2Tonnes: co2Kg / 1000,
    breakdown: {
      totalKm,
      fuelConsumed: litersConsumed,
      fuelUnit: 'liters diesel',
      emissionFactor: ASSUMPTIONS.co2PerLiterDiesel,
      emissionFactorUnit: 'kg CO2/L',
    },
  };
}

/**
 * Calculate annual electric operating cost
 */
export function calculateAnnualElectricCost(params: ElectricCostParams): number {
  const { fleet, electricityPricePerKwh, consumptionKwhPerKm } = params;
  const consumption = consumptionKwhPerKm ?? ASSUMPTIONS.electricityConsumption[fleet.vehicleType as keyof typeof ASSUMPTIONS.electricityConsumption] ?? 1.5;
  const totalKm = fleet.vehicleCount * fleet.annualKmPerVehicle;
  const kwhConsumed = totalKm * consumption;
  return kwhConsumed * electricityPricePerKwh;
}

/**
 * Calculate annual electric CO2 emissions (based on grid)
 */
export function calculateElectricCO2(
  fleet: FleetParams, 
  province: keyof typeof ASSUMPTIONS.gridCO2Factor,
  consumptionKwhPerKm?: number
): CO2CalculationResult {
  const consumption = consumptionKwhPerKm ?? ASSUMPTIONS.electricityConsumption[fleet.vehicleType as keyof typeof ASSUMPTIONS.electricityConsumption] ?? 1.5;
  const totalKm = fleet.vehicleCount * fleet.annualKmPerVehicle;
  const kwhConsumed = totalKm * consumption;
  const gridFactor = ASSUMPTIONS.gridCO2Factor[province];
  const co2Grams = kwhConsumed * gridFactor;
  
  return {
    annualCO2Tonnes: co2Grams / 1_000_000,
    breakdown: {
      totalKm,
      fuelConsumed: kwhConsumed,
      fuelUnit: 'kWh',
      emissionFactor: gridFactor,
      emissionFactorUnit: 'g CO2/kWh',
    },
  };
}

/**
 * Calculate annual hydrogen operating cost
 */
export function calculateAnnualH2Cost(params: HydrogenCostParams): number {
  const { fleet, h2PricePerKg, consumptionKgPer100km } = params;
  const consumption = consumptionKgPer100km ?? ASSUMPTIONS.hydrogenConsumption[fleet.vehicleType as keyof typeof ASSUMPTIONS.hydrogenConsumption] ?? 9.0;
  const totalKm = fleet.vehicleCount * fleet.annualKmPerVehicle;
  const kgConsumed = (totalKm / 100) * consumption;
  return kgConsumed * h2PricePerKg;
}

/**
 * Calculate annual hydrogen CO2 emissions
 */
export function calculateH2CO2(
  fleet: FleetParams,
  h2Type: keyof typeof ASSUMPTIONS.h2CO2Factor,
  consumptionKgPer100km?: number
): CO2CalculationResult {
  const consumption = consumptionKgPer100km ?? ASSUMPTIONS.hydrogenConsumption[fleet.vehicleType as keyof typeof ASSUMPTIONS.hydrogenConsumption] ?? 9.0;
  const totalKm = fleet.vehicleCount * fleet.annualKmPerVehicle;
  const kgH2Consumed = (totalKm / 100) * consumption;
  const h2Factor = ASSUMPTIONS.h2CO2Factor[h2Type];
  const co2Kg = kgH2Consumed * h2Factor;
  
  return {
    annualCO2Tonnes: co2Kg / 1000,
    breakdown: {
      totalKm,
      fuelConsumed: kgH2Consumed,
      fuelUnit: 'kg H2',
      emissionFactor: h2Factor,
      emissionFactorUnit: 'kg CO2/kg H2',
    },
  };
}

/**
 * Calculate ROI / Payback period in years
 * Formula: Infrastructure Cost / Annual Savings
 */
export function calculatePaybackYears(params: ROIParams): number {
  if (params.annualSavings <= 0) return Infinity;
  return params.infrastructureCost / params.annualSavings;
}

/**
 * Calculate CO2 avoided by transitioning from diesel
 */
export function calculateCO2Avoided(
  dieselCO2: CO2CalculationResult,
  newTechCO2: CO2CalculationResult
): number {
  return dieselCO2.annualCO2Tonnes - newTechCO2.annualCO2Tonnes;
}

// ============= CASE STUDY SPECIFIC CALCULATIONS =============

/**
 * STM Montreal - 40 electric buses
 * Calcul: 40 bus × 60,000 km × 45 L/100km × 2.68 kg/L = 2,894 tonnes CO2 évitées
 * (Moins les émissions du réseau Hydro-Québec: ~4 tonnes)
 */
export function calculateSTMCase() {
  const fleet: FleetParams = {
    vehicleCount: 40,
    annualKmPerVehicle: 60000,
    vehicleType: 'transitBus',
  };
  
  const dieselCO2 = calculateDieselCO2(fleet, 45);
  const electricCO2 = calculateElectricCO2(fleet, 'quebec', 1.5);
  const co2Avoided = calculateCO2Avoided(dieselCO2, electricCO2);
  
  const dieselCost = calculateAnnualDieselCost({
    fleet,
    dieselPricePerLiter: 1.75,
    dieselConsumptionOverride: 45,
  });
  
  const electricCost = calculateAnnualElectricCost({
    fleet,
    electricityPricePerKwh: 0.1065,
    consumptionKwhPerKm: 1.5,
  });
  
  const annualSavings = dieselCost - electricCost;
  const infrastructureCost = 8_000_000;
  const paybackYears = calculatePaybackYears({ infrastructureCost, annualSavings });
  
  return {
    dieselCO2Tonnes: Math.round(dieselCO2.annualCO2Tonnes),
    electricCO2Tonnes: Math.round(electricCO2.annualCO2Tonnes),
    co2AvoidedTonnes: Math.round(co2Avoided),
    dieselAnnualCost: dieselCost,
    electricAnnualCost: electricCost,
    annualSavings,
    paybackYears: Math.round(paybackYears * 10) / 10,
    breakdown: dieselCO2.breakdown,
  };
}

/**
 * Winnipeg Transit - Mixed fleet strategy
 */
export function calculateWinnipegCase() {
  const fleet: FleetParams = {
    vehicleCount: 20,
    annualKmPerVehicle: 50000,
    vehicleType: 'transitBus',
  };
  
  const dieselCO2 = calculateDieselCO2(fleet, 42);
  
  // Mixed: 15 electric + 5 H2
  const electricFleet: FleetParams = { ...fleet, vehicleCount: 15 };
  const h2Fleet: FleetParams = { ...fleet, vehicleCount: 5 };
  
  const electricCO2 = calculateElectricCO2(electricFleet, 'manitoba', 1.4);
  const h2CO2 = calculateH2CO2(h2Fleet, 'blue', 9.0);
  
  const mixedCO2 = electricCO2.annualCO2Tonnes + h2CO2.annualCO2Tonnes;
  const co2Avoided = dieselCO2.annualCO2Tonnes - mixedCO2;
  
  const dieselCost = calculateAnnualDieselCost({
    fleet,
    dieselPricePerLiter: 1.65,
    dieselConsumptionOverride: 42,
  });
  
  const electricCost = calculateAnnualElectricCost({
    fleet: electricFleet,
    electricityPricePerKwh: 0.10,
    consumptionKwhPerKm: 1.4,
  });
  
  const h2Cost = calculateAnnualH2Cost({
    fleet: h2Fleet,
    h2PricePerKg: 15,
    consumptionKgPer100km: 9.0,
  });
  
  const mixedAnnualCost = electricCost + h2Cost;
  const annualSavings = dieselCost - mixedAnnualCost;
  const infrastructureCost = 6_500_000;
  const paybackYears = calculatePaybackYears({ infrastructureCost, annualSavings });
  
  return {
    dieselCO2Tonnes: Math.round(dieselCO2.annualCO2Tonnes),
    mixedCO2Tonnes: Math.round(mixedCO2),
    co2AvoidedTonnes: Math.round(co2Avoided),
    dieselAnnualCost: dieselCost,
    mixedAnnualCost,
    annualSavings,
    paybackYears: Math.round(paybackYears * 10) / 10,
  };
}

/**
 * ERA Alberta - Hydrogen trucks
 */
export function calculateERACase() {
  const fleet: FleetParams = {
    vehicleCount: 10,
    annualKmPerVehicle: 120000,
    vehicleType: 'classLHDTruck',
  };
  
  const dieselCO2 = calculateDieselCO2(fleet, 38);
  const h2CO2 = calculateH2CO2(fleet, 'blue', 10.0);
  const co2Avoided = calculateCO2Avoided(dieselCO2, h2CO2);
  
  const dieselCost = calculateAnnualDieselCost({
    fleet,
    dieselPricePerLiter: 1.70,
    dieselConsumptionOverride: 38,
  });
  
  const h2Cost = calculateAnnualH2Cost({
    fleet,
    h2PricePerKg: 13.5, // Midpoint of $12-15
    consumptionKgPer100km: 10.0,
  });
  
  const annualSavings = dieselCost - h2Cost;
  const infrastructureCost = 3_000_000;
  const paybackYears = calculatePaybackYears({ infrastructureCost, annualSavings });
  
  return {
    dieselCO2Tonnes: Math.round(dieselCO2.annualCO2Tonnes),
    h2CO2Tonnes: Math.round(h2CO2.annualCO2Tonnes),
    co2AvoidedTonnes: Math.round(co2Avoided),
    dieselAnnualCost: dieselCost,
    h2AnnualCost: h2Cost,
    annualSavings,
    paybackYears: Math.round(paybackYears * 10) / 10,
  };
}

/**
 * Format number to display string with locale
 */
export function formatNumber(value: number, locale: string = 'fr-CA'): string {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(value);
}

/**
 * Format currency
 */
export function formatCurrency(value: number, locale: string = 'fr-CA'): string {
  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 1_000) {
    return `$${Math.round(value / 1_000)}K`;
  }
  return new Intl.NumberFormat(locale, { style: 'currency', currency: 'CAD' }).format(value);
}
