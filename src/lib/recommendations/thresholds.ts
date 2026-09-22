// Configurable thresholds for intelligent recommendations
// These values can be adjusted based on business requirements

export const RECOMMENDATION_THRESHOLDS = {
  // Budget constraints
  budget: {
    warningPercent: 10,   // Alert if CAPEX is >10% above budget
    criticalPercent: 20,  // Critical if CAPEX is >20% above budget
  },
  
  // Payback period (years)
  payback: {
    excellent: 4,    // ≤4 years = excellent
    good: 5,         // 4-5 years = good
    acceptable: 7,   // 5-7 years = acceptable
    warning: 10,     // 7-10 years = warning
    critical: 10,    // >10 years = problematic
  },
  
  // CO2 savings percentage
  co2Savings: {
    excellent: 80,  // >80% = excellent performance
    good: 50,       // 50-80% = good
    moderate: 30,   // 30-50% = moderate
    poor: 30,       // <30% = needs improvement
  },
  
  // Infrastructure costs as % of total CAPEX
  infrastructure: {
    normalShare: 0.20,   // Normal if infrastructure is <20% of CAPEX
    highShare: 0.30,     // High if infrastructure is 20-30% of CAPEX
    criticalShare: 0.40, // Critical if infrastructure is >40% of CAPEX
  },
  
  // Fleet composition
  fleet: {
    highEvKmPerDay: 300,     // BEV may struggle above 300km/day
    residualDiesel: 0.20,    // >20% diesel = opportunity for further electrification
    h2MinForStation: 3,      // Minimum H2 vehicles to justify dedicated station
  },
  
  // TCO per km comparison (vs diesel baseline)
  tcoPerKm: {
    betterThanDiesel: 0.95,  // <95% of diesel = good
    parityWithDiesel: 1.05,  // 95-105% = parity
    worseThanDiesel: 1.10,   // >110% = needs attention
  },
  
  // Vehicle prices (CAD) - approximate for diversification suggestions
  vehicleCosts: {
    evTruck: 280000,
    h2Truck: 350000,
    dieselTruck: 150000,
    evToH2Savings: 70000, // Approximate savings when swapping H2 → EV
  },
  
  // Infrastructure costs (CAD)
  infrastructureCosts: {
    evChargerFast: 75000,
    evChargerSlow: 15000,
    h2StationSmall: 1500000,
    h2StationMedium: 2500000,
    h2StationLarge: 4000000,
  },
} as const;

// Priority levels for recommendations
export type RecommendationPriority = 'critical' | 'high' | 'medium' | 'low';
export type RecommendationType = 'budget' | 'financial' | 'operational' | 'esg' | 'subsidy' | 'infrastructure';

export interface RecommendationThreshold {
  condition: (value: number, threshold: number) => boolean;
  priority: RecommendationPriority;
}

// Budget alternative suggestion
export interface BudgetAlternative {
  id: string;
  title: string;
  description: string;
  changes: {
    h2Delta: number;
    evDelta: number;
    dieselDelta: number;
  };
  newCapex: number;
  savings: number;
  impactCO2: 'maintained' | 'reduced' | 'increased' | 'deferred';
  impactCO2Label: string;
  feasible: boolean;
  resolvesDeficit: boolean;
  actionType: 'simulate' | 'roadmap' | 'subsidies';
}
