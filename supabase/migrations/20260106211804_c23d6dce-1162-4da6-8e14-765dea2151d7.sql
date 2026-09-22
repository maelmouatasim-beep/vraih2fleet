-- Add geographic columns to hydrogen_suppliers
ALTER TABLE public.hydrogen_suppliers
ADD COLUMN IF NOT EXISTS latitude NUMERIC,
ADD COLUMN IF NOT EXISTS longitude NUMERIC;

-- Create index for geospatial queries
CREATE INDEX IF NOT EXISTS idx_suppliers_coordinates 
ON public.hydrogen_suppliers(latitude, longitude) 
WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- Update existing suppliers with approximate coordinates based on their location
UPDATE public.hydrogen_suppliers SET latitude = 33.4484, longitude = -112.0740 WHERE company_name = 'Nikola Corporation' AND latitude IS NULL;
UPDATE public.hydrogen_suppliers SET latitude = 43.1566, longitude = -77.6088 WHERE company_name = 'Hyzon Motors' AND latitude IS NULL;
UPDATE public.hydrogen_suppliers SET latitude = 22.5431, longitude = 114.0579 WHERE company_name = 'BYD' AND latitude IS NULL;
UPDATE public.hydrogen_suppliers SET latitude = 37.5665, longitude = 126.9780 WHERE company_name = 'Hyundai XCIENT' AND latitude IS NULL;
UPDATE public.hydrogen_suppliers SET latitude = 48.8566, longitude = 2.3522 WHERE company_name = 'Air Liquide' AND latitude IS NULL;
UPDATE public.hydrogen_suppliers SET latitude = 45.5017, longitude = -73.5673 WHERE company_name = 'HTEC' AND latitude IS NULL;
UPDATE public.hydrogen_suppliers SET latitude = 49.2827, longitude = -123.1207 WHERE company_name = 'Ballard Power Systems' AND latitude IS NULL;
UPDATE public.hydrogen_suppliers SET latitude = 43.6532, longitude = -79.3832 WHERE company_name = 'Hydrogenics' AND latitude IS NULL;
UPDATE public.hydrogen_suppliers SET latitude = 45.4215, longitude = -75.6972 WHERE company_name = 'FLO' AND latitude IS NULL;
UPDATE public.hydrogen_suppliers SET latitude = 49.2827, longitude = -123.1207 WHERE company_name = 'ChargePoint' AND latitude IS NULL;
UPDATE public.hydrogen_suppliers SET latitude = 49.2827, longitude = -123.1207 WHERE company_name = 'BC Hydro' AND latitude IS NULL;
UPDATE public.hydrogen_suppliers SET latitude = 49.2827, longitude = -123.1207 WHERE company_name = 'FortisBC' AND latitude IS NULL;
UPDATE public.hydrogen_suppliers SET latitude = 51.0447, longitude = -114.0719 WHERE company_name = 'ATCO' AND latitude IS NULL;
UPDATE public.hydrogen_suppliers SET latitude = 53.5461, longitude = -113.4938 WHERE company_name = 'Emissions Reduction Alberta' AND latitude IS NULL;