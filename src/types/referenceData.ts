// Reference Data Types

export type ConfidenceLevel = 'very_low' | 'low' | 'medium' | 'high' | 'very_high';
export type ReferenceCategory = 'fuel_prices' | 'electricity' | 'hydrogen' | 'vehicles' | 'co2_factors';

export interface ReferenceDataRange {
  id: string;
  category: ReferenceCategory;
  subcategory: string;
  region: string;
  min_value: number;
  mid_value: number;
  max_value: number;
  unit: string;
  source_url: string | null;
  confidence_level: ConfidenceLevel;
  date_effective: string;
  last_updated: string;
  created_at: string;
}

export interface ReferenceDataCondition {
  id: string;
  reference_id: string;
  condition_type: string;
  multiplier: number;
  description: string | null;
  created_at: string;
}

export interface ReferenceDataHistory {
  id: string;
  reference_id: string;
  old_min_value: number | null;
  old_mid_value: number | null;
  old_max_value: number | null;
  new_min_value: number | null;
  new_mid_value: number | null;
  new_max_value: number | null;
  changed_by: string | null;
  change_reason: string | null;
  timestamp: string;
}

export interface ReferenceDataStats {
  totalRecords: number;
  categoryCounts: Record<ReferenceCategory, number>;
  regionCount: number;
  lastUpdated: string | null;
}

export const categoryLabels: Record<ReferenceCategory, string> = {
  fuel_prices: 'Fuel Prices',
  electricity: 'Electricity',
  hydrogen: 'Hydrogen',
  vehicles: 'Vehicles',
  co2_factors: 'CO₂ Factors',
};

export const confidenceLabels: Record<ConfidenceLevel, string> = {
  very_low: 'Very Low',
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  very_high: 'Very High',
};

export const confidenceColors: Record<ConfidenceLevel, string> = {
  very_low: 'bg-destructive/10 text-destructive',
  low: 'bg-chart-diesel/10 text-chart-diesel',
  medium: 'bg-yellow-500/10 text-yellow-600',
  high: 'bg-chart-ev/10 text-chart-ev',
  very_high: 'bg-accent/10 text-accent',
};
