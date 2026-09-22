-- Create reference_pricing table for regional energy prices
CREATE TABLE public.reference_pricing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  region TEXT NOT NULL,
  fuel_type TEXT NOT NULL,
  price_per_unit DECIMAL(10,4) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'CAD',
  source TEXT,
  source_url TEXT,
  valid_from DATE NOT NULL DEFAULT CURRENT_DATE,
  valid_to DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Index for fast lookups
CREATE INDEX idx_reference_pricing_region_fuel ON public.reference_pricing(region, fuel_type, valid_from DESC);

-- Enable RLS
ALTER TABLE public.reference_pricing ENABLE ROW LEVEL SECURITY;

-- Anyone can read reference pricing (public data)
CREATE POLICY "Anyone can read reference pricing"
ON public.reference_pricing
FOR SELECT
USING (true);

-- Only admins can manage pricing
CREATE POLICY "Only admins can insert reference pricing"
ON public.reference_pricing
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Only admins can update reference pricing"
ON public.reference_pricing
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Only admins can delete reference pricing"
ON public.reference_pricing
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_reference_pricing_updated_at
BEFORE UPDATE ON public.reference_pricing
FOR EACH ROW
EXECUTE FUNCTION public.update_reference_last_updated();

-- Insert initial Quebec and Ontario 2026 data
INSERT INTO public.reference_pricing (region, fuel_type, price_per_unit, currency, source, source_url, valid_from) VALUES
-- Quebec
('QC', 'diesel', 1.65, 'CAD', 'Régie de l''énergie du Québec', 'https://www.regie-energie.qc.ca', '2026-01-01'),
('QC', 'electricity', 0.0788, 'CAD', 'Hydro-Québec tarif D', 'https://www.hydroquebec.com/affaires/tarifs', '2026-01-01'),
('QC', 'hydrogen', 12.50, 'CAD', 'Estimation marché canadien', NULL, '2026-01-01'),
-- Ontario
('ON', 'diesel', 1.72, 'CAD', 'Ontario Energy Board', 'https://www.oeb.ca', '2026-01-01'),
('ON', 'electricity', 0.124, 'CAD', 'Ontario Hydro off-peak average', 'https://www.oeb.ca/rates-and-your-bill', '2026-01-01'),
('ON', 'hydrogen', 14.00, 'CAD', 'Estimation marché Ontario', NULL, '2026-01-01'),
-- British Columbia
('BC', 'diesel', 1.78, 'CAD', 'BC Utilities Commission', 'https://www.bcuc.com', '2026-01-01'),
('BC', 'electricity', 0.0962, 'CAD', 'BC Hydro residential rate', 'https://www.bchydro.com', '2026-01-01'),
('BC', 'hydrogen', 13.00, 'CAD', 'Estimation marché BC', NULL, '2026-01-01'),
-- Alberta
('AB', 'diesel', 1.58, 'CAD', 'Alberta Energy Regulator', 'https://www.aer.ca', '2026-01-01'),
('AB', 'electricity', 0.145, 'CAD', 'Alberta deregulated average', 'https://ucahelps.alberta.ca', '2026-01-01'),
('AB', 'hydrogen', 11.00, 'CAD', 'Alberta H2 hub estimates', NULL, '2026-01-01'),
-- Canada default
('CA', 'diesel', 1.68, 'CAD', 'Statistique Canada moyenne', 'https://www.statcan.gc.ca', '2026-01-01'),
('CA', 'electricity', 0.11, 'CAD', 'Moyenne nationale', NULL, '2026-01-01'),
('CA', 'hydrogen', 12.00, 'CAD', 'Estimation moyenne Canada', NULL, '2026-01-01'),
-- US California
('US-CA', 'diesel', 1.32, 'USD', 'California Energy Commission', 'https://www.energy.ca.gov', '2026-01-01'),
('US-CA', 'electricity', 0.22, 'USD', 'California average retail', 'https://www.eia.gov', '2026-01-01'),
('US-CA', 'hydrogen', 13.50, 'USD', 'CA H2 station network average', NULL, '2026-01-01');