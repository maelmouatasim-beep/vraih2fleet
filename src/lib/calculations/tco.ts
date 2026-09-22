import { Scenario, ReferenceData, TCOResult, YearlyBreakdown, FleetComposition, AdvancedCostsBreakdown } from './types';
import { calculateCapex, calculateResidualValue } from './capex';
import { calculateOPEXByYear, calculatePVOPEX } from './opex';
import { calculateTotalEmissions, kgToTonnes } from './emissions';
import { calculateInfrastructure } from './infrastructure';
import { getEffectiveFleetComposition, isMixedStrategy } from './fleetMix';
import { ExtendedVehicleParams } from './flexibleTCO';

/**
 * Calculate Net Present Value
 */
export function calculateNPV(
  cashFlows: number[],
  discountRate: number
): number {
  return cashFlows.reduce((npv, cashFlow, year) => {
    const discountFactor = Math.pow(1 + discountRate, year);
    return npv + cashFlow / discountFactor;
  }, 0);
}

/**
 * Calculate payback period (years until cumulative savings equal initial investment)
 */
function calculatePaybackPeriod(
  capex: number,
  annualSavings: number
): number | null {
  if (annualSavings <= 0) return null;
  const payback = capex / annualSavings;
  return payback > 30 ? null : payback; // Cap at 30 years
}

/**
 * Calculate fuel cell stack replacement cost over analysis period
 * FC stacks typically need replacement after 15,000-20,000 hours of operation
 */
function calculateFCStackReplacementCost(
  h2VehicleCount: number,
  analysisYears: number,
  fcParams?: {
    fcStackReplacementEnabled?: boolean;
    fcStackReplacementCost?: number;
    fcStackLifespanYears?: number;
  }
): number {
  if (!fcParams?.fcStackReplacementEnabled || h2VehicleCount === 0) {
    return 0;
  }
  
  const replacementCost = fcParams.fcStackReplacementCost ?? 50000;
  const lifespanYears = fcParams.fcStackLifespanYears ?? 8;
  
  // Calculate number of replacements during analysis period
  // First replacement happens after lifespanYears, then every lifespanYears after
  const replacements = Math.floor(analysisYears / lifespanYears);
  
  return replacements * replacementCost * h2VehicleCount;
}

/**
 * Calculate H2 infrastructure scale economies
 * Large fleets (20+ H2 vehicles) can negotiate better infrastructure deals
 */
function calculateH2InfraScaleDiscount(
  h2VehicleCount: number,
  baseInfraCost: number,
  h2InfraParams?: {
    h2InfraScaleEnabled?: boolean;
    h2InfraScaleFactor?: number;
  }
): number {
  const H2_SCALE_THRESHOLD = 20; // Minimum vehicles for scale discount
  
  if (!h2InfraParams?.h2InfraScaleEnabled || h2VehicleCount < H2_SCALE_THRESHOLD) {
    return 0;
  }
  
  const scaleFactor = (h2InfraParams.h2InfraScaleFactor ?? 15) / 100;
  return baseInfraCost * scaleFactor;
}

/**
 * Calculate advanced operational costs (downtime, insurance, telematics, grid, carbon credits)
 * Note: Cold weather impact is NOT calculated here - it's handled by the consumption multiplier
 * in opex.ts based on minTemperature selection in Section C.
 */
