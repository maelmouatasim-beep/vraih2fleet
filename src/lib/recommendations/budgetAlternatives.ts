import { TCOResult, FleetComposition, Region } from '@/lib/calculations/types';
import { BudgetAlternative } from './thresholds';
import { formatCurrency } from '@/lib/currency';

interface AlternativesInput {
  result: TCOResult;
  fleet: FleetComposition;
  maxBudget: number;
  totalCapex: number;
  region: Region;
}

/**
 * Generates intelligent budget alternatives based on real scenario data
 * Uses actual unit costs from the scenario rather than hardcoded values
 */
export function generateBudgetAlternatives({
  result,
  fleet,
  maxBudget,
  totalCapex,
  region,
}: AlternativesInput): BudgetAlternative[] {
  const delta = totalCapex - maxBudget;
  
  if (delta <= 0) return []; // No alternatives needed if within budget
  
  const alternatives: BudgetAlternative[] = [];
  
  // Extract REAL unit costs from scenario results
  const h2Count = fleet.hydrogen?.count || 0;
  const evCount = fleet.ev?.count || 0;
  const dieselCount = fleet.diesel?.count || 0;
  const totalVehicles = h2Count + evCount + dieselCount;
  
  // Calculate actual unit costs from results (avoid division by zero)
  const h2UnitCapex = h2Count > 0 
    ? (result.byVehicleType?.hydrogen?.capex || 0) / h2Count 
    : 350000; // Fallback
  const evUnitCapex = evCount > 0 
    ? (result.byVehicleType?.ev?.capex || 0) / evCount 
    : 280000; // Fallback
  const dieselUnitCapex = dieselCount > 0 
    ? (result.byVehicleType?.diesel?.capex || 0) / dieselCount 
    : 150000; // Fallback

  // === OPTION 1: H2 → EV Substitution (maintains ZE status) ===
  if (h2Count > 0 && h2UnitCapex > evUnitCapex) {
    const savingsPerSwap = h2UnitCapex - evUnitCapex;
    const swapsNeeded = Math.ceil(delta / savingsPerSwap);
    const maxSwaps = Math.min(swapsNeeded, h2Count);
    const actualSavings = maxSwaps * savingsPerSwap;
    
    if (maxSwaps > 0 && maxSwaps <= h2Count) {
      alternatives.push({
        id: 'swap_h2_to_ev',
        title: `${maxSwaps} H₂ → BEV`,
        description: `Substituer ${maxSwaps} véhicule${maxSwaps > 1 ? 's' : ''} H₂ par des BEV`,
        changes: { h2Delta: -maxSwaps, evDelta: +maxSwaps, dieselDelta: 0 },
        newCapex: totalCapex - actualSavings,
        savings: actualSavings,
        impactCO2: 'maintained',
        impactCO2Label: '100% ZE maintenu',
        feasible: true,
        resolvesDeficit: actualSavings >= delta,
        actionType: 'simulate',
      });
    }
  }

  // === OPTION 2: Minimal H2 reduction ===
  if (h2Count > 0) {
    const h2ToRemove = Math.ceil(delta / h2UnitCapex);
    const safeRemove = Math.min(h2ToRemove, Math.max(1, h2Count - 1)); // Keep at least 1 if possible
    const actualSavings = safeRemove * h2UnitCapex;
    
    if (safeRemove > 0 && safeRemove < h2Count) {
      alternatives.push({
        id: 'reduce_h2_minimal',
        title: `H₂: ${h2Count} → ${h2Count - safeRemove}`,
        description: `Réduire la flotte H₂ de ${safeRemove} véhicule${safeRemove > 1 ? 's' : ''}`,
        changes: { h2Delta: -safeRemove, evDelta: 0, dieselDelta: 0 },
        newCapex: totalCapex - actualSavings,
        savings: actualSavings,
        impactCO2: 'reduced',
        impactCO2Label: `Capacité H₂ réduite de ${Math.round((safeRemove / h2Count) * 100)}%`,
        feasible: true,
        resolvesDeficit: actualSavings >= delta,
        actionType: 'simulate',
      });
    }
  }

  // === OPTION 3: EV reduction (if no H2 or not enough) ===
  if (evCount > 0 && (h2Count === 0 || delta > h2Count * h2UnitCapex)) {
    const remainingDelta = h2Count > 0 ? delta - (h2Count * h2UnitCapex) : delta;
    const targetDelta = h2Count === 0 ? delta : Math.max(0, remainingDelta);
    const evToRemove = Math.ceil(targetDelta / evUnitCapex);
    const safeRemove = Math.min(evToRemove, Math.max(1, evCount - 1));
    const actualSavings = safeRemove * evUnitCapex;
    
    if (safeRemove > 0 && safeRemove < evCount) {
      alternatives.push({
        id: 'reduce_ev',
        title: `BEV: ${evCount} → ${evCount - safeRemove}`,
        description: `Réduire la flotte BEV de ${safeRemove} véhicule${safeRemove > 1 ? 's' : ''}`,
        changes: { h2Delta: 0, evDelta: -safeRemove, dieselDelta: 0 },
        newCapex: totalCapex - actualSavings,
        savings: actualSavings,
        impactCO2: 'reduced',
        impactCO2Label: `Capacité BEV réduite de ${Math.round((safeRemove / evCount) * 100)}%`,
        feasible: true,
        resolvesDeficit: actualSavings >= delta,
        actionType: 'simulate',
      });
    }
  }

  // === OPTION 4: Mixed reduction (H2 + EV) ===
  if (h2Count > 0 && evCount > 0) {
    // Proportional reduction based on cost contribution
    const h2Share = (h2Count * h2UnitCapex) / totalCapex;
    const h2Remove = Math.max(1, Math.ceil(h2Count * Math.min(0.5, delta / (h2Count * h2UnitCapex))));
    const remainingDelta = delta - (h2Remove * h2UnitCapex);
    const evRemove = remainingDelta > 0 ? Math.ceil(remainingDelta / evUnitCapex) : 0;
    
    if (h2Remove > 0 && h2Remove < h2Count && evRemove >= 0 && evRemove < evCount) {
      const mixSavings = (h2Remove * h2UnitCapex) + (evRemove * evUnitCapex);
      
      alternatives.push({
        id: 'mix_reduction',
        title: `-${h2Remove} H₂, -${evRemove} BEV`,
        description: 'Réduction équilibrée sur les deux technologies',
        changes: { h2Delta: -h2Remove, evDelta: -evRemove, dieselDelta: 0 },
        newCapex: totalCapex - mixSavings,
        savings: mixSavings,
        impactCO2: 'reduced',
        impactCO2Label: 'Impact réparti',
        feasible: mixSavings >= delta * 0.8,
        resolvesDeficit: mixSavings >= delta,
        actionType: 'simulate',
      });
    }
  }

  // === OPTION 5: Temporary diesel (if currently 100% ZE) ===
  if (dieselCount === 0 && totalVehicles > 0) {
    // Calculate how many ZE vehicles to replace with diesel
    const avgZePrice = ((h2Count * h2UnitCapex) + (evCount * evUnitCapex)) / (h2Count + evCount);
    const savingsPerReplacement = avgZePrice - dieselUnitCapex;
    
    if (savingsPerReplacement > 0) {
      const replacementsNeeded = Math.ceil(delta / savingsPerReplacement);
      const maxReplacements = Math.min(replacementsNeeded, Math.floor(totalVehicles * 0.3)); // Max 30% diesel
      const actualSavings = maxReplacements * savingsPerReplacement;
      
      // Prioritize replacing H2 (more expensive)
      const h2ToReplace = Math.min(maxReplacements, h2Count);
      const evToReplace = maxReplacements - h2ToReplace;
      
      if (maxReplacements > 0) {
        alternatives.push({
          id: 'add_diesel_temp',
          title: `+${maxReplacements} diesel temporaire`,
          description: 'Transition graduelle avec diesel de transition',
          changes: { 
            h2Delta: -h2ToReplace, 
            evDelta: -evToReplace, 
            dieselDelta: +maxReplacements 
          },
          newCapex: totalCapex - actualSavings,
          savings: actualSavings,
          impactCO2: 'deferred',
          impactCO2Label: 'Réduction CO₂ différée',
          feasible: true,
          resolvesDeficit: actualSavings >= delta,
          actionType: 'simulate',
        });
      }
    }
  }

  // === OPTION 6: Phased deployment (always suggest) ===
  const phaseRatio = maxBudget / totalCapex;
  if (phaseRatio >= 0.3 && phaseRatio < 1) {
    const phase1Vehicles = Math.floor(totalVehicles * phaseRatio);
    const phase2Cost = totalCapex - maxBudget;
    
    alternatives.push({
      id: 'phased_deployment',
      title: `${phase1Vehicles}/${totalVehicles} véhicules en phase 1`,
      description: `Phase 1: ${formatCurrency(maxBudget, region)}, Phase 2: ${formatCurrency(phase2Cost, region)}`,
      changes: { h2Delta: 0, evDelta: 0, dieselDelta: 0 },
      newCapex: maxBudget,
      savings: phase2Cost,
      impactCO2: 'deferred',
      impactCO2Label: 'Transition progressive',
      feasible: true,
      resolvesDeficit: true,
      actionType: 'roadmap',
    });
  }

  // Filter and sort alternatives
  return alternatives
    .filter(a => a.feasible)
    .sort((a, b) => {
      // Prioritize: resolves deficit > higher savings > maintains CO2
      if (a.resolvesDeficit !== b.resolvesDeficit) {
        return a.resolvesDeficit ? -1 : 1;
      }
      if (a.impactCO2 === 'maintained' && b.impactCO2 !== 'maintained') {
        return -1;
      }
      return b.savings - a.savings;
    })
    .slice(0, 5); // Max 5 alternatives
}
