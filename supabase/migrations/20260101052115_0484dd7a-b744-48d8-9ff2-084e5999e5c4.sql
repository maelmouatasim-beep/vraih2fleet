-- Create infrastructure_plans table
CREATE TABLE public.infrastructure_plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  scenario_id UUID REFERENCES public.scenarios(id) ON DELETE SET NULL,
  
  -- H2 infrastructure
  h2_vehicles_count INTEGER NOT NULL DEFAULT 0,
  h2_daily_kg NUMERIC NOT NULL DEFAULT 0,
  h2_refueling_frequency INTEGER NOT NULL DEFAULT 1,
  h2_station_capacity INTEGER NOT NULL DEFAULT 200,
  h2_operating_hours INTEGER NOT NULL DEFAULT 12,
  h2_stations_count INTEGER NOT NULL DEFAULT 0,
  h2_capex NUMERIC NOT NULL DEFAULT 0,
  h2_opex NUMERIC NOT NULL DEFAULT 0,
  h2_land_permits NUMERIC NOT NULL DEFAULT 0,
  
  -- EV infrastructure
  ev_vehicles_count INTEGER NOT NULL DEFAULT 0,
  ev_battery_capacity_kwh NUMERIC NOT NULL DEFAULT 100,
  ev_daily_kwh NUMERIC NOT NULL DEFAULT 0,
  ev_charging_speed TEXT NOT NULL DEFAULT 'fast',
  ev_charging_hours INTEGER NOT NULL DEFAULT 8,
  chargers_slow INTEGER NOT NULL DEFAULT 0,
  chargers_fast INTEGER NOT NULL DEFAULT 0,
  chargers_ultra INTEGER NOT NULL DEFAULT 0,
  ev_capex NUMERIC NOT NULL DEFAULT 0,
  ev_installation NUMERIC NOT NULL DEFAULT 0,
  ev_grid_upgrade NUMERIC NOT NULL DEFAULT 0,
  ev_opex NUMERIC NOT NULL DEFAULT 0,
  
  -- Totals
  total_capex NUMERIC NOT NULL DEFAULT 0,
  total_opex_10y NUMERIC NOT NULL DEFAULT 0,
  
  -- Metadata
  name TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.infrastructure_plans ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own infrastructure plans"
ON public.infrastructure_plans
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own infrastructure plans"
ON public.infrastructure_plans
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own infrastructure plans"
ON public.infrastructure_plans
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own infrastructure plans"
ON public.infrastructure_plans
FOR DELETE
USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_infrastructure_plans_updated_at
BEFORE UPDATE ON public.infrastructure_plans
FOR EACH ROW
EXECUTE FUNCTION public.update_profile_updated_at();