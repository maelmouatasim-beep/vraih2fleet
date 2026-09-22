import { useMemo, useState } from "react";
import { TransitionScenario } from "@/hooks/useEnhancedAnalytics";
import { useCustomPricing } from "@/hooks/useCustomPricing";

export interface RiskParameter {
  id: string;
  label: string;
  labelKey: string;
  fuelType: 'diesel' | 'electricity' | 'hydrogen' | null;
  baseValue: number;
  unit: string;
  // Calculated automatically from real data
  impactPercent: number;
  impactDirection: 'favorable' | 'unfavorable';
  riskRank: number;
  // For interactive sliders
  currentVariation: number;
  // For tornado chart
  positiveImpact: number;
  negativeImpact: number;
}

export interface RiskAnalysisResult {
  parameters: RiskParameter[];
  adjustedTco: number;
  tcoChange: number;
  tcoChangePercent: number;
  adjustedPayback: number;
  paybackChange: number;
  isFavorable: boolean;
  mostCriticalRisk: RiskParameter | null;
  riskLevel: 'low' | 'medium' | 'high';
  dataSource: 'scenario' | 'portfolio' | 'defaults';
  scenarioCount: number;
}

interface UseRiskAnalysisProps {
  scenarios: TransitionScenario[];
  baseTcoTotal: number;
  basePaybackYears: number;
  scenarioPrices?: {
    diesel: number;
    electricity: number;
    hydrogen: number;
    avgAnnualKm: number;
    avgVehicleCost: number;
    avgSubsidyPerVehicle: number;
    source: 'scenario' | 'portfolio';
    scenarioCount: number;
    activeFuelTypes: ('diesel' | 'electricity' | 'hydrogen')[];
  };
}

