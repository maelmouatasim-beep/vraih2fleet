-- Add advanced cost columns to tco_results table
ALTER TABLE public.tco_results 
ADD COLUMN IF NOT EXISTS downtime_cost numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS insurance_cost numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS telematics_cost numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS grid_demand_cost numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS carbon_credits_value numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS cold_weather_impact numeric DEFAULT 0;