function calculateAdvancedCosts(
  fleetComposition: FleetComposition,
  analysisYears: number,
  baseFuelCosts: { diesel: number; ev: number; hydrogen: number },
  co2AvoidedTonnes: number
): {
  downtimeCost: number;
  insuranceCost: number;
  telematicsCost: number;
  gridDemandCost: number;
  carbonCreditsValue: number;
} {
  const { operationalCosts, energyCosts, environmental } = fleetComposition;
  
  const totalVehicles = 
    (fleetComposition.diesel?.count || 0) +
    (fleetComposition.ev?.count || 0) +
    (fleetComposition.hydrogen?.count || 0);

  // 1. DOWNTIME COSTS
  let downtimeCost = 0;
  if (operationalCosts?.downtime) {
    const { hoursPerYear, costPerHour } = operationalCosts.downtime;
    downtimeCost = hoursPerYear * costPerHour * totalVehicles * analysisYears;
  }

  // 2. INSURANCE DIFFERENTIAL
  let insuranceCost = 0;
  if (operationalCosts?.insurance) {
    const { evPremium, h2Premium, dieselBaseline } = operationalCosts.insurance;
    const dieselInsurance = (fleetComposition.diesel?.count || 0) * dieselBaseline * analysisYears;
    const evInsurance = (fleetComposition.ev?.count || 0) * (dieselBaseline + evPremium) * analysisYears;
    const h2Insurance = (fleetComposition.hydrogen?.count || 0) * (dieselBaseline + h2Premium) * analysisYears;
    insuranceCost = dieselInsurance + evInsurance + h2Insurance;
  }

  // 3. TELEMATICS COST
  let telematicsCost = 0;
  if (operationalCosts?.telematics && operationalCosts.telematics.provider !== 'none') {
    const { costPerVehiclePerMonth } = operationalCosts.telematics;
    telematicsCost = costPerVehiclePerMonth * 12 * totalVehicles * analysisYears;
  }

  // 4. GRID DEMAND CHARGES (EV only)
  let gridDemandCost = 0;
  if (energyCosts?.gridCharges && fleetComposition.ev?.count > 0) {
    const { demandCharge } = energyCosts.gridCharges;
    // Estimate peak power based on EV count (assume ~50kW average per vehicle charging)
    const estimatedPeakPowerKW = fleetComposition.ev.count * 50;
    gridDemandCost = demandCharge * estimatedPeakPowerKW * 12 * analysisYears;
  }

  // 5. CARBON CREDITS (REVENUE - positive value = money earned)
  let carbonCreditsValue = 0;
  if (environmental?.carbonCredits?.enabled && co2AvoidedTonnes > 0) {
    const { pricePerTonne } = environmental.carbonCredits;
    carbonCreditsValue = co2AvoidedTonnes * pricePerTonne;
  }

  return {
    downtimeCost,
    insuranceCost,
    telematicsCost,
    gridDemandCost,
    carbonCreditsValue,
  };
}

/**
 * Calculate advanced costs breakdown for a specific year
 * Used for detailed yearlyBreakdown visualization
 */
function calculateAdvancedCostsByYear(
  fleetComposition: FleetComposition,
  yearIndex: number,
  analysisYears: number,
  co2AvoidedPerYear: number,
  h2VehicleCount: number,
  fcParams?: {
    fcStackReplacementEnabled?: boolean;
    fcStackReplacementCost?: number;
    fcStackLifespanYears?: number;
  }
): AdvancedCostsBreakdown {
  const { operationalCosts, energyCosts, environmental } = fleetComposition;
  
  const totalVehicles = 
    (fleetComposition.diesel?.count || 0) +
    (fleetComposition.ev?.count || 0) +
    (fleetComposition.hydrogen?.count || 0);

  // 1. DOWNTIME - distributed evenly per year
  let downtimePerYear = 0;
  if (operationalCosts?.downtime) {
    const { hoursPerYear, costPerHour } = operationalCosts.downtime;
    downtimePerYear = hoursPerYear * costPerHour * totalVehicles;
  }

  // 2. INSURANCE - distributed evenly per year
  let insurancePerYear = 0;
  if (operationalCosts?.insurance) {
    const { evPremium, h2Premium, dieselBaseline } = operationalCosts.insurance;
    const dieselIns = (fleetComposition.diesel?.count || 0) * dieselBaseline;
    const evIns = (fleetComposition.ev?.count || 0) * (dieselBaseline + evPremium);
    const h2Ins = (fleetComposition.hydrogen?.count || 0) * (dieselBaseline + h2Premium);
    insurancePerYear = dieselIns + evIns + h2Ins;
  }

  // 3. TELEMATICS - distributed evenly per year
  let telematicsPerYear = 0;
  if (operationalCosts?.telematics && operationalCosts.telematics.provider !== 'none') {
    const { costPerVehiclePerMonth } = operationalCosts.telematics;
    telematicsPerYear = costPerVehiclePerMonth * 12 * totalVehicles;
  }

  // 4. GRID DEMAND - distributed evenly per year
  let gridDemandPerYear = 0;
  if (energyCosts?.gridCharges && fleetComposition.ev?.count > 0) {
    const { demandCharge } = energyCosts.gridCharges;
    const estimatedPeakPowerKW = fleetComposition.ev.count * 50;
    gridDemandPerYear = demandCharge * estimatedPeakPowerKW * 12;
  }

  // 5. FC STACK REPLACEMENT - only in specific years (year 8, 16, etc.)
  let fcStackReplacementPerYear = 0;
  if (fcParams?.fcStackReplacementEnabled && h2VehicleCount > 0) {
    const replacementCost = fcParams.fcStackReplacementCost ?? 50000;
    const lifespanYears = fcParams.fcStackLifespanYears ?? 8;
    
    // Check if this year is a replacement year
    if (yearIndex > 0 && yearIndex % lifespanYears === 0) {
      fcStackReplacementPerYear = replacementCost * h2VehicleCount;
    }
  }

  // 6. CARBON CREDITS - distributed evenly per year
  let carbonCreditsPerYear = 0;
  if (environmental?.carbonCredits?.enabled && co2AvoidedPerYear > 0) {
    const { pricePerTonne } = environmental.carbonCredits;
    carbonCreditsPerYear = co2AvoidedPerYear * pricePerTonne;
  }

  return {
    downtime: downtimePerYear,
    insurance: insurancePerYear,
    telematics: telematicsPerYear,
    gridDemand: gridDemandPerYear,
    fcStackReplacement: fcStackReplacementPerYear,
    carbonCredits: carbonCreditsPerYear,
  };
}

