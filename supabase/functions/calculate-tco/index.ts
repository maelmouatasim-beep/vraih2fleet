// calculate-tco — sécurité :
// - JWT obligatoire (getUserOrThrow) ;
// - toutes les lectures/écritures passent par le client RLS de l'utilisateur
//   (plus de service role) : un scenarioId d'autrui renvoie 404 ;
// - region validée contre une liste fermée avant toute utilisation dans un
//   filtre PostgREST.
import { handleOptions, jsonResponse } from "../_shared/cors.ts";
import { getUserOrThrow, HttpError } from "../_shared/auth.ts";

const ALLOWED_REGIONS = new Set([
  'Global', 'Canada', 'CA',
  'CA_QC', 'CA_ON', 'CA_BC', 'CA_AB', 'CA_MB',
]);

// Consumption factors - standardized to per 100km
const L_PER_100KM_DIESEL = 35.7;        // L/100km for Class 8 trucks
const KWH_PER_100KM_EV = 120;           // kWh/100km for Class 8 trucks
const KG_H2_PER_100KM = 8;              // kg/100km for fuel cell trucks
const KG_BIOMETHANE_PER_100KM = 28;     // kg/100km for biomethane trucks
const KG_CO2_PER_LITER_DIESEL = 2.68;   // Standard diesel emission factor
const KG_CO2_PER_KG_H2_BLUE = 3.0;      // Blue hydrogen

// Infrastructure calculation helpers
const EV_AUTONOMY_KM = 500;
const H2_AUTONOMY_KM = 350;
const CHARGES_PER_STATION_PER_DAY = 3;
const FILLS_PER_H2_STATION_PER_DAY = 30;
const DAYS_PER_YEAR = 365;

interface VehicleParams {
  residualValuePercent?: number;
  lifeYears?: number;
  infrastructureCostTotal?: number;
  consumptionOverrides?: {
    bev?: number;
    h2?: number;
    biomethane?: number;
  };
  h2Params?: {
    fcStackReplacementEnabled?: boolean;
    fcStackReplacementCost?: number;
    fcStackLifespanYears?: number;
    h2InflationEnabled?: boolean;
    h2InflationRate?: number;
    h2InfraScaleEnabled?: boolean;
    h2InfraScaleFactor?: number;
  };
  customInfraEnabled?: boolean;
  customInfraCostPerVehicle?: number;
}

interface FleetComposition {
  diesel: { count: number; annualKm: number };
  ev: { count: number; annualKm: number };
  hydrogen: { count: number; annualKm: number };
  financialParams?: {
    energyInflationRate?: number;
    maintenanceInflationRate?: number;
  };
  energyCosts?: {
    gridCharges?: {
      demandCharge?: number;
      touRates?: {
        offPeak: number;
        midPeak: number;
        onPeak: number;
        offPeakPercentage: number;
      };
    };
  };
  operationalCosts?: {
    downtime?: { hoursPerYear: number; costPerHour: number };
    insurance?: { evPremium: number; h2Premium: number; dieselBaseline: number };
    telematics?: { costPerVehiclePerMonth: number; provider: string };
  };
  environmental?: {
    carbonCredits?: { enabled: boolean; pricePerTonne: number };
    coldWeather?: { enabled: boolean; averageDeratingPercent: number; winterMonths: number };
  };
  vehicleParams?: VehicleParams;
}

interface Scenario {
  id: string;
  project_id: string;
  name: string;
  region: string;
  analysis_years: number;
  discount_rate: number;
  fleet_composition: FleetComposition;
}

interface ReferenceData {
  diesel_truck: number;
  ev_truck: number;
  hydrogen_truck: number;
  diesel_price: number;
  electricity_price: number;
  hydrogen_price: number;
  co2_factor_diesel: number;
  co2_factor_grid: number;
  maintenance_diesel: number;
  maintenance_ev: number;
  maintenance_hydrogen: number;
}

/**
 * Apply inflation factor (supports negative rates)
 */
function applyInflation(basePrice: number, inflationRate: number, year: number): number {
  if (year <= 1) return basePrice;
  return basePrice * Math.pow(1 + inflationRate, year - 1);
}

/**
 * Calculate effective electricity price with TOU rates
 */
