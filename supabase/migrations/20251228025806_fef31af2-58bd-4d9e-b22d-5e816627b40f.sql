-- Create enum types for incentives
CREATE TYPE public.incentive_level AS ENUM ('federal', 'provincial', 'municipal');
CREATE TYPE public.incentive_status AS ENUM ('active', 'expired', 'coming_soon');

-- Create the incentives_programs table
CREATE TABLE public.incentives_programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_name_en TEXT NOT NULL,
  program_name_fr TEXT NOT NULL,
  level incentive_level NOT NULL,
  province TEXT, -- nullable for federal programs
  amount_cad INTEGER NOT NULL,
  amount_max_cad INTEGER, -- for tiered programs
  vehicle_classes TEXT[] NOT NULL DEFAULT '{}',
  fuel_types TEXT[] NOT NULL DEFAULT '{}',
  description_en TEXT NOT NULL,
  description_fr TEXT NOT NULL,
  eligibility_criteria_en TEXT NOT NULL,
  eligibility_criteria_fr TEXT NOT NULL,
  application_url TEXT NOT NULL,
  deadline DATE, -- nullable for ongoing programs
  status incentive_status NOT NULL DEFAULT 'active',
  last_verified_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  source_url TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.incentives_programs ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Public read, admin write
CREATE POLICY "Anyone can read incentives programs"
  ON public.incentives_programs
  FOR SELECT
  USING (true);

CREATE POLICY "Only admins can insert incentives programs"
  ON public.incentives_programs
  FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Only admins can update incentives programs"
  ON public.incentives_programs
  FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Only admins can delete incentives programs"
  ON public.incentives_programs
  FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_incentives_programs_updated_at
  BEFORE UPDATE ON public.incentives_programs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_profile_updated_at();