/**
 * Main TCO calculation function
 */
export function calculateTCO(
  scenario: Scenario,
  referenceData: ReferenceData
): TCOResult {
  const discountRate = scenario.discountRate / 100;
  
  // Calculate CAPEX
  const capexResult = calculateCapex(scenario, referenceData);
  const capex = capexResult.total;
  
  // Calculate infrastructure (from scenario or calculated defaults)
  const infrastructure = calculateInfrastructure(scenario, referenceData);
  
  // Check for user-provided infrastructure cost from flexible scenario vehicles
  const vehicleParams = (scenario.fleetComposition as any)?.vehicleParams as ExtendedVehicleParams | undefined;
  const userInfraCostEarly = vehicleParams?.infrastructureCostTotal || 0;
  
  // Determine effective infrastructure cost
  // Priority: 1) Custom infra enabled with per-vehicle cost, 2) User total infra, 3) Calculated
  let effectiveInfraCost = infrastructure.totalCost;
  const customInfraEnabled = vehicleParams?.customInfraEnabled ?? false;
  
  if (customInfraEnabled && vehicleParams?.customInfraCostPerVehicle) {
    const totalVehicles = 
      (scenario.fleetComposition.diesel?.count || 0) +
      (scenario.fleetComposition.ev?.count || 0) +
      (scenario.fleetComposition.hydrogen?.count || 0);
    effectiveInfraCost = vehicleParams.customInfraCostPerVehicle * totalVehicles;
  } else if (userInfraCostEarly > 0) {
    effectiveInfraCost = userInfraCostEarly;
  }
  
  // Calculate H2-specific costs
  const h2Params = vehicleParams?.h2Params;
  const h2VehicleCount = scenario.fleetComposition.hydrogen?.count || 0;
  
  // FC Stack replacement cost
  const fcStackReplacementCost = calculateFCStackReplacementCost(
    h2VehicleCount,
    scenario.analysisYears,
    h2Params
  );
  
  // H2 infrastructure scale discount
  const h2InfraScaleDiscount = calculateH2InfraScaleDiscount(
    h2VehicleCount,
    infrastructure.h2StationsCost,
    h2Params
  );
  
  // Apply H2 scale discount to effective infrastructure cost
  effectiveInfraCost = effectiveInfraCost - h2InfraScaleDiscount;
  
  // Total initial investment (CAPEX + Infrastructure)
  const totalInitialInvestment = capex + effectiveInfraCost;
  
  // Calculate yearly breakdown
  const yearlyBreakdown: YearlyBreakdown[] = [];
  let cumulativeCost = totalInitialInvestment;
  let totalOpex = 0;
  let pvOpex = 0;
  
  // Track applied consumption for transparency
  let appliedConsumption: TCOResult['appliedConsumption'];
  
  // Pre-calculate emissions for carbon credits per year
  const emissions = calculateTotalEmissions(scenario, referenceData);
  const co2AvoidedPerYear = kgToTonnes(emissions.savings) / scenario.analysisYears;
  
  for (let year = 1; year <= scenario.analysisYears; year++) {
    const yearlyOpex = calculateOPEXByYear(scenario, referenceData, year);
    const discountFactor = Math.pow(1 + discountRate, year);
    const discountedOpex = yearlyOpex.total / discountFactor;
    
    // Calculate advanced costs for this specific year
    const yearlyAdvancedCosts = calculateAdvancedCostsByYear(
      scenario.fleetComposition,
      year,
      scenario.analysisYears,
      co2AvoidedPerYear,
      h2VehicleCount,
      h2Params
    );
    
    // Calculate total advanced costs for this year (excluding carbon credits which is revenue)
    const yearAdvancedCostTotal = 
      yearlyAdvancedCosts.downtime +
      yearlyAdvancedCosts.insurance +
      yearlyAdvancedCosts.telematics +
      yearlyAdvancedCosts.gridDemand +
      yearlyAdvancedCosts.fcStackReplacement;
    
    cumulativeCost += yearlyOpex.total + yearAdvancedCostTotal - yearlyAdvancedCosts.carbonCredits;
    totalOpex += yearlyOpex.total;
    pvOpex += discountedOpex;
    
    // Capture applied consumption from first year calculation
    if (year === 1 && yearlyOpex.appliedConsumption) {
      appliedConsumption = {
        diesel: yearlyOpex.appliedConsumption.diesel,
        bev: yearlyOpex.appliedConsumption.ev,
        h2: yearlyOpex.appliedConsumption.hydrogen,
      };
    }
    
    // Calculate yearly emissions
    const yearlyEmissions = calculateTotalEmissions({
      ...scenario,
      analysisYears: 1,
    }, referenceData);
    
    const yearTotalCost = year === 1 
      ? totalInitialInvestment + yearlyOpex.total + yearAdvancedCostTotal - yearlyAdvancedCosts.carbonCredits
      : yearlyOpex.total + yearAdvancedCostTotal - yearlyAdvancedCosts.carbonCredits;
    
    yearlyBreakdown.push({
      year,
      capex: year === 1 ? totalInitialInvestment : 0,
      opex: yearlyOpex.total,
      // Detailed OPEX breakdown for chart visualization
      // Insurance comes from advancedCosts (user form) for single source of truth
      opexBreakdown: {
        fuel: yearlyOpex.fuelCost,
        maintenance: yearlyOpex.maintenanceCost,
        insurance: yearlyAdvancedCosts.insurance,
      },
      // Advanced costs breakdown for detailed visualization
      advancedCosts: yearlyAdvancedCosts,
      totalCost: yearTotalCost,
      cumulativeCost,
      co2: kgToTonnes(yearlyEmissions.total),
      discountedCost: year === 1 ? totalInitialInvestment + discountedOpex : discountedOpex,
    });
  }
  
  // Calculate residual value using user-provided parameters if available
  const residualValue = calculateResidualValue(
    capex, 
    scenario.analysisYears,
    vehicleParams?.residualValuePercent,
    vehicleParams?.lifeYears
  );
  const pvResidual = residualValue / Math.pow(1 + discountRate, scenario.analysisYears);
  
  // Calculate total km over analysis period using effective fleet composition
  const effectiveFleet = getEffectiveFleetComposition(scenario);
  const totalKm = (
    effectiveFleet.diesel.count * effectiveFleet.diesel.annualKm +
    effectiveFleet.ev.count * effectiveFleet.ev.annualKm +
    effectiveFleet.hydrogen.count * effectiveFleet.hydrogen.annualKm
  ) * scenario.analysisYears;
  
  // Get base fuel costs for advanced calculations
  const baseOpex = calculateOPEXByYear(scenario, referenceData, 1);
  const baseFuelCosts = {
    diesel: baseOpex.byType.diesel.fuel * scenario.analysisYears,
    ev: baseOpex.byType.ev.fuel * scenario.analysisYears,
    hydrogen: baseOpex.byType.hydrogen.fuel * scenario.analysisYears,
  };
  
  // Calculate advanced operational costs (for totals)
  const advancedCosts = calculateAdvancedCosts(
    scenario.fleetComposition,
    scenario.analysisYears,
    baseFuelCosts,
    kgToTonnes(emissions.savings)
  );
  
  // Adjust total OPEX with advanced costs + FC stack replacement
  // Note: Cold weather impact is already included via consumption multipliers in opex.ts
  const advancedOpexAddition = 
    advancedCosts.downtimeCost +
    advancedCosts.insuranceCost +
    advancedCosts.telematicsCost +
    advancedCosts.gridDemandCost +
    fcStackReplacementCost;
  
  const adjustedTotalOpex = totalOpex + advancedOpexAddition;
  
  // TCO Total = CAPEX + PV(OPEX) - PV(Residual) + Infrastructure - Carbon Credits
  const tcoTotal = capex + pvOpex + advancedOpexAddition - pvResidual + effectiveInfraCost - advancedCosts.carbonCreditsValue;
  
  const tcoPerKm = totalKm > 0 ? tcoTotal / totalKm : 0;
  
  // Calculate NPV (treating all costs as negative cash flows)
  const cashFlows = yearlyBreakdown.map((y, i) => 
    i === 0 ? -(totalInitialInvestment + y.opex) : -y.opex
  );
  cashFlows.push(residualValue); // Add residual value at the end
  const npv = calculateNPV(cashFlows, discountRate);
  
  // Calculate payback period (comparing to diesel-only baseline)
  const totalVehicles = effectiveFleet.diesel.count + effectiveFleet.ev.count + effectiveFleet.hydrogen.count;
  const avgAnnualKm = totalVehicles > 0 ? (
    effectiveFleet.diesel.count * effectiveFleet.diesel.annualKm +
    effectiveFleet.ev.count * effectiveFleet.ev.annualKm +
    effectiveFleet.hydrogen.count * effectiveFleet.hydrogen.annualKm
  ) / totalVehicles : 0;
  
  const dieselOnlyScenario: Scenario = {
    ...scenario,
    fleetComposition: {
      diesel: {
        count: totalVehicles,
        annualKm: avgAnnualKm,
      },
      ev: { count: 0, annualKm: 0 },
      hydrogen: { count: 0, annualKm: 0 },
    },
  };
  const dieselOnlyOpex = calculateOPEXByYear(dieselOnlyScenario, referenceData, 1);
  const scenarioOpex = calculateOPEXByYear(scenario, referenceData, 1);
  const annualSavings = dieselOnlyOpex.total - scenarioOpex.total;
  
  const additionalCapex = capex + effectiveInfraCost - 
    (dieselOnlyScenario.fleetComposition.diesel.count * referenceData.diesel_truck);
  const paybackPeriodYears = calculatePaybackPeriod(Math.max(0, additionalCapex), annualSavings);
  
  // Calculate baseline TCO (diesel-only equivalent for comparison)
  const dieselCapex = totalVehicles * referenceData.diesel_truck;
  const dieselResidual = calculateResidualValue(dieselCapex, scenario.analysisYears);
  const pvDieselResidual = dieselResidual / Math.pow(1 + discountRate, scenario.analysisYears);
  
  // Get inflation rates from scenario (same as ZEV scenario uses)
  const energyInflationRate = scenario.fleetComposition.financialParams?.energyInflationRate 
    ? scenario.fleetComposition.financialParams.energyInflationRate / 100 
    : 0;
  const maintenanceInflationRate = scenario.fleetComposition.financialParams?.maintenanceInflationRate 
    ? scenario.fleetComposition.financialParams.maintenanceInflationRate / 100 
    : 0;
  
  // Calculate PV of diesel OPEX with inflation (consistent with ZEV scenario)
  let pvDieselOpex = 0;
  let nominalDieselOpex = 0;
  const dieselBaseFuel = dieselOnlyOpex.byType.diesel.fuel;
  const dieselBaseMaint = dieselOnlyOpex.byType.diesel.maintenance;
  
  for (let year = 1; year <= scenario.analysisYears; year++) {
    // Apply inflation like we do for the ZEV scenario
    const inflatedFuel = dieselBaseFuel * Math.pow(1 + energyInflationRate, year - 1);
    const inflatedMaint = dieselBaseMaint * Math.pow(1 + maintenanceInflationRate, year - 1);
    const yearlyInflatedOpex = inflatedFuel + inflatedMaint;
    
    nominalDieselOpex += yearlyInflatedOpex;
    const discountFactor = Math.pow(1 + discountRate, year);
    pvDieselOpex += yearlyInflatedOpex / discountFactor;
  }
  
  const baselineTco = dieselCapex + pvDieselOpex - pvDieselResidual;
  const tcoSavings = baselineTco - tcoTotal; // Positive = savings, Negative = extra cost
  
  // Build baseline breakdown for methodology transparency
  const baselineBreakdown = {
    capex: dieselCapex,
    opexNominal: nominalDieselOpex,
    opexPV: pvDieselOpex,
    residualNominal: dieselResidual,
    residualPV: pvDieselResidual,
    totalNominal: dieselCapex + nominalDieselOpex - dieselResidual,
    discountRate: discountRate * 100,
    inflationRate: energyInflationRate * 100,
  };
  
  // Build by vehicle type breakdown
  const byVehicleType = {
    diesel: {
      ...capexResult.byType.diesel,
      fuelCost: calculateOPEXByYear(scenario, referenceData, 1).byType.diesel.fuel * scenario.analysisYears,
      maintenanceCost: calculateOPEXByYear(scenario, referenceData, 1).byType.diesel.maintenance * scenario.analysisYears,
      insuranceCost: calculateOPEXByYear(scenario, referenceData, 1).byType.diesel.insurance * scenario.analysisYears,
      opex: (
        calculateOPEXByYear(scenario, referenceData, 1).byType.diesel.fuel +
        calculateOPEXByYear(scenario, referenceData, 1).byType.diesel.maintenance +
        calculateOPEXByYear(scenario, referenceData, 1).byType.diesel.insurance
      ) * scenario.analysisYears,
      co2: kgToTonnes(emissions.byType.diesel),
    },
    ev: {
      ...capexResult.byType.ev,
      fuelCost: calculateOPEXByYear(scenario, referenceData, 1).byType.ev.fuel * scenario.analysisYears,
      maintenanceCost: calculateOPEXByYear(scenario, referenceData, 1).byType.ev.maintenance * scenario.analysisYears,
      insuranceCost: calculateOPEXByYear(scenario, referenceData, 1).byType.ev.insurance * scenario.analysisYears,
      opex: (
        calculateOPEXByYear(scenario, referenceData, 1).byType.ev.fuel +
        calculateOPEXByYear(scenario, referenceData, 1).byType.ev.maintenance +
        calculateOPEXByYear(scenario, referenceData, 1).byType.ev.insurance
      ) * scenario.analysisYears,
      co2: kgToTonnes(emissions.byType.ev),
    },
    hydrogen: {
      ...capexResult.byType.hydrogen,
      fuelCost: calculateOPEXByYear(scenario, referenceData, 1).byType.hydrogen.fuel * scenario.analysisYears,
      maintenanceCost: calculateOPEXByYear(scenario, referenceData, 1).byType.hydrogen.maintenance * scenario.analysisYears,
      insuranceCost: calculateOPEXByYear(scenario, referenceData, 1).byType.hydrogen.insurance * scenario.analysisYears,
      opex: (
        calculateOPEXByYear(scenario, referenceData, 1).byType.hydrogen.fuel +
        calculateOPEXByYear(scenario, referenceData, 1).byType.hydrogen.maintenance +
        calculateOPEXByYear(scenario, referenceData, 1).byType.hydrogen.insurance
      ) * scenario.analysisYears,
      co2: kgToTonnes(emissions.byType.hydrogen),
    },
  };
  
  // Build active advanced params flags
  const consumptionOverrides = vehicleParams?.consumptionOverrides;
  const activeAdvancedParams: TCOResult['activeAdvancedParams'] = {
    customConsumption: !!(consumptionOverrides?.bev || consumptionOverrides?.h2 || consumptionOverrides?.biomethane || consumptionOverrides?.phev),
    fcStackReplacement: h2Params?.fcStackReplacementEnabled ?? false,
    h2Inflation: h2Params?.h2InflationEnabled ?? false,
    h2InfraScale: h2Params?.h2InfraScaleEnabled ?? false,
    customInfra: customInfraEnabled,
    touRates: !!(scenario.fleetComposition.energyCosts?.gridCharges?.touRates),
    carbonCredits: !!(scenario.fleetComposition.environmental?.carbonCredits?.enabled),
    coldWeather: false, // Cold weather impact is now handled via temperature multiplier in Section C
  };
  
  return {
    scenarioId: scenario.id,
    scenarioName: scenario.name,
    capex,
    opexTotal: adjustedTotalOpex,
    tcoTotal,
    tcoPerKm,
    npv,
    residualValue,
    paybackPeriodYears,
    // Baseline comparison for portfolio analytics
    baselineTco,
    tcoSavings,
    baselineBreakdown,
    // Emissions
    co2Total: kgToTonnes(emissions.total),
    co2Savings: kgToTonnes(emissions.savings),
    co2SavingsPercent: emissions.savingsPercent,
    chargingStations: infrastructure.chargingStations,
    chargingStationsCost: infrastructure.chargingStationsCost,
    h2Stations: infrastructure.h2Stations,
    h2StationsCost: infrastructure.h2StationsCost,
    totalInfrastructureCost: effectiveInfraCost,
    yearlyBreakdown,
    byVehicleType,
    // Advanced cost breakdowns
    downtimeCost: advancedCosts.downtimeCost,
    insuranceCost: advancedCosts.insuranceCost,
    telematicsCost: advancedCosts.telematicsCost,
    gridDemandCost: advancedCosts.gridDemandCost,
    carbonCreditsValue: advancedCosts.carbonCreditsValue,
    coldWeatherImpact: 0, // Cold weather impact is handled via consumption multipliers
    // Hydrogen-specific costs
    fcStackReplacementCost,
    h2InfraScaleDiscount,
    // Applied parameters for transparency
    appliedConsumption,
    activeAdvancedParams,
    // Applied energy prices for What-If synchronization
    appliedPrices: {
      diesel: referenceData.diesel_price,
      electricity: referenceData.electricity_price,
      hydrogen: referenceData.hydrogen_price,
    },
  };
}