function calculateEffectiveElectricityPrice(
  basePrice: number,
  touRates?: { offPeak: number; onPeak: number; offPeakPercentage: number }
): number {
  if (!touRates || !touRates.offPeak || !touRates.onPeak) {
    return basePrice;
  }
  const onPeakPercent = 100 - touRates.offPeakPercentage;
  return (touRates.offPeak * touRates.offPeakPercentage + touRates.onPeak * onPeakPercent) / 100;
}

/**
 * Calculate dynamic residual value
 */
function calculateResidualValue(
  capex: number, 
  analysisYears: number,
  residualValuePercent?: number,
  lifeYears?: number
): number {
  if (residualValuePercent !== undefined) {
    return capex * (residualValuePercent / 100);
  }
  const yearsToFullDepreciation = lifeYears ?? 12;
  const minResidualPercent = 0.10;
  const depreciationPercent = Math.min(analysisYears / yearsToFullDepreciation, 0.90);
  const residualPercent = Math.max(minResidualPercent, 1 - depreciationPercent);
  return capex * residualPercent;
}

/**
 * Calculate FC stack replacement cost
 */
function calculateFCStackReplacementCost(
  h2VehicleCount: number,
  analysisYears: number,
  h2Params?: VehicleParams['h2Params']
): number {
  if (!h2Params?.fcStackReplacementEnabled || h2VehicleCount === 0) {
    return 0;
  }
  const replacementCost = h2Params.fcStackReplacementCost ?? 50000;
  const lifespanYears = h2Params.fcStackLifespanYears ?? 8;
  const replacements = Math.floor(analysisYears / lifespanYears);
  return replacements * replacementCost * h2VehicleCount;
}

/**
 * Calculate H2 infrastructure scale discount
 */
function calculateH2InfraScaleDiscount(
  h2VehicleCount: number,
  baseInfraCost: number,
  h2Params?: VehicleParams['h2Params']
): number {
  const H2_SCALE_THRESHOLD = 20;
  if (!h2Params?.h2InfraScaleEnabled || h2VehicleCount < H2_SCALE_THRESHOLD) {
    return 0;
  }
  const scaleFactor = (h2Params.h2InfraScaleFactor ?? 15) / 100;
  return baseInfraCost * scaleFactor;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return handleOptions(req);
  }

  try {
    // Le client Supabase porte le JWT de l'appelant : la RLS s'applique.
    const { supabase } = await getUserOrThrow(req);

    const { scenarioId } = await req.json();
    
    if (!scenarioId || typeof scenarioId !== 'string') {
      throw new HttpError(400, 'scenarioId is required');
    }

    // Fetch scenario (RLS : introuvable si le scénario n'est pas à l'appelant)
    const { data: scenario, error: scenarioError } = await supabase
      .from('scenarios')
      .select('*')
      .eq('id', scenarioId)
      .maybeSingle();

    if (scenarioError || !scenario) {
      throw new HttpError(404, 'Scenario not found');
    }

    // region : liste fermée uniquement (jamais interpolée telle quelle)
    const region = ALLOWED_REGIONS.has(scenario.region) ? scenario.region : 'Canada';

    // Fetch reference data
    const { data: refDataRows, error: refError } = await supabase
      .from('reference_data_ranges')
      .select('category, subcategory, region, mid_value')
      .in('region', [region, 'Global']);

    if (refError) {
      console.error('Reference data fetch error:', refError.message);
    }

    const referenceData = buildReferenceData(refDataRows || [], region);
    // Reference data loaded

    // Calculate TCO
    const result = calculateTCO(scenario as Scenario, referenceData);
    // TCO calculation completed

    // Save results
    const { data: savedResult, error: saveError } = await supabase
      .from('tco_results')
      .insert({
        scenario_id: scenarioId,
        ...result,
      })
      .select('id')
      .single();

    if (saveError) {
      console.error('Error saving TCO result:', saveError);
      throw new Error(`Failed to save results: ${saveError.message}`);
    }

    // TCO result saved

    return jsonResponse(req, { 
      success: true, 
      resultId: savedResult.id,
      result 
    });
  } catch (error: unknown) {
    if (error instanceof HttpError) {
      return jsonResponse(req, { success: false, error: error.message }, error.status);
    }
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in calculate-tco function:', errorMessage);
    return jsonResponse(req, { error: errorMessage, success: false }, 500);
  }
});

