
-- Fix hydrogen_suppliers to require authentication for reading
-- This prevents anonymous scraping of supplier contact information

-- Drop the overly permissive public read policy
DROP POLICY IF EXISTS "Anyone can read hydrogen suppliers" ON public.hydrogen_suppliers;

-- Create a new policy that requires authentication to read suppliers
CREATE POLICY "Authenticated users can read hydrogen suppliers"
  ON public.hydrogen_suppliers
  FOR SELECT
  TO authenticated
  USING (true);

-- Optional: Create a public view without sensitive contact information
-- This allows unauthenticated users to browse suppliers without seeing emails/phones
CREATE OR REPLACE VIEW public.hydrogen_suppliers_public
WITH (security_invoker = true)
AS SELECT 
  id,
  company_name,
  supplier_type,
  country,
  province_state,
  city,
  website_url,
  description_en,
  description_fr,
  products_services,
  certifications,
  logo_url,
  service_regions,
  is_verified,
  latitude,
  longitude,
  price_range_min,
  price_range_max,
  currency,
  warranty_years,
  delivery_time_weeks,
  vehicle_categories,
  languages,
  established_year,
  employee_count,
  rating,
  review_count,
  created_at,
  updated_at
  -- Excludes: contact_email, contact_phone, headquarters_address, postal_code, response_time_hours, verification_date, social_media, metadata
FROM public.hydrogen_suppliers;

-- Grant anonymous users read access to the public view (without sensitive data)
GRANT SELECT ON public.hydrogen_suppliers_public TO anon;
GRANT SELECT ON public.hydrogen_suppliers_public TO authenticated;

COMMENT ON VIEW public.hydrogen_suppliers_public IS 'Public view of hydrogen suppliers without sensitive contact information';