-- Insert verified Canadian incentive programs (December 2025)
INSERT INTO public.incentives_programs (
  program_name_en, program_name_fr, level, province, amount_cad, amount_max_cad,
  vehicle_classes, fuel_types, description_en, description_fr,
  eligibility_criteria_en, eligibility_criteria_fr, application_url,
  deadline, status, last_verified_date, source_url
) VALUES
-- 1. Federal ZEVIP
(
  'Incentives for Medium- and Heavy-Duty Zero-Emission Vehicles (iMHZEV)',
  'Incitatifs pour les véhicules moyens et lourds zéro émission (iVMLZE)',
  'federal',
  NULL,
  200000,
  200000,
  ARRAY['Class 2b', 'Class 3', 'Class 4', 'Class 5', 'Class 6', 'Class 7', 'Class 8'],
  ARRAY['BEV', 'FCEV', 'PHEV'],
  'Up to $200,000 per vehicle for eligible medium and heavy-duty zero-emission vehicles purchased or leased by Canadian businesses and organizations.',
  'Jusqu''à 200 000 $ par véhicule pour les véhicules moyens et lourds zéro émission admissibles achetés ou loués par des entreprises et organisations canadiennes.',
  'Vehicle must be new, registered in Canada, have min 50km electric range for PHEV. Buyer must be Canadian business/organization. Vehicle must be on approved list.',
  'Le véhicule doit être neuf, immatriculé au Canada, avoir une autonomie électrique min de 50km pour PHEV. L''acheteur doit être une entreprise/organisation canadienne. Le véhicule doit figurer sur la liste approuvée.',
  'https://tc.canada.ca/en/road-transportation/innovative-technologies/zero-emission-vehicles/medium-heavy-duty-zero-emission-vehicles/how-apply-incentives-program-medium-heavy-duty-zero-emission-vehicles',
  '2027-03-31',
  'active',
  '2025-12-27',
  'https://tc.canada.ca/en/road-transportation/innovative-technologies/zero-emission-vehicles'
),
-- 2. BC Go Electric Fleet Program
(
  'BC Go Electric Fleet Program',
  'Programme Go Electric pour flottes de la C.-B.',
  'provincial',
  'BC',
  50000,
  50000,
  ARRAY['Class 2b', 'Class 3', 'Class 4', 'Class 5', 'Class 6', 'Class 7', 'Class 8'],
  ARRAY['BEV', 'FCEV'],
  'Up to $50,000 rebate for commercial fleet vehicles. Also includes funding for charging infrastructure planning ($15,000 max) and electrical upgrades.',
  'Jusqu''à 50 000 $ de rabais pour les véhicules de flottes commerciales. Comprend également le financement de la planification des infrastructures de recharge (max 15 000 $) et des améliorations électriques.',
  'BC Hydro customer, commercial fleet operator, vehicle must be purchased or leased for min 36 months.',
  'Client de BC Hydro, exploitant de flotte commerciale, véhicule acheté ou loué pour min 36 mois.',
  'https://pluginbc.ca/go-electric-fleets/',
  NULL,
  'active',
  '2025-12-27',
  'https://www2.gov.bc.ca/gov/content/industry/electricity-alternative-energy/transportation-energies/clean-transportation-policies-programs/clean-energy-vehicle-program'
),
-- 3. Ontario Green Commercial Vehicle Program
(
  'Ontario Green Commercial Vehicle Program',
  'Programme ontarien de véhicules utilitaires écologiques',
  'provincial',
  'ON',
  75000,
  75000,
  ARRAY['Class 4', 'Class 5', 'Class 6', 'Class 7', 'Class 8'],
  ARRAY['BEV', 'FCEV'],
  'Rebates up to $75,000 for Class 8 trucks. Tiered amounts: Class 4-5 ($35K), Class 6-7 ($55K), Class 8 ($75K).',
  'Rabais jusqu''à 75 000 $ pour camions Class 8. Montants échelonnés: Class 4-5 (35K$), Class 6-7 (55K$), Class 8 (75K$).',
  'Ontario-based business, vehicle registered in ON, used for commercial purposes min 80% of time.',
  'Entreprise ontarienne, véhicule immatriculé en ON, utilisé à des fins commerciales min 80% du temps.',
  'https://www.ontario.ca/page/green-commercial-vehicle-program',
  '2026-03-31',
  'active',
  '2025-12-27',
  'https://www.ontario.ca/page/green-commercial-vehicle-program'
),
-- 4. Quebec écocamionnage
(
  'Quebec écocamionnage Program',
  'Programme écocamionnage du Québec',
  'provincial',
  'QC',
  100000,
  100000,
  ARRAY['Class 6', 'Class 7', 'Class 8'],
  ARRAY['BEV', 'FCEV'],
  'Up to $100,000 for heavy trucks. Tiered: Class 6 ($50K), Class 7 ($75K), Class 8 ($100K). Also covers conversion costs.',
  'Jusqu''à 100 000 $ pour camions lourds. Échelonné: Class 6 (50K$), Class 7 (75K$), Class 8 (100K$). Couvre aussi les coûts de conversion.',
  'Quebec business with NEQ number, vehicle used for commercial transport, min 3 year retention.',
  'Entreprise québécoise avec numéro NEQ, véhicule utilisé pour transport commercial, rétention min 3 ans.',
  'https://www.transports.gouv.qc.ca/fr/aide-finan/entreprises-transport/Pages/ecocamionnage.aspx',
  NULL,
  'active',
  '2025-12-27',
  'https://www.transports.gouv.qc.ca/'
),
-- 5. Alberta AZETEC
(
  'Alberta Zero-Emission Truck Electrification Collaboration (AZETEC)',
  'Collaboration albertaine pour l''électrification de camions zéro émission (AZETEC)',
  'provincial',
  'AB',
  150000,
  150000,
  ARRAY['Class 7', 'Class 8'],
  ARRAY['FCEV', 'BEV'],
  'Pilot program offering up to $150,000 for hydrogen fuel cell trucks in Alberta. Focus on establishing hydrogen corridors.',
  'Programme pilote offrant jusqu''à 150 000 $ pour camions à pile à combustible à hydrogène en Alberta. Accent sur l''établissement de corridors hydrogène.',
  'Alberta-based fleet operator, vehicle must operate primarily in AB, participation in data collection program.',
  'Exploitant de flotte basé en Alberta, véhicule opérant principalement en AB, participation au programme de collecte de données.',
  'https://www.alberta.ca/clean-transportation',
  '2026-06-30',
  'active',
  '2025-12-27',
  'https://www.alberta.ca/hydrogen-roadmap.aspx'
),
-- 6. Yukon EV Rebate Program
(
  'Yukon Electric Vehicle Rebate Program',
  'Programme de rabais pour véhicules électriques du Yukon',
  'provincial',
  'YT',
  5000,
  5000,
  ARRAY['Light-duty commercial'],
  ARRAY['BEV', 'FCEV', 'PHEV'],
  '$5,000 for businesses/organizations purchasing light-duty electric vehicles with min 50km range.',
  '5 000 $ pour entreprises/organisations achetant véhicules électriques légers avec autonomie min 50km.',
  'Yukon-based organization, vehicle registered in YT, new vehicle only.',
  'Organisation basée au Yukon, véhicule immatriculé au YT, véhicule neuf seulement.',
  'https://yukon.ca/en/energy-mines-and-resources/energy/ev-rebate-program',
  '2025-03-15',
  'active',
  '2025-12-27',
  'https://yukon.ca/en/energy-mines-and-resources/energy/ev-rebate-program'
);