function buildReferenceData(rows: any[], region: string): ReferenceData {
  const result: ReferenceData = {
    diesel_truck: 150000,
    ev_truck: 280000,
    hydrogen_truck: 350000,
    diesel_price: 1.48,
    electricity_price: 0.12,
    hydrogen_price: 12.00,
    co2_factor_diesel: 2.68,
    co2_factor_grid: 120,
    maintenance_diesel: 15000,
    maintenance_ev: 8000,
    maintenance_hydrogen: 10000,
  };

  const findValue = (category: string, subcategory: string): number | null => {
    const matches = rows.filter(r => 
      r.category === category && 
      r.subcategory.toLowerCase().includes(subcategory.toLowerCase())
    );
    if (matches.length === 0) return null;
    const specific = matches.find(m => m.region === region);
    return specific ? specific.mid_value : matches[0].mid_value;
  };

  const dieselPrice = findValue('fuel_prices', 'diesel');
  if (dieselPrice !== null) result.diesel_price = dieselPrice;

  const electricityPrice = findValue('electricity_prices', 'electricity');
  if (electricityPrice !== null) result.electricity_price = electricityPrice;

  const hydrogenPrice = findValue('hydrogen_prices', 'hydrogen');
  if (hydrogenPrice !== null) result.hydrogen_price = hydrogenPrice;

  const dieselTruck = findValue('vehicle_costs', 'diesel');
  if (dieselTruck !== null) result.diesel_truck = dieselTruck;

  const evTruck = findValue('vehicle_costs', 'electric');
  if (evTruck !== null) result.ev_truck = evTruck;

  const h2Truck = findValue('vehicle_costs', 'hydrogen');
  if (h2Truck !== null) result.hydrogen_truck = h2Truck;

  return result;
}

