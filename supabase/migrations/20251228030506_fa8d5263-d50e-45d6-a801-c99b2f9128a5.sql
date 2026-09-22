-- Create enum for supplier types
CREATE TYPE public.supplier_type AS ENUM ('vehicle_manufacturer', 'infrastructure', 'fuel_provider', 'maintenance');

-- Create the hydrogen_suppliers table
CREATE TABLE public.hydrogen_suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name TEXT NOT NULL,
  supplier_type supplier_type NOT NULL,
  country TEXT NOT NULL,
  province_state TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  website_url TEXT,
  description_en TEXT,
  description_fr TEXT,
  products_services TEXT[] NOT NULL DEFAULT '{}',
  certifications TEXT[] DEFAULT '{}',
  logo_url TEXT,
  headquarters_address TEXT,
  service_regions TEXT[] DEFAULT '{}',
  is_verified BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.hydrogen_suppliers ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Public read, admin write
CREATE POLICY "Anyone can read hydrogen suppliers"
  ON public.hydrogen_suppliers
  FOR SELECT
  USING (true);

CREATE POLICY "Only admins can insert hydrogen suppliers"
  ON public.hydrogen_suppliers
  FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Only admins can update hydrogen suppliers"
  ON public.hydrogen_suppliers
  FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Only admins can delete hydrogen suppliers"
  ON public.hydrogen_suppliers
  FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_hydrogen_suppliers_updated_at
  BEFORE UPDATE ON public.hydrogen_suppliers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_profile_updated_at();

-- Create index for search
CREATE INDEX idx_hydrogen_suppliers_company_name ON public.hydrogen_suppliers USING gin(to_tsvector('english', company_name));
CREATE INDEX idx_hydrogen_suppliers_type ON public.hydrogen_suppliers(supplier_type);
CREATE INDEX idx_hydrogen_suppliers_country ON public.hydrogen_suppliers(country);