export function useRiskAnalysis({ 
  scenarios, 
  baseTcoTotal, 
  basePaybackYears, 
  scenarioPrices 
}: UseRiskAnalysisProps): {
  result: RiskAnalysisResult;
  variations: Record<string, number>;
  setVariation: (id: string, value: number) => void;
  applyPreset: (presetId: string) => void;
  resetAll: () => void;
  hasAnyVariation: boolean;
} {
  const customPricing = useCustomPricing();
  
  // State for slider variations
  const [variations, setVariations] = useState<Record<string, number>>({
    diesel: 0,
    electricity: 0,
    hydrogen: 0,
    vehicleCost: 0,
    subsidy: 0,
    annualKm: 0,
  });

  // Determine active fuel types
  const activeFuelTypes = useMemo(() => {
    return scenarioPrices?.activeFuelTypes || ['diesel', 'electricity', 'hydrogen'];
  }, [scenarioPrices?.activeFuelTypes]);

  // Determine effective base values from scenarios or defaults
  const effectivePrices = useMemo(() => {
    if (scenarioPrices) {
      return {
        diesel: scenarioPrices.diesel > 0 ? scenarioPrices.diesel : customPricing.dieselPrice,
        electricity: scenarioPrices.electricity > 0 ? scenarioPrices.electricity : customPricing.electricityPrice,
        hydrogen: scenarioPrices.hydrogen > 0 ? scenarioPrices.hydrogen : customPricing.h2Price,
        annualKm: scenarioPrices.avgAnnualKm || 50000,
        vehicleCost: scenarioPrices.avgVehicleCost || 380000,
        subsidyPerVehicle: scenarioPrices.avgSubsidyPerVehicle || 100000,
        source: scenarioPrices.source,
        scenarioCount: scenarioPrices.scenarioCount,
      };
    }
    return {
      diesel: customPricing.dieselPrice,
      electricity: customPricing.electricityPrice,
      hydrogen: customPricing.h2Price,
      annualKm: 50000,
      vehicleCost: 380000,
      subsidyPerVehicle: 100000,
      source: 'defaults' as const,
      scenarioCount: 0,
    };
  }, [scenarioPrices, customPricing]);

  // Calculate real cost shares based on scenarios
  const costShares = useMemo(() => {
    // Estimate cost shares based on fleet composition
    let dieselShare = 0;
    let electricityShare = 0;
    let hydrogenShare = 0;
    let vehicleCapexShare = 0;
    let subsidyShare = 0;
    let kmShare = 0;
    
    let totalVehicles = 0;
    let dieselVehicles = 0;
    let evVehicles = 0;
    let h2Vehicles = 0;
    
    scenarios.forEach(s => {
      dieselVehicles += Math.round((s.dieselPercent / 100) * 10); // Approximate
      evVehicles += Math.round((s.bevPercent / 100) * 10);
      h2Vehicles += Math.round((s.fcevPercent / 100) * 10);
    });
    
    totalVehicles = dieselVehicles + evVehicles + h2Vehicles;
    
    if (totalVehicles > 0) {
      // Diesel typically represents 30-40% of opex (fuel heavy)
      dieselShare = activeFuelTypes.includes('diesel') ? 0.30 * (dieselVehicles / totalVehicles) : 0;
      // Electricity typically 20-25% of opex
      electricityShare = activeFuelTypes.includes('electricity') ? 0.25 * (evVehicles / totalVehicles) : 0;
      // Hydrogen typically 20-30% of opex  
      hydrogenShare = activeFuelTypes.includes('hydrogen') ? 0.20 * (h2Vehicles / totalVehicles) : 0;
      // Vehicle CAPEX is significant ~35% of total TCO
      vehicleCapexShare = 0.15;
      // Subsidies reduce TCO by ~10-15%
      subsidyShare = 0.10;
      // Km affects opex ~20%
      kmShare = 0.20;
    } else {
      // Default shares when no specific data
      dieselShare = activeFuelTypes.includes('diesel') ? 0.30 : 0;
      electricityShare = activeFuelTypes.includes('electricity') ? 0.25 : 0;
      hydrogenShare = activeFuelTypes.includes('hydrogen') ? 0.20 : 0;
      vehicleCapexShare = 0.15;
      subsidyShare = 0.10;
      kmShare = 0.20;
    }
    
    return { dieselShare, electricityShare, hydrogenShare, vehicleCapexShare, subsidyShare, kmShare };
  }, [scenarios, activeFuelTypes]);

  // Generate risk parameters with real impacts
  const parameters = useMemo((): RiskParameter[] => {
    const variationRange = 20; // ±20% for sensitivity
    
    const params: RiskParameter[] = [];
    
    // Diesel
    if (activeFuelTypes.includes('diesel')) {
      const dieselImpact = Math.round(costShares.dieselShare * variationRange * 100) / 100;
      params.push({
        id: 'diesel',
        label: 'Prix Diesel',
        labelKey: 'analytics.risk.dieselPrice',
        fuelType: 'diesel',
        baseValue: effectivePrices.diesel,
        unit: '$/L',
        impactPercent: dieselImpact,
        impactDirection: 'unfavorable', // Price increase is bad for ZE transition (makes diesel more expensive = favorable for ZE)
        riskRank: 0,
        currentVariation: variations.diesel,
        positiveImpact: dieselImpact, // +20% diesel price = +X% TCO impact for diesel fleet
        negativeImpact: -dieselImpact * 0.6, // -20% diesel = favorable for diesel (bad for ZE economics)
      });
    }
    
    // Electricity
    if (activeFuelTypes.includes('electricity')) {
      const electricityImpact = Math.round(costShares.electricityShare * variationRange * 100) / 100;
      params.push({
        id: 'electricity',
        label: 'Prix Électricité',
        labelKey: 'analytics.risk.electricityPrice',
        fuelType: 'electricity',
        baseValue: effectivePrices.electricity,
        unit: '$/kWh',
        impactPercent: electricityImpact,
        impactDirection: 'unfavorable',
        riskRank: 0,
        currentVariation: variations.electricity,
        positiveImpact: electricityImpact,
        negativeImpact: -electricityImpact * 0.8,
      });
    }
    
    // Hydrogen
    if (activeFuelTypes.includes('hydrogen')) {
      const hydrogenImpact = Math.round(costShares.hydrogenShare * variationRange * 100) / 100;
      params.push({
        id: 'hydrogen',
        label: 'Prix Hydrogène',
        labelKey: 'analytics.risk.hydrogenPrice',
        fuelType: 'hydrogen',
        baseValue: effectivePrices.hydrogen,
        unit: '$/kg',
        impactPercent: hydrogenImpact,
        impactDirection: 'unfavorable',
        riskRank: 0,
        currentVariation: variations.hydrogen,
        positiveImpact: hydrogenImpact,
        negativeImpact: -hydrogenImpact * 0.7,
      });
    }
    
    // Vehicle CAPEX (always show)
    const vehicleImpact = Math.round(costShares.vehicleCapexShare * variationRange * 100) / 100;
    params.push({
      id: 'vehicleCost',
      label: 'Coût Véhicules ZE',
      labelKey: 'analytics.risk.vehicleCost',
      fuelType: null,
      baseValue: effectivePrices.vehicleCost,
      unit: '$',
      impactPercent: vehicleImpact,
      impactDirection: 'unfavorable',
      riskRank: 0,
      currentVariation: variations.vehicleCost,
      positiveImpact: vehicleImpact,
      negativeImpact: -vehicleImpact * 0.9,
    });
    
    // Subsidies (always show) - inverse effect
    const subsidyImpact = Math.round(costShares.subsidyShare * variationRange * 100) / 100;
    params.push({
      id: 'subsidy',
      label: 'Subventions',
      labelKey: 'analytics.risk.subsidyAmount',
      fuelType: null,
      baseValue: effectivePrices.subsidyPerVehicle,
      unit: '$',
      impactPercent: subsidyImpact,
      impactDirection: 'favorable', // More subsidy = lower TCO
      riskRank: 0,
      currentVariation: variations.subsidy,
      positiveImpact: -subsidyImpact, // More subsidy = favorable (lower TCO)
      negativeImpact: subsidyImpact * 1.2, // Less subsidy = unfavorable (higher TCO)
    });
    
    // Annual Km (always show)
    const kmImpact = Math.round(costShares.kmShare * variationRange * 100) / 100;
    params.push({
      id: 'annualKm',
      label: 'Kilométrage Annuel',
      labelKey: 'analytics.risk.annualKm',
      fuelType: null,
      baseValue: effectivePrices.annualKm,
      unit: 'km',
      impactPercent: kmImpact,
      impactDirection: 'unfavorable',
      riskRank: 0,
      currentVariation: variations.annualKm,
      positiveImpact: kmImpact,
      negativeImpact: -kmImpact * 0.7,
    });
    
    // Sort by absolute impact and assign ranks
    return params
      .sort((a, b) => Math.abs(b.impactPercent) - Math.abs(a.impactPercent))
      .map((p, idx) => ({ ...p, riskRank: idx + 1 }));
  }, [activeFuelTypes, effectivePrices, costShares, variations]);

  // Calculate impact based on current variations
  const result = useMemo((): RiskAnalysisResult => {
    let totalImpactPercent = 0;
    
    parameters.forEach(param => {
      const variation = variations[param.id] || 0;
      if (variation !== 0) {
        // Calculate proportional impact based on variation
        if (param.id === 'subsidy') {
          // Subsidy has inverse effect
          totalImpactPercent -= (variation / 20) * param.impactPercent;
        } else {
          totalImpactPercent += (variation / 20) * param.impactPercent;
        }
      }
    });
    
    const adjustedTco = baseTcoTotal * (1 + totalImpactPercent / 100);
    const tcoChange = adjustedTco - baseTcoTotal;
    const tcoChangePercent = baseTcoTotal > 0 ? (tcoChange / baseTcoTotal) * 100 : 0;
    
    // Payback adjustment
    const paybackMultiplier = baseTcoTotal > 0 ? adjustedTco / baseTcoTotal : 1;
    const adjustedPayback = basePaybackYears * paybackMultiplier;
    const paybackChange = adjustedPayback - basePaybackYears;
    
    // Find most critical risk
    const mostCriticalRisk = parameters.length > 0 ? parameters[0] : null;
    
    // Determine risk level based on most critical parameter
    let riskLevel: 'low' | 'medium' | 'high' = 'low';
    if (mostCriticalRisk) {
      if (mostCriticalRisk.impactPercent > 8) riskLevel = 'high';
      else if (mostCriticalRisk.impactPercent > 4) riskLevel = 'medium';
    }
    
    return {
      parameters,
      adjustedTco: Math.round(adjustedTco),
      tcoChange: Math.round(tcoChange),
      tcoChangePercent: Math.round(tcoChangePercent * 10) / 10,
      adjustedPayback: Math.round(adjustedPayback * 10) / 10,
      paybackChange: Math.round(paybackChange * 10) / 10,
      isFavorable: tcoChange <= 0,
      mostCriticalRisk,
      riskLevel,
      dataSource: effectivePrices.source as 'scenario' | 'portfolio' | 'defaults',
      scenarioCount: effectivePrices.scenarioCount,
    };
  }, [parameters, variations, baseTcoTotal, basePaybackYears, effectivePrices]);

  // Preset configurations
  const presets: Record<string, Record<string, number>> = {
    energyUp: { diesel: 10, electricity: 10, hydrogen: 10 },
    energyDown: { diesel: -10, electricity: -10, hydrogen: -10 },
    subsidiesDown: { subsidy: -20 },
    kmUp: { annualKm: 15 },
    pessimistic: { diesel: -15, electricity: 20, hydrogen: 25, vehicleCost: 15, subsidy: -20 },
    optimistic: { diesel: 20, electricity: -10, hydrogen: -15, vehicleCost: -10, subsidy: 10 },
  };

  const setVariation = (id: string, value: number) => {
    setVariations(prev => ({ ...prev, [id]: value }));
  };

  const applyPreset = (presetId: string) => {
    const preset = presets[presetId];
    if (preset) {
      setVariations(prev => {
        const newVariations = { ...prev };
        Object.entries(preset).forEach(([key, value]) => {
          // Only apply if the fuel type is active
          const param = parameters.find(p => p.id === key);
          if (param && (param.fuelType === null || activeFuelTypes.includes(param.fuelType))) {
            newVariations[key] = value;
          }
        });
        return newVariations;
      });
    }
  };

  const resetAll = () => {
    setVariations({
      diesel: 0,
      electricity: 0,
      hydrogen: 0,
      vehicleCost: 0,
      subsidy: 0,
      annualKm: 0,
    });
  };

  const hasAnyVariation = Object.values(variations).some(v => v !== 0);

  return {
    result,
    variations,
    setVariation,
    applyPreset,
    resetAll,
    hasAnyVariation,
  };
}