function calculateTCO(scenario: Scenario, ref: ReferenceData) {
  const fleet = scenario.fleet_composition;
  const discountRate = scenario.discount_rate / 100;
  const years = scenario.analysis_years;
  const vehicleParams = fleet.vehicleParams;

  // SAFE DEFAULTS: Handle undefined/null values to prevent NaN
  const dieselCount = fleet.diesel?.count ?? 0;
  const dieselAnnualKm = fleet.diesel?.annualKm ?? 0;
  const evCount = fleet.ev?.count ?? 0;
  const evAnnualKm = fleet.ev?.annualKm ?? 0;
  const h2Count = fleet.hydrogen?.count ?? 0;
  const h2AnnualKm = fleet.hydrogen?.annualKm ?? 0;

  const totalVehicles = dieselCount + evCount + h2Count;

  // Validation: scenario must have at least one vehicle
  if (totalVehicles === 0) {
    console.warn('Scenario has no vehicles, returning zero TCO');
    return {
      capex: 0,
      opex_total: 0,
      tco_total: 0,
      tco_per_km: 0,
      npv: 0,
      residual_value: 0,
      payback_period_years: null,
      co2_total: 0,
      co2_savings: 0,
      co2_savings_percent: 0,
      baseline_tco: 0,
      tco_savings: 0,
      charging_stations: 0,
      charging_stations_cost: 0,
      h2_stations: 0,
      h2_stations_cost: 0,
      total_infrastructure_cost: 0,
      downtime_cost: 0,
      insurance_cost: 0,
      telematics_cost: 0,
      grid_demand_cost: 0,
      carbon_credits_value: 0,
      cold_weather_impact: 0,
      yearly_breakdown: [],
      by_vehicle_type: {
        diesel: { count: 0, capex: 0, co2: 0 },
        ev: { count: 0, capex: 0, co2: 0 },
        hydrogen: { count: 0, capex: 0, co2: 0 },
      },
    };
  }

  // Extract inflation rates
  const energyInflationRate = (fleet.financialParams?.energyInflationRate ?? 0) / 100;
  const maintenanceInflationRate = (fleet.financialParams?.maintenanceInflationRate ?? 0) / 100;
  
  // H2 can have its own inflation rate (supports negative for price decrease)
  const h2Params = vehicleParams?.h2Params;
  const h2InflationEnabled = h2Params?.h2InflationEnabled ?? false;
  const h2InflationRate = h2InflationEnabled && h2Params?.h2InflationRate !== undefined
    ? h2Params.h2InflationRate / 100
    : energyInflationRate;

  // Get consumption overrides
  const consumptionOverrides = vehicleParams?.consumptionOverrides;
  const bevConsumption = consumptionOverrides?.bev ?? KWH_PER_100KM_EV;
  const h2Consumption = consumptionOverrides?.h2 ?? KG_H2_PER_100KM;

  // Calculate effective electricity price with TOU
  const touConfig = fleet.energyCosts?.gridCharges?.touRates;
  const effectiveElectricityPrice = touConfig
    ? calculateEffectiveElectricityPrice(ref.electricity_price, {
        offPeak: touConfig.offPeak,
        onPeak: touConfig.onPeak,
        offPeakPercentage: touConfig.offPeakPercentage,
      })
    : ref.electricity_price;

  // CAPEX with safe values
  const capex = 
    dieselCount * ref.diesel_truck +
    evCount * ref.ev_truck +
    h2Count * ref.hydrogen_truck;

  // Calculate annual OPEX with inflation and consumption overrides
  const calculateAnnualOpex = (year: number) => {
    const dieselKm = dieselCount * dieselAnnualKm;
    const evKm = evCount * evAnnualKm;
    const h2Km = h2Count * h2AnnualKm;

    // Apply inflation to prices
    const yearDieselPrice = applyInflation(ref.diesel_price, energyInflationRate, year);
    const yearElectricityPrice = applyInflation(effectiveElectricityPrice, energyInflationRate, year);
    // H2 uses its own inflation rate
    const yearH2Price = applyInflation(ref.hydrogen_price, h2InflationRate, year);

    // Fuel costs with consumption overrides (per 100km)
    const dieselFuel = ((dieselKm / 100) * L_PER_100KM_DIESEL) * yearDieselPrice;
    const evFuel = ((evKm / 100) * bevConsumption) * yearElectricityPrice;
    const h2Fuel = ((h2Km / 100) * h2Consumption) * yearH2Price;

    // Maintenance with inflation
    const yearMaintDiesel = applyInflation(ref.maintenance_diesel, maintenanceInflationRate, year);
    const yearMaintEv = applyInflation(ref.maintenance_ev, maintenanceInflationRate, year);
    const yearMaintH2 = applyInflation(ref.maintenance_hydrogen, maintenanceInflationRate, year);

    const dieselMaint = dieselCount * yearMaintDiesel;
    const evMaint = evCount * yearMaintEv;
    const h2Maint = h2Count * yearMaintH2;

    const dieselInsurance = dieselCount * ref.diesel_truck * 0.01;
    const evInsurance = evCount * ref.ev_truck * 0.01;
    const h2Insurance = h2Count * ref.hydrogen_truck * 0.01;

    return {
      fuel: dieselFuel + evFuel + h2Fuel,
      maintenance: dieselMaint + evMaint + h2Maint,
      insurance: dieselInsurance + evInsurance + h2Insurance,
      total: dieselFuel + evFuel + h2Fuel + dieselMaint + evMaint + h2Maint + dieselInsurance + evInsurance + h2Insurance,
    };
  };

  let opexTotal = 0;
  let pvOpex = 0;
  const yearlyBreakdown = [];
  let cumulativeCost = capex;

  for (let year = 1; year <= years; year++) {
    const annualOpex = calculateAnnualOpex(year);
    const discountFactor = Math.pow(1 + discountRate, year);
    opexTotal += annualOpex.total;
    pvOpex += annualOpex.total / discountFactor;
    cumulativeCost += annualOpex.total;

    yearlyBreakdown.push({
      year,
      capex: year === 1 ? capex : 0,
      opex: annualOpex.total,
      totalCost: year === 1 ? capex + annualOpex.total : annualOpex.total,
      cumulativeCost,
      discountedCost: year === 1 ? capex + annualOpex.total / discountFactor : annualOpex.total / discountFactor,
    });
  }

  // FC Stack replacement cost
  const fcStackReplacementCost = calculateFCStackReplacementCost(
    h2Count,
    years,
    h2Params
  );

  // Advanced costs
  let downtimeCost = 0;
  let insuranceCost = 0;
  let telematicsCost = 0;
  let gridDemandCost = 0;
  let carbonCreditsValue = 0;
  let coldWeatherImpact = 0;

  const ops = fleet.operationalCosts;
  if (ops?.downtime) {
    downtimeCost = ops.downtime.hoursPerYear * ops.downtime.costPerHour * totalVehicles * years;
  }
  if (ops?.insurance) {
    const dieselIns = dieselCount * ops.insurance.dieselBaseline * years;
    const evIns = evCount * (ops.insurance.dieselBaseline + ops.insurance.evPremium) * years;
    const h2Ins = h2Count * (ops.insurance.dieselBaseline + ops.insurance.h2Premium) * years;
    insuranceCost = dieselIns + evIns + h2Ins;
  }
  if (ops?.telematics && ops.telematics.provider !== 'none') {
    telematicsCost = ops.telematics.costPerVehiclePerMonth * 12 * totalVehicles * years;
  }

  const energyCosts = fleet.energyCosts;
  if (energyCosts?.gridCharges?.demandCharge && evCount > 0) {
    const estimatedPeakPowerKW = evCount * 50;
    gridDemandCost = energyCosts.gridCharges.demandCharge * estimatedPeakPowerKW * 12 * years;
  }

  // Calculate CO2 with safe values
  const dieselCO2 = dieselAnnualKm > 0 
    ? ((dieselCount * dieselAnnualKm / 100) * L_PER_100KM_DIESEL) * KG_CO2_PER_LITER_DIESEL * years
    : 0;
  const evCO2 = evAnnualKm > 0
    ? ((evCount * evAnnualKm / 100) * bevConsumption / 1000) * ref.co2_factor_grid * years
    : 0;
  const h2CO2 = h2AnnualKm > 0
    ? ((h2Count * h2AnnualKm / 100) * h2Consumption) * KG_CO2_PER_KG_H2_BLUE * years
    : 0;
  const totalCO2Kg = dieselCO2 + evCO2 + h2CO2;
  const totalCO2 = totalCO2Kg / 1000;

  // Baseline (all diesel) with safe values
  const totalKm = (
    dieselCount * dieselAnnualKm +
    evCount * evAnnualKm +
    h2Count * h2AnnualKm
  ) * years;
  const avgKmPerVehicle = totalVehicles > 0 ? totalKm / years / totalVehicles : 0;
  const baselineCO2Kg = ((totalVehicles * avgKmPerVehicle / 100) * L_PER_100KM_DIESEL) * KG_CO2_PER_LITER_DIESEL * years;
  const baselineCO2 = baselineCO2Kg / 1000;
  const co2Savings = baselineCO2 - totalCO2;
  const co2SavingsPercent = baselineCO2 > 0 ? (co2Savings / baselineCO2) * 100 : 0;

  const env = fleet.environmental;
  if (env?.carbonCredits?.enabled && co2Savings > 0) {
    carbonCreditsValue = co2Savings * env.carbonCredits.pricePerTonne;
  }

  if (env?.coldWeather?.enabled && evCount > 0) {
    const winterFraction = env.coldWeather.winterMonths / 12;
    const consumptionIncrease = env.coldWeather.averageDeratingPercent / 100;
    const evFraction = totalVehicles > 0 ? evCount / totalVehicles : 0;
    const baseEvFuel = calculateAnnualOpex(1).fuel * evFraction;
    coldWeatherImpact = baseEvFuel * consumptionIncrease * winterFraction * years;
  }

  const advancedOpex = downtimeCost + insuranceCost + telematicsCost + gridDemandCost + coldWeatherImpact + fcStackReplacementCost;

  // Residual value with user params
  const residualValue = calculateResidualValue(
    capex, 
    years,
    vehicleParams?.residualValuePercent,
    vehicleParams?.lifeYears
  );
  const pvResidual = residualValue / Math.pow(1 + discountRate, years);

  // Infrastructure with safe values
  const evKmPerYear = evCount * evAnnualKm;
  const dailyEvCharges = evKmPerYear > 0 ? (evKmPerYear / EV_AUTONOMY_KM) / DAYS_PER_YEAR : 0;
  const chargingStations = Math.ceil(dailyEvCharges / CHARGES_PER_STATION_PER_DAY) || 0;

  const h2KmPerYear = h2Count * h2AnnualKm;
  const dailyH2Fills = h2KmPerYear > 0 ? (h2KmPerYear / H2_AUTONOMY_KM) / DAYS_PER_YEAR : 0;
  const h2Stations = Math.ceil(dailyH2Fills / FILLS_PER_H2_STATION_PER_DAY) || 0;

  // Calculate H2 infra scale discount
  const h2InfraScaleDiscount = calculateH2InfraScaleDiscount(
    h2Count,
    0, // Base infra cost (0 since we're not calculating infra costs by default)
    h2Params
  );

  // Determine effective infrastructure cost
  let effectiveInfraCost = 0;
  if (vehicleParams?.customInfraEnabled && vehicleParams.customInfraCostPerVehicle) {
    effectiveInfraCost = vehicleParams.customInfraCostPerVehicle * totalVehicles;
  } else if (vehicleParams?.infrastructureCostTotal) {
    effectiveInfraCost = vehicleParams.infrastructureCostTotal;
  }
  effectiveInfraCost = Math.max(0, effectiveInfraCost - h2InfraScaleDiscount);

  // TCO Total
  const tcoTotal = capex + pvOpex + advancedOpex - pvResidual + effectiveInfraCost - carbonCreditsValue;
  const tcoPerKm = totalKm > 0 ? tcoTotal / totalKm : 0;
  const npv = -tcoTotal;

  // Baseline TCO
  const baselineCapex = totalVehicles * ref.diesel_truck;
  let baselinePvOpex = 0;
  for (let year = 1; year <= years; year++) {
    const yearDieselPrice = applyInflation(ref.diesel_price, energyInflationRate, year);
    const yearMaintDiesel = applyInflation(ref.maintenance_diesel, maintenanceInflationRate, year);
    const dieselKm = totalVehicles * avgKmPerVehicle;
    const dieselFuel = ((dieselKm / 100) * L_PER_100KM_DIESEL) * yearDieselPrice;
    const dieselMaint = totalVehicles * yearMaintDiesel;
    const dieselInsurance = totalVehicles * ref.diesel_truck * 0.01;
    const yearOpex = dieselFuel + dieselMaint + dieselInsurance;
    const discountFactor = Math.pow(1 + discountRate, year);
    baselinePvOpex += yearOpex / discountFactor;
  }
  const baselineResidual = calculateResidualValue(baselineCapex, years);
  const pvBaselineResidual = baselineResidual / Math.pow(1 + discountRate, years);
  const baselineTco = baselineCapex + baselinePvOpex - pvBaselineResidual;
  const tcoSavings = baselineTco - tcoTotal;

  // Payback period
  const additionalCapex = capex + effectiveInfraCost - baselineCapex;
  const annualSavingsOpex = baselinePvOpex / years - (pvOpex / years);
  const paybackPeriodYears = annualSavingsOpex > 0 && additionalCapex > 0 
    ? Math.min(additionalCapex / annualSavingsOpex, 30) 
    : null;

  // Ensure no NaN values in return - apply fallback to 0
  const safeNumber = (val: number) => (Number.isFinite(val) ? val : 0);

  return {
    capex: safeNumber(capex),
    opex_total: safeNumber(opexTotal + advancedOpex),
    tco_total: safeNumber(tcoTotal),
    tco_per_km: safeNumber(tcoPerKm),
    npv: safeNumber(npv),
    residual_value: safeNumber(residualValue),
    payback_period_years: paybackPeriodYears !== null ? safeNumber(paybackPeriodYears) : null,
    co2_total: safeNumber(totalCO2),
    co2_savings: safeNumber(co2Savings),
    co2_savings_percent: safeNumber(co2SavingsPercent),
    baseline_tco: safeNumber(baselineTco),
    tco_savings: safeNumber(tcoSavings),
    charging_stations: chargingStations,
    charging_stations_cost: 0,
    h2_stations: h2Stations,
    h2_stations_cost: 0,
    total_infrastructure_cost: safeNumber(effectiveInfraCost),
    downtime_cost: safeNumber(downtimeCost),
    insurance_cost: safeNumber(insuranceCost),
    telematics_cost: safeNumber(telematicsCost),
    grid_demand_cost: safeNumber(gridDemandCost),
    carbon_credits_value: safeNumber(carbonCreditsValue),
    cold_weather_impact: safeNumber(coldWeatherImpact),
    yearly_breakdown: yearlyBreakdown,
    by_vehicle_type: {
      diesel: {
        count: dieselCount,
        capex: safeNumber(dieselCount * ref.diesel_truck),
        co2: safeNumber(dieselCO2 / 1000),
      },
      ev: {
        count: evCount,
        capex: safeNumber(evCount * ref.ev_truck),
        co2: safeNumber(evCO2 / 1000),
      },
      hydrogen: {
        count: h2Count,
        capex: safeNumber(h2Count * ref.hydrogen_truck),
        co2: safeNumber(h2CO2 / 1000),
      },
    },
  };
}
