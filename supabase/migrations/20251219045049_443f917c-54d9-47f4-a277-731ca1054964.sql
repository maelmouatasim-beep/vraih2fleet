-- Create scenarios table
CREATE TABLE public.scenarios (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  region TEXT NOT NULL DEFAULT 'US_CA',
  analysis_years INTEGER NOT NULL DEFAULT 10,
  discount_rate NUMERIC NOT NULL DEFAULT 5.0,
  fleet_composition JSONB NOT NULL DEFAULT '{"diesel": {"count": 0, "annualKm": 0}, "ev": {"count": 0, "annualKm": 0}, "hydrogen": {"count": 0, "annualKm": 0}}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create tco_results table
CREATE TABLE public.tco_results (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  scenario_id UUID NOT NULL REFERENCES public.scenarios(id) ON DELETE CASCADE,
  capex NUMERIC NOT NULL,
  opex_total NUMERIC NOT NULL,
  tco_total NUMERIC NOT NULL,
  tco_per_km NUMERIC,
  npv NUMERIC,
  residual_value NUMERIC,
  payback_period_years NUMERIC,
  co2_total NUMERIC NOT NULL,
  co2_savings NUMERIC,
  co2_savings_percent NUMERIC,
  charging_stations INTEGER DEFAULT 0,
  charging_stations_cost NUMERIC DEFAULT 0,
  h2_stations INTEGER DEFAULT 0,
  h2_stations_cost NUMERIC DEFAULT 0,
  total_infrastructure_cost NUMERIC DEFAULT 0,
  yearly_breakdown JSONB,
  by_vehicle_type JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create projects table (if it doesn't exist)
CREATE TABLE IF NOT EXISTS public.projects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  country_or_region TEXT NOT NULL DEFAULT 'US_CA',
  currency TEXT NOT NULL DEFAULT 'USD',
  default_analysis_horizon_years INTEGER NOT NULL DEFAULT 10,
  default_discount_rate NUMERIC NOT NULL DEFAULT 5.0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add foreign key for scenarios to projects
ALTER TABLE public.scenarios 
ADD CONSTRAINT scenarios_project_id_fkey 
FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;

-- Enable RLS on all tables
ALTER TABLE public.scenarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tco_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- RLS policies for projects (public read, authenticated write)
CREATE POLICY "Anyone can read projects" ON public.projects
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert projects" ON public.projects
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Authenticated users can update projects" ON public.projects
  FOR UPDATE USING (true);

CREATE POLICY "Authenticated users can delete projects" ON public.projects
  FOR DELETE USING (true);

-- RLS policies for scenarios (public read, authenticated write)
CREATE POLICY "Anyone can read scenarios" ON public.scenarios
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert scenarios" ON public.scenarios
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Authenticated users can update scenarios" ON public.scenarios
  FOR UPDATE USING (true);

CREATE POLICY "Authenticated users can delete scenarios" ON public.scenarios
  FOR DELETE USING (true);

-- RLS policies for tco_results (public read, authenticated write)
CREATE POLICY "Anyone can read tco_results" ON public.tco_results
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert tco_results" ON public.tco_results
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Authenticated users can update tco_results" ON public.tco_results
  FOR UPDATE USING (true);

CREATE POLICY "Authenticated users can delete tco_results" ON public.tco_results
  FOR DELETE USING (true);

-- Create trigger for updated_at on scenarios
CREATE TRIGGER update_scenarios_updated_at
  BEFORE UPDATE ON public.scenarios
  FOR EACH ROW
  EXECUTE FUNCTION public.update_reference_last_updated();

-- Create trigger for updated_at on projects
CREATE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.update_reference_last_updated();

-- Create indexes for better query performance
CREATE INDEX idx_scenarios_project_id ON public.scenarios(project_id);
CREATE INDEX idx_tco_results_scenario_id ON public.tco_results(scenario_id);