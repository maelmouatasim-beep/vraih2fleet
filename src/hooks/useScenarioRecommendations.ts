import { useMemo } from 'react';
import { LucideIcon, DollarSign, TrendingDown, Leaf, Zap, Building2, Landmark, AlertTriangle, Calendar, Lightbulb } from 'lucide-react';
import { TCOResult, Scenario, Region } from '@/lib/calculations/types';
import { RECOMMENDATION_THRESHOLDS, RecommendationPriority, RecommendationType, BudgetAlternative } from '@/lib/recommendations/thresholds';
import { generateBudgetAlternatives } from '@/lib/recommendations/budgetAlternatives';
import { formatCurrency } from '@/lib/currency';

export interface ScenarioRecommendation {
  id: string;
  type: RecommendationType;
  priority: RecommendationPriority;
  icon: LucideIcon;
  title: string;
  description: string;
  impact?: string;
  estimatedSavings?: number;
  actionLabel?: string;
  actionLink?: string;
}

export interface BudgetStatus {
  isOverBudget: boolean;
  delta: number;
  percentOver: number;
}

export interface UseScenarioRecommendationsInput {
  result: TCOResult | null;
  scenario: Scenario | null;
  region: Region;
  maxBudget: number | null;
}

export interface UseScenarioRecommendationsOutput {
  recommendations: ScenarioRecommendation[];
  budgetAlternatives: BudgetAlternative[];
  budgetStatus: BudgetStatus | null;
  topRecommendation: ScenarioRecommendation | null;
  hasCriticalIssues: boolean;
  hasHighPriority: boolean;
}

export function useScenarioRecommendations({
  result,
  scenario,
  region,
  maxBudget,
}: UseScenarioRecommendationsInput): UseScenarioRecommendationsOutput {
  
  return useMemo(() => {
    if (!result || !scenario) {
      return {
        recommendations: [],
        budgetAlternatives: [],
        budgetStatus: null,
        topRecommendation: null,
        hasCriticalIssues: false,
        hasHighPriority: false,
      };
    }

    const recommendations: ScenarioRecommendation[] = [];
    
    // Extract fleet composition
    const fleet = scenario.fleetComposition;
    const evCount = fleet?.ev?.count || 0;
    const h2Count = fleet?.hydrogen?.count || 0;
    const dieselCount = fleet?.diesel?.count || 0;
    const totalVehicles = evCount + h2Count + dieselCount;
    
    // Calculate total CAPEX
    const vehicleCapex = (result.byVehicleType?.diesel?.capex || 0) + 
                         (result.byVehicleType?.ev?.capex || 0) + 
                         (result.byVehicleType?.hydrogen?.capex || 0);
    const infraCapex = result.totalInfrastructureCost || 0;
    const totalCapex = vehicleCapex + infraCapex;
    
    // === BUDGET RECOMMENDATIONS ===
    let budgetStatus: BudgetStatus | null = null;
    let budgetAlternatives: BudgetAlternative[] = [];
    
    if (maxBudget !== null && maxBudget > 0) {
      const delta = totalCapex - maxBudget;
      const percentOver = ((totalCapex - maxBudget) / maxBudget) * 100;
      const isOverBudget = delta > 0;
      
      budgetStatus = { isOverBudget, delta, percentOver };
      
      if (isOverBudget) {
        // Critical: Budget exceeded
        recommendations.push({
          id: 'budget_exceeded',
          type: 'budget',
          priority: percentOver > RECOMMENDATION_THRESHOLDS.budget.criticalPercent ? 'critical' : 'high',
          icon: AlertTriangle,
          title: 'budget.exceeded',
          description: 'budget.exceededDesc',
          impact: formatCurrency(delta, region),
        });
        
        // Generate intelligent alternatives using real prices from the scenario
        budgetAlternatives = generateBudgetAlternatives({
          result,
          fleet,
          maxBudget,
          totalCapex,
          region,
        });
      }
    }
    
    // === FINANCIAL RECOMMENDATIONS ===
    
    // Payback period analysis
    if (result.paybackPeriodYears !== null) {
      const payback = result.paybackPeriodYears;
      
      if (payback > RECOMMENDATION_THRESHOLDS.payback.warning) {
        recommendations.push({
          id: 'payback_long',
          type: 'financial',
          priority: payback > RECOMMENDATION_THRESHOLDS.payback.critical ? 'high' : 'medium',
          icon: DollarSign,
          title: 'payback.long',
          description: 'payback.longDesc',
          impact: `${payback.toFixed(1)} years`,
          actionLabel: 'viewSubsidies',
          actionLink: '/dashboard/projects',
        });
      } else if (payback <= RECOMMENDATION_THRESHOLDS.payback.excellent) {
        recommendations.push({
          id: 'payback_excellent',
          type: 'financial',
          priority: 'low',
          icon: Lightbulb,
          title: 'payback.excellent',
          description: 'payback.excellentDesc',
          impact: `${payback.toFixed(1)} years`,
        });
      }
    }
    
    // Infrastructure cost analysis
    if (infraCapex > 0 && totalCapex > 0) {
      const infraShare = infraCapex / totalCapex;
      
      if (infraShare > RECOMMENDATION_THRESHOLDS.infrastructure.highShare) {
        recommendations.push({
          id: 'infra_high',
          type: 'infrastructure',
          priority: infraShare > RECOMMENDATION_THRESHOLDS.infrastructure.criticalShare ? 'high' : 'medium',
          icon: Building2,
          title: 'infrastructure.highCost',
          description: 'infrastructure.highCostDesc',
          impact: `${(infraShare * 100).toFixed(0)}% of CAPEX`,
          actionLabel: 'optimizeInfra',
          actionLink: '/dashboard/infrastructure',
        });
      }
    }
    
    // === SUBSIDY RECOMMENDATIONS ===
    
    // Check for FCEV subsidy eligibility (iMHZEV)
    if (h2Count > 0) {
      recommendations.push({
        id: 'subsidy_fcev',
        type: 'subsidy',
        priority: 'medium',
        icon: Landmark,
        title: 'subsidies.fcevEligible',
        description: 'subsidies.fcevEligibleDesc',
        estimatedSavings: h2Count * 200000, // Up to $200k per FCEV
        actionLabel: 'viewSubsidies',
        actionLink: '/dashboard/projects',
      });
    }
    
    // Check for BEV subsidy eligibility (iZEV)
    if (evCount > 0) {
      recommendations.push({
        id: 'subsidy_bev',
        type: 'subsidy',
        priority: 'low',
        icon: Landmark,
        title: 'subsidies.bevEligible',
        description: 'subsidies.bevEligibleDesc',
        estimatedSavings: evCount * 100000, // Up to $100k per BEV
        actionLabel: 'viewSubsidies',
        actionLink: '/dashboard/projects',
      });
    }
    
    // === OPERATIONAL RECOMMENDATIONS ===
    
    // High daily km for EV
    const evAnnualKm = fleet?.ev?.annualKm || 0;
    const evDailyKm = evAnnualKm / 250; // Assuming 250 working days
    
    if (evCount > 0 && evDailyKm > RECOMMENDATION_THRESHOLDS.fleet.highEvKmPerDay) {
      recommendations.push({
        id: 'ev_high_km',
        type: 'operational',
        priority: 'medium',
        icon: Zap,
        title: 'operational.highEvKm',
        description: 'operational.highEvKmDesc',
        impact: `${evDailyKm.toFixed(0)} km/day`,
      });
    }
    
    // Residual diesel opportunity
    if (totalVehicles > 0) {
      const dieselRatio = dieselCount / totalVehicles;
      
      if (dieselRatio > RECOMMENDATION_THRESHOLDS.fleet.residualDiesel && dieselRatio < 1) {
        recommendations.push({
          id: 'residual_diesel',
          type: 'operational',
          priority: 'low',
          icon: TrendingDown,
          title: 'operational.residualDiesel',
          description: 'operational.residualDieselDesc',
          impact: `${(dieselRatio * 100).toFixed(0)}% diesel`,
        });
      }
    }
    
    // === ESG RECOMMENDATIONS ===
    
    if (result.co2SavingsPercent !== undefined) {
      const co2Savings = result.co2SavingsPercent;
      
      if (co2Savings >= RECOMMENDATION_THRESHOLDS.co2Savings.excellent) {
        recommendations.push({
          id: 'esg_excellent',
          type: 'esg',
          priority: 'low',
          icon: Leaf,
          title: 'esg.excellent',
          description: 'esg.excellentDesc',
          impact: `${co2Savings.toFixed(0)}% reduction`,
        });
      } else if (co2Savings < RECOMMENDATION_THRESHOLDS.co2Savings.moderate) {
        recommendations.push({
          id: 'esg_improve',
          type: 'esg',
          priority: 'medium',
          icon: Leaf,
          title: 'esg.needsImprovement',
          description: 'esg.needsImprovementDesc',
          impact: `${co2Savings.toFixed(0)}% reduction`,
        });
      }
    }
    
    // Sort recommendations by priority
    const priorityOrder: Record<RecommendationPriority, number> = {
      critical: 0,
      high: 1,
      medium: 2,
      low: 3,
    };
    
    recommendations.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
    
    const hasCriticalIssues = recommendations.some(r => r.priority === 'critical');
    const hasHighPriority = recommendations.some(r => r.priority === 'high');
    
    return {
      recommendations,
      budgetAlternatives,
      budgetStatus,
      topRecommendation: recommendations[0] || null,
      hasCriticalIssues,
      hasHighPriority,
    };
  }, [result, scenario, region, maxBudget]);
}
