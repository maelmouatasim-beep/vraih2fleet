-- Create enum for confidence levels
CREATE TYPE public.confidence_level AS ENUM ('very_low', 'low', 'medium', 'high', 'very_high');

-- Create enum for reference data categories
CREATE TYPE public.reference_category AS ENUM ('fuel_prices', 'electricity', 'hydrogen', 'vehicles', 'co2_factors');

-- Create reference_data_ranges table
CREATE TABLE public.reference_data_ranges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category reference_category NOT NULL,
  subcategory TEXT NOT NULL,
  region TEXT NOT NULL,
  min_value DECIMAL(12, 4) NOT NULL,
  mid_value DECIMAL(12, 4) NOT NULL,
  max_value DECIMAL(12, 4) NOT NULL,
  unit TEXT NOT NULL,
  source_url TEXT,
  confidence_level confidence_level NOT NULL DEFAULT 'medium',
  date_effective DATE NOT NULL DEFAULT CURRENT_DATE,
  last_updated TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create reference_data_conditions table
CREATE TABLE public.reference_data_conditions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_id UUID NOT NULL REFERENCES public.reference_data_ranges(id) ON DELETE CASCADE,
  condition_type TEXT NOT NULL,
  multiplier DECIMAL(8, 4) NOT NULL DEFAULT 1.0,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create reference_data_history table
CREATE TABLE public.reference_data_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_id UUID NOT NULL REFERENCES public.reference_data_ranges(id) ON DELETE CASCADE,
  old_min_value DECIMAL(12, 4),
  old_mid_value DECIMAL(12, 4),
  old_max_value DECIMAL(12, 4),
  new_min_value DECIMAL(12, 4),
  new_mid_value DECIMAL(12, 4),
  new_max_value DECIMAL(12, 4),
  changed_by TEXT,
  change_reason TEXT,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables (but allow public read for reference data)
ALTER TABLE public.reference_data_ranges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reference_data_conditions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reference_data_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Allow anyone to read reference data
CREATE POLICY "Anyone can read reference data"
  ON public.reference_data_ranges
  FOR SELECT
  USING (true);

CREATE POLICY "Anyone can read reference conditions"
  ON public.reference_data_conditions
  FOR SELECT
  USING (true);

CREATE POLICY "Anyone can read reference history"
  ON public.reference_data_history
  FOR SELECT
  USING (true);

-- For now, allow inserts/updates/deletes for authenticated users (admin panel)
CREATE POLICY "Authenticated users can insert reference data"
  ON public.reference_data_ranges
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update reference data"
  ON public.reference_data_ranges
  FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can delete reference data"
  ON public.reference_data_ranges
  FOR DELETE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert conditions"
  ON public.reference_data_conditions
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update conditions"
  ON public.reference_data_conditions
  FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can delete conditions"
  ON public.reference_data_conditions
  FOR DELETE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert history"
  ON public.reference_data_history
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Create trigger to auto-update last_updated
CREATE OR REPLACE FUNCTION public.update_reference_last_updated()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_updated = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_reference_last_updated
  BEFORE UPDATE ON public.reference_data_ranges
  FOR EACH ROW
  EXECUTE FUNCTION public.update_reference_last_updated();