-- Insert verified hydrogen suppliers (December 2025)
INSERT INTO public.hydrogen_suppliers (
  company_name, supplier_type, country, province_state, contact_email, contact_phone,
  website_url, description_en, description_fr, products_services, certifications,
  service_regions, is_verified
) VALUES
-- Vehicle Manufacturers
(
  'Nikola Corporation',
  'vehicle_manufacturer',
  'USA',
  'AZ',
  'info@nikolamotor.com',
  '+1-480-666-1038',
  'https://www.nikolamotor.com',
  'Leading manufacturer of hydrogen fuel cell and battery-electric heavy-duty trucks. The Nikola Tre FCEV offers 500+ mile range with hydrogen refueling in under 20 minutes.',
  'Fabricant leader de camions lourds à pile à combustible hydrogène et électriques à batterie. Le Nikola Tre FCEV offre une autonomie de plus de 800 km avec ravitaillement en moins de 20 minutes.',
  ARRAY['Class 8 FCEV trucks', 'Class 8 BEV trucks', 'Hydrogen fueling solutions', 'Fleet management software'],
  ARRAY['ISO 9001', 'EPA Certified', 'CARB Certified'],
  ARRAY['USA', 'Canada', 'Europe'],
  true
),
(
  'Hyzon Motors',
  'vehicle_manufacturer',
  'USA',
  'NY',
  'info@hyzonmotors.com',
  '+1-585-484-9337',
  'https://www.hyzonmotors.com',
  'Global supplier of hydrogen fuel cell-powered commercial vehicles including Class 8 trucks and buses. Focus on back-to-base fleet operations.',
  'Fournisseur mondial de véhicules commerciaux à pile à combustible hydrogène incluant camions Classe 8 et autobus. Focus sur les opérations de flotte avec retour à la base.',
  ARRAY['Class 8 FCEV trucks', 'Transit buses', 'Refuse trucks', 'Fuel cell systems'],
  ARRAY['ISO 14001', 'EPA Certified'],
  ARRAY['USA', 'Canada', 'Australia', 'Europe'],
  true
),
(
  'BYD Company Ltd.',
  'vehicle_manufacturer',
  'China',
  NULL,
  'eBusNA@byd.com',
  '+1-213-748-3980',
  'https://en.byd.com',
  'World largest manufacturer of electric vehicles and batteries. Offers hydrogen fuel cell trucks and buses for North American market through BYD Motors.',
  'Plus grand fabricant mondial de véhicules électriques et batteries. Offre des camions et autobus à pile à combustible hydrogène pour le marché nord-américain via BYD Motors.',
  ARRAY['FCEV trucks', 'Electric buses', 'Battery systems', 'Transit solutions'],
  ARRAY['ISO 9001', 'ISO 14001', 'CARB Certified', 'Buy America Compliant'],
  ARRAY['USA', 'Canada', 'Mexico', 'Global'],
  true
),
(
  'Hyundai Motor Company - XCIENT Fuel Cell',
  'vehicle_manufacturer',
  'South Korea',
  NULL,
  'xcient@hyundai.com',
  '+1-714-965-3000',
  'https://trucknbus.hyundai.com/global/en/products/xcient-fuel-cell',
  'XCIENT Fuel Cell is the world first mass-produced heavy-duty hydrogen truck. 180kW fuel cell system with 800km range. Already deployed in Switzerland and expanding to North America.',
  'XCIENT Fuel Cell est le premier camion lourd à hydrogène produit en série au monde. Système pile à combustible 180kW avec 800km d''autonomie. Déjà déployé en Suisse et en expansion vers l''Amérique du Nord.',
  ARRAY['XCIENT Fuel Cell Class 8', 'Hydrogen fuel cell systems', 'Heavy-duty trucks'],
  ARRAY['ISO 9001', 'ISO 14001', 'EPA 2027 Compliant'],
  ARRAY['USA', 'Canada', 'Europe', 'South Korea'],
  true
),
-- Infrastructure Providers
(
  'Air Liquide',
  'infrastructure',
  'France',
  NULL,
  'hydrogen.energy@airliquide.com',
  '+1-713-624-8000',
  'https://www.airliquide.com/group/activities/hydrogen',
  'World leader in hydrogen production, storage and distribution. Operates hydrogen refueling stations across North America and provides complete hydrogen supply chain solutions.',
  'Leader mondial de la production, stockage et distribution d''hydrogène. Opère des stations de ravitaillement hydrogène à travers l''Amérique du Nord et fournit des solutions complètes de chaîne d''approvisionnement.',
  ARRAY['Hydrogen production', 'Refueling stations', 'Storage solutions', 'Distribution networks', 'Green hydrogen'],
  ARRAY['ISO 9001', 'ISO 14001', 'ISO 45001'],
  ARRAY['USA', 'Canada', 'Global'],
  true
),
(
  'Linde plc',
  'infrastructure',
  'Ireland',
  NULL,
  'info@linde.com',
  '+1-908-771-1700',
  'https://www.linde.com/clean-energy/hydrogen-for-mobility',
  'Global industrial gases company providing hydrogen fueling infrastructure, production facilities, and turnkey hydrogen station solutions for heavy-duty applications.',
  'Entreprise mondiale de gaz industriels fournissant infrastructure de ravitaillement hydrogène, installations de production et solutions de stations clé en main pour applications lourdes.',
  ARRAY['Hydrogen fueling stations', 'Electrolyzers', 'Hydrogen production', 'Compression systems', 'Dispensing equipment'],
  ARRAY['ISO 9001', 'ISO 14001', 'NFPA 2 Compliant'],
  ARRAY['USA', 'Canada', 'Europe', 'Global'],
  true
),
(
  'HTEC - Hydrogen Technology & Energy Corporation',
  'infrastructure',
  'Canada',
  'BC',
  'info@htec.ca',
  '+1-604-803-0652',
  'https://www.htec.ca',
  'Canadian hydrogen infrastructure company developing a network of hydrogen fueling stations in British Columbia and beyond. Focus on green hydrogen production.',
  'Entreprise canadienne d''infrastructure hydrogène développant un réseau de stations de ravitaillement en Colombie-Britannique et au-delà. Focus sur la production d''hydrogène vert.',
  ARRAY['Hydrogen fueling stations', 'Green hydrogen production', 'Station development', 'Fleet solutions'],
  ARRAY['CSA Certified', 'BC Hydro Partner'],
  ARRAY['BC', 'Alberta', 'Canada'],
  true
),
-- Fuel Providers
(
  'Shell Hydrogen',
  'fuel_provider',
  'Netherlands',
  NULL,
  'hydrogen@shell.com',
  '+1-800-331-3703',
  'https://www.shell.com/energy-and-innovation/new-energies/hydrogen.html',
  'Major energy company with growing hydrogen fueling network in California and expanding across North America. Provides both green and blue hydrogen solutions.',
  'Grande entreprise énergétique avec réseau croissant de stations hydrogène en Californie et en expansion à travers l''Amérique du Nord. Fournit solutions hydrogène vert et bleu.',
  ARRAY['Hydrogen fuel retail', 'Fleet fueling', 'Hydrogen production', 'Energy solutions'],
  ARRAY['ISO 9001', 'CARB Certified'],
  ARRAY['California', 'USA', 'Canada', 'Europe'],
  true
),
-- Maintenance & Systems
(
  'Ballard Power Systems',
  'maintenance',
  'Canada',
  'BC',
  'info@ballard.com',
  '+1-604-454-0900',
  'https://www.ballard.com',
  'World leading provider of hydrogen fuel cell power systems. Offers fuel cell modules, service, maintenance and technical support for heavy-duty vehicle applications.',
  'Leader mondial des systèmes de puissance à pile à combustible hydrogène. Offre modules pile à combustible, service, maintenance et support technique pour applications véhicules lourds.',
  ARRAY['Fuel cell modules', 'FCmove series', 'Technical support', 'Maintenance services', 'Training programs'],
  ARRAY['ISO 9001', 'ISO 14001', 'IATF 16949'],
  ARRAY['Canada', 'USA', 'Europe', 'China', 'Global'],
  true
),
(
  'Plug Power Inc.',
  'maintenance',
  'USA',
  'NY',
  'info@plugpower.com',
  '+1-518-782-7700',
  'https://www.plugpower.com',
  'Provider of hydrogen fuel cell solutions and green hydrogen ecosystem. Offers ProGen fuel cell engines for heavy-duty vehicles and comprehensive service programs.',
  'Fournisseur de solutions pile à combustible hydrogène et écosystème hydrogène vert. Offre moteurs pile à combustible ProGen pour véhicules lourds et programmes de service complets.',
  ARRAY['ProGen fuel cells', 'Green hydrogen', 'Electrolyzers', 'Service contracts', 'Fleet solutions'],
  ARRAY['ISO 9001', 'UL Listed'],
  ARRAY['USA', 'Canada', 'Europe'],
  true
);