/**
 * Compare scenario TCO with diesel-only baseline
 */
export function compareWithBaseline(
  scenario: Scenario,
  referenceData: ReferenceData
): { scenarioTCO: TCOResult; baselineTCO: TCOResult; difference: number; savingsPercent: number } {
  const scenarioTCO = calculateTCO(scenario, referenceData);
  
  // Create diesel-only baseline
  const { fleetComposition } = scenario;
  const totalVehicles = fleetComposition.diesel.count + fleetComposition.ev.count + fleetComposition.hydrogen.count;
  const avgAnnualKm = totalVehicles > 0 ? (
    fleetComposition.diesel.count * fleetComposition.diesel.annualKm +
    fleetComposition.ev.count * fleetComposition.ev.annualKm +
    fleetComposition.hydrogen.count * fleetComposition.hydrogen.annualKm
  ) / totalVehicles : 0;
  
  const baselineScenario: Scenario = {
    ...scenario,
    id: 'baseline',
    name: 'Diesel Only Baseline',
    fleetComposition: {
      diesel: { count: totalVehicles, annualKm: avgAnnualKm },
      ev: { count: 0, annualKm: 0 },
      hydrogen: { count: 0, annualKm: 0 },
    },
  };
  
  const baselineTCO = calculateTCO(baselineScenario, referenceData);
  const difference = scenarioTCO.tcoTotal - baselineTCO.tcoTotal;
  const savingsPercent = baselineTCO.tcoTotal > 0 
    ? ((baselineTCO.tcoTotal - scenarioTCO.tcoTotal) / baselineTCO.tcoTotal) * 100 
    : 0;
  
  return {
    scenarioTCO,
    baselineTCO,
    difference,
    savingsPercent,
  };
}