-- Create trigger to log changes to history
CREATE OR REPLACE FUNCTION public.log_reference_change()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.reference_data_history (
    reference_id,
    old_min_value, old_mid_value, old_max_value,
    new_min_value, new_mid_value, new_max_value,
    changed_by
  ) VALUES (
    OLD.id,
    OLD.min_value, OLD.mid_value, OLD.max_value,
    NEW.min_value, NEW.mid_value, NEW.max_value,
    current_user
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_log_reference_change
  AFTER UPDATE ON public.reference_data_ranges
  FOR EACH ROW
  WHEN (OLD.min_value IS DISTINCT FROM NEW.min_value 
    OR OLD.mid_value IS DISTINCT FROM NEW.mid_value 
    OR OLD.max_value IS DISTINCT FROM NEW.max_value)
  EXECUTE FUNCTION public.log_reference_change();

-- Insert initial data: Fuel Prices (Diesel)
INSERT INTO public.reference_data_ranges (category, subcategory, region, min_value, mid_value, max_value, unit, source_url, confidence_level) VALUES
('fuel_prices', 'Diesel', 'US_CA', 3.35, 3.52, 3.85, 'USD/gal', 'https://gasprices.aaa.com/', 'high'),
('fuel_prices', 'Diesel', 'US_TX', 3.15, 3.28, 3.55, 'USD/gal', 'https://gasprices.aaa.com/', 'high'),
('fuel_prices', 'Diesel', 'US_NY', 3.50, 3.65, 3.95, 'USD/gal', 'https://gasprices.aaa.com/', 'high'),
('fuel_prices', 'Diesel', 'CA_ON', 1.42, 1.58, 1.78, 'CAD/L', 'https://www150.statcan.gc.ca/', 'high'),
('fuel_prices', 'Diesel', 'CA_BC', 1.38, 1.52, 1.72, 'CAD/L', 'https://www150.statcan.gc.ca/', 'high'),
('fuel_prices', 'Diesel', 'CA_QC', 1.40, 1.55, 1.75, 'CAD/L', 'https://www150.statcan.gc.ca/', 'high');

-- Insert initial data: Electricity Prices
INSERT INTO public.reference_data_ranges (category, subcategory, region, min_value, mid_value, max_value, unit, source_url, confidence_level) VALUES
('electricity', 'Grid', 'US_CA', 0.18, 0.24, 0.35, 'USD/kWh', 'https://www.eia.gov/', 'high'),
('electricity', 'Grid', 'US_TX', 0.09, 0.14, 0.22, 'USD/kWh', 'https://www.eia.gov/', 'high'),
('electricity', 'Grid', 'US_NY', 0.12, 0.18, 0.28, 'USD/kWh', 'https://www.eia.gov/', 'high'),
('electricity', 'Grid', 'CA_ON', 0.12, 0.18, 0.28, 'CAD/kWh', 'https://www.oeb.ca/', 'high'),
('electricity', 'Grid', 'CA_BC', 0.10, 0.15, 0.22, 'CAD/kWh', 'https://www.bchydro.com/', 'high'),
('electricity', 'Grid', 'CA_QC', 0.08, 0.12, 0.18, 'CAD/kWh', 'https://www.hydroquebec.com/', 'high');

-- Insert initial data: Hydrogen Prices
INSERT INTO public.reference_data_ranges (category, subcategory, region, min_value, mid_value, max_value, unit, source_url, confidence_level) VALUES
('hydrogen', 'Retail 2025', 'US_CA', 28.00, 32.94, 38.00, 'USD/kg', 'https://h2fcp.org/', 'medium'),
('hydrogen', 'Production 2030', 'Global', 2.50, 3.70, 5.20, 'USD/kg', 'https://www.iea.org/', 'medium'),
('hydrogen', 'Retail 2025', 'CA_ON', 35.00, 40.00, 48.00, 'CAD/kg', 'https://www.nrcan.gc.ca/', 'low'),
('hydrogen', 'Retail 2025', 'CA_BC', 32.00, 38.00, 45.00, 'CAD/kg', 'https://www.nrcan.gc.ca/', 'low');

-- Insert initial data: Vehicle Costs
INSERT INTO public.reference_data_ranges (category, subcategory, region, min_value, mid_value, max_value, unit, source_url, confidence_level) VALUES
('vehicles', 'Diesel Truck', 'North America', 80000, 120000, 180000, 'USD', 'https://www.actrucks.com/', 'high'),
('vehicles', 'EV Truck', 'North America', 150000, 220000, 300000, 'USD', 'https://www.actrucks.com/', 'medium'),
('vehicles', 'H2 Truck', 'North America', 200000, 280000, 400000, 'USD', 'https://www.actrucks.com/', 'medium'),
('vehicles', 'Diesel Bus', 'North America', 250000, 350000, 450000, 'USD', 'https://www.apta.com/', 'high'),
('vehicles', 'EV Bus', 'North America', 450000, 600000, 800000, 'USD', 'https://www.apta.com/', 'medium'),
('vehicles', 'H2 Bus', 'North America', 500000, 700000, 950000, 'USD', 'https://www.apta.com/', 'medium');

-- Insert initial data: CO2 Factors
INSERT INTO public.reference_data_ranges (category, subcategory, region, min_value, mid_value, max_value, unit, source_url, confidence_level) VALUES
('co2_factors', 'Diesel', 'Global', 2.65, 2.69, 2.73, 'kgCO2/L', 'https://www.epa.gov/', 'very_high'),
('co2_factors', 'Electricity Grid', 'US_CA', 0.11, 0.13, 0.15, 'kgCO2/kWh', 'https://www.epa.gov/', 'high'),
('co2_factors', 'Electricity Grid', 'US_TX', 0.35, 0.38, 0.42, 'kgCO2/kWh', 'https://www.epa.gov/', 'high'),
('co2_factors', 'Electricity Grid', 'US_NY', 0.18, 0.20, 0.22, 'kgCO2/kWh', 'https://www.epa.gov/', 'high'),
('co2_factors', 'Electricity Grid', 'CA_ON', 0.03, 0.04, 0.05, 'kgCO2/kWh', 'https://www.canada.ca/', 'high'),
('co2_factors', 'Electricity Grid', 'CA_BC', 0.01, 0.02, 0.03, 'kgCO2/kWh', 'https://www.canada.ca/', 'high'),
('co2_factors', 'Electricity Grid', 'CA_QC', 0.01, 0.015, 0.02, 'kgCO2/kWh', 'https://www.canada.ca/', 'high'),
('co2_factors', 'Hydrogen Green', 'Global', 0.08, 0.10, 0.12, 'kgCO2/kgH2', 'https://www.iea.org/', 'medium'),
('co2_factors', 'Hydrogen Grey', 'Global', 9.0, 10.0, 11.0, 'kgCO2/kgH2', 'https://www.iea.org/', 'high');