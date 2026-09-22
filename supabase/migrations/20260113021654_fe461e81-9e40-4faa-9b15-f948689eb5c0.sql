-- =====================================================
-- REFERENCE DATA UPDATE - January 2025
-- Verified sources from Canadian government and industry
-- =====================================================

-- 1. FUEL PRICES - Diesel Canada (Kalibrate Nov 2025)
UPDATE reference_data_ranges 
SET min_value = 1.35, mid_value = 1.58, max_value = 1.90,
    confidence_level = 'very_high',
    source_url = 'https://kalibrate.com/insights/blog/fuel-pricing/november-2025-kalibrates-canadian-petroleum-price-snapshot/',
    last_updated = NOW(),
    date_effective = '2025-11-01'
WHERE category = 'fuel_prices' AND subcategory = 'Diesel' AND region = 'Canada';

UPDATE reference_data_ranges 
SET min_value = 1.35, mid_value = 1.58, max_value = 1.90,
    confidence_level = 'very_high',
    source_url = 'https://kalibrate.com/insights/blog/fuel-pricing/november-2025-kalibrates-canadian-petroleum-price-snapshot/',
    last_updated = NOW(),
    date_effective = '2025-11-01'
WHERE category = 'fuel_prices' AND subcategory = 'Diesel' AND region LIKE 'CA_%';

-- 2. ELECTRICITY - Grid prices by province (July 2025)
UPDATE reference_data_ranges 
SET min_value = 0.20, mid_value = 0.258, max_value = 0.30,
    confidence_level = 'very_high',
    source_url = 'https://www.offgridsolarsystem.ca/blog/Canada-electricity-rates.html',
    last_updated = NOW(),
    date_effective = '2025-07-01'
WHERE category = 'electricity' AND subcategory = 'Grid' AND region = 'CA_AB';

UPDATE reference_data_ranges 
SET min_value = 0.117, mid_value = 0.129, max_value = 0.141,
    confidence_level = 'very_high',
    source_url = 'https://www.offgridsolarsystem.ca/blog/Canada-electricity-rates.html',
    last_updated = NOW(),
    date_effective = '2025-07-01'
WHERE category = 'electricity' AND subcategory = 'Grid' AND region = 'CA_BC';

UPDATE reference_data_ranges 
SET min_value = 0.09, mid_value = 0.102, max_value = 0.11,
    confidence_level = 'very_high',
    source_url = 'https://www.offgridsolarsystem.ca/blog/Canada-electricity-rates.html',
    last_updated = NOW(),
    date_effective = '2025-07-01'
WHERE category = 'electricity' AND subcategory = 'Grid' AND region = 'CA_MB';

UPDATE reference_data_ranges 
SET min_value = 0.12, mid_value = 0.141, max_value = 0.16,
    confidence_level = 'very_high',
    source_url = 'https://www.offgridsolarsystem.ca/blog/Canada-electricity-rates.html',
    last_updated = NOW(),
    date_effective = '2025-07-01'
WHERE category = 'electricity' AND subcategory = 'Grid' AND region = 'CA_ON';

UPDATE reference_data_ranges 
SET min_value = 0.07, mid_value = 0.078, max_value = 0.09,
    confidence_level = 'very_high',
    source_url = 'https://www.offgridsolarsystem.ca/blog/Canada-electricity-rates.html',
    last_updated = NOW(),
    date_effective = '2025-07-01'
WHERE category = 'electricity' AND subcategory = 'Grid' AND region = 'CA_QC';

UPDATE reference_data_ranges 
SET min_value = 0.10, mid_value = 0.144, max_value = 0.20,
    confidence_level = 'very_high',
    source_url = 'https://www.offgridsolarsystem.ca/blog/Canada-electricity-rates.html',
    last_updated = NOW(),
    date_effective = '2025-07-01'
WHERE category = 'electricity' AND subcategory = 'Grid' AND region = 'Canada';

-- Insert missing provinces for electricity
INSERT INTO reference_data_ranges (category, subcategory, region, min_value, mid_value, max_value, unit, confidence_level, source_url, date_effective, last_updated)
VALUES 
  ('electricity', 'Grid', 'CA_SK', 0.18, 0.199, 0.22, 'CAD/kWh', 'very_high', 'https://www.offgridsolarsystem.ca/blog/Canada-electricity-rates.html', '2025-07-01', NOW()),
  ('electricity', 'Grid', 'CA_NB', 0.12, 0.139, 0.15, 'CAD/kWh', 'very_high', 'https://www.offgridsolarsystem.ca/blog/Canada-electricity-rates.html', '2025-07-01', NOW()),
  ('electricity', 'Grid', 'CA_NS', 0.16, 0.183, 0.20, 'CAD/kWh', 'very_high', 'https://www.offgridsolarsystem.ca/blog/Canada-electricity-rates.html', '2025-07-01', NOW()),
  ('electricity', 'Grid', 'CA_NL', 0.13, 0.148, 0.16, 'CAD/kWh', 'very_high', 'https://www.offgridsolarsystem.ca/blog/Canada-electricity-rates.html', '2025-07-01', NOW()),
  ('electricity', 'Grid', 'CA_PE', 0.16, 0.184, 0.20, 'CAD/kWh', 'very_high', 'https://www.offgridsolarsystem.ca/blog/Canada-electricity-rates.html', '2025-07-01', NOW())
ON CONFLICT DO NOTHING;

-- Update charger costs
UPDATE reference_data_ranges 
SET min_value = 75000, mid_value = 100000, max_value = 125000,
    confidence_level = 'very_high',
    source_url = 'https://natural-resources.canada.ca/energy-efficiency/transportation-alternative-fuels/zero-emission-vehicle-infrastructure-program/21876',
    last_updated = NOW()
WHERE category = 'electricity' AND subcategory = 'charger_dcfc_cost';

UPDATE reference_data_ranges 
SET min_value = 5000, mid_value = 7500, max_value = 10000,
    confidence_level = 'high',
    source_url = 'https://natural-resources.canada.ca/energy-efficiency/transportation-alternative-fuels/zero-emission-vehicle-infrastructure-program/21876',
    last_updated = NOW()
WHERE category = 'electricity' AND subcategory = 'charger_level2_cost';

-- 3. HYDROGEN - Delete LOW confidence retail entries
DELETE FROM reference_data_ranges 
WHERE category = 'hydrogen' AND subcategory = 'Retail 2025' AND confidence_level = 'low';

-- Insert verified hydrogen prices
INSERT INTO reference_data_ranges (category, subcategory, region, min_value, mid_value, max_value, unit, confidence_level, source_url, date_effective, last_updated)
VALUES 
  ('hydrogen', 'Retail 2025', 'CA_BC', 13.00, 14.70, 16.00, 'CAD/kg', 'very_high', 'https://www.htec.ca/faqs/', '2025-01-01', NOW()),
  ('hydrogen', 'Retail 2025', 'CA_ON', 12.00, 15.00, 18.00, 'CAD/kg', 'medium', 'https://h2iq.org/how-much-does-hydrogen-cost/', '2025-01-01', NOW()),
  ('hydrogen', 'Retail 2025', 'CA_QC', 12.00, 14.00, 16.00, 'CAD/kg', 'medium', 'https://h2iq.org/how-much-does-hydrogen-cost/', '2025-01-01', NOW())
ON CONFLICT DO NOTHING;

-- Update h2_station_cost
UPDATE reference_data_ranges 
SET min_value = 800000, mid_value = 1500000, max_value = 3000000,
    confidence_level = 'high',
    source_url = 'https://cleantechnica.com/2025/02/05/canadas-hydrogen-bus-trials-canceled-due-to-high-costs-emissions/',
    last_updated = NOW()
WHERE category = 'hydrogen' AND subcategory = 'h2_station_cost';

-- Update Production 2030 projection
UPDATE reference_data_ranges 
SET min_value = 2.00, mid_value = 2.50, max_value = 3.00,
    confidence_level = 'high',
    source_url = 'https://www.iea.org/reports/global-hydrogen-review-2024',
    last_updated = NOW()
WHERE category = 'hydrogen' AND subcategory = 'Production 2030';

-- Insert Production Cost 2025 Global
INSERT INTO reference_data_ranges (category, subcategory, region, min_value, mid_value, max_value, unit, confidence_level, source_url, date_effective, last_updated)
VALUES ('hydrogen', 'Production 2025', 'Global', 4.00, 5.50, 7.00, 'USD/kg', 'high', 'https://www.iea.org/reports/global-hydrogen-review-2024', '2025-01-01', NOW())
ON CONFLICT DO NOTHING;

-- 4. VEHICLES - Insert new vehicle costs
INSERT INTO reference_data_ranges (category, subcategory, region, min_value, mid_value, max_value, unit, confidence_level, source_url, date_effective, last_updated)
VALUES 
  ('vehicles', 'Electric Pickup', 'Canada', 63000, 90000, 120000, 'CAD', 'very_high', 'https://www.ford.ca/trucks/f150-lightning/', '2025-01-01', NOW()),
  ('vehicles', 'Electric Truck MD', 'Canada', 115000, 152500, 190000, 'CAD', 'very_high', 'https://electricautonomy.ca/automakers/2024-11-19/isuzu-nrr-ev-truck-approved-for-sale-in-canada/', '2025-01-01', NOW()),
  ('vehicles', 'Diesel Bus', 'Canada', 750000, 800000, 850000, 'CAD', 'very_high', 'https://www.cbc.ca/news/canada/manitoba/winnipeg-transit-unveils-first-zero-emission-fuel-cell-bus-1.7463420', '2025-02-01', NOW()),
  ('vehicles', 'Electric Bus', 'Canada', 1400000, 1560000, 1700000, 'CAD', 'very_high', 'https://www.cbc.ca/news/canada/manitoba/winnipeg-transit-unveils-first-zero-emission-fuel-cell-bus-1.7463420', '2025-02-01', NOW()),
  ('vehicles', 'H2 Bus', 'Canada', 1800000, 1900000, 2000000, 'CAD', 'very_high', 'https://www.cbc.ca/news/canada/manitoba/winnipeg-transit-unveils-first-zero-emission-fuel-cell-bus-1.7463420', '2025-02-01', NOW()),
  ('vehicles', 'maintenance_diesel', 'Canada', 0.08, 0.10, 0.12, 'CAD/km', 'high', 'https://www.tc.gc.ca/', '2025-01-01', NOW()),
  ('vehicles', 'maintenance_electric', 'Canada', 0.04, 0.05, 0.06, 'CAD/km', 'high', 'https://www.tc.gc.ca/', '2025-01-01', NOW()),
  ('vehicles', 'maintenance_hydrogen', 'Canada', 0.07, 0.085, 0.10, 'CAD/km', 'high', 'https://cleantechnica.com/2025/02/05/canadas-hydrogen-bus-trials-canceled-due-to-high-costs-emissions/', '2025-01-01', NOW())
ON CONFLICT DO NOTHING;

-- 5. CO2 FACTORS - Update with ECCC 2025 data
UPDATE reference_data_ranges 
SET min_value = 0.470, mid_value = 0.490, max_value = 0.510,
    confidence_level = 'very_high',
    source_url = 'https://publications.gc.ca/collections/collection_2025/eccc/En84-294-2025-eng.pdf',
    last_updated = NOW(),
    date_effective = '2025-10-01'
WHERE category = 'co2_factors' AND subcategory LIKE '%Grid%' AND region = 'CA_AB';

UPDATE reference_data_ranges 
SET min_value = 0.010, mid_value = 0.015, max_value = 0.020,
    confidence_level = 'very_high',
    source_url = 'https://publications.gc.ca/collections/collection_2025/eccc/En84-294-2025-eng.pdf',
    last_updated = NOW(),
    date_effective = '2025-10-01'
WHERE category = 'co2_factors' AND subcategory LIKE '%Grid%' AND region = 'CA_BC';

UPDATE reference_data_ranges 
SET min_value = 0.0010, mid_value = 0.0014, max_value = 0.0020,
    confidence_level = 'very_high',
    source_url = 'https://publications.gc.ca/collections/collection_2025/eccc/En84-294-2025-eng.pdf',
    last_updated = NOW(),
    date_effective = '2025-10-01'
WHERE category = 'co2_factors' AND subcategory LIKE '%Grid%' AND region = 'CA_MB';

UPDATE reference_data_ranges 
SET min_value = 0.025, mid_value = 0.030, max_value = 0.035,
    confidence_level = 'very_high',
    source_url = 'https://publications.gc.ca/collections/collection_2025/eccc/En84-294-2025-eng.pdf',
    last_updated = NOW(),
    date_effective = '2025-10-01'
WHERE category = 'co2_factors' AND subcategory LIKE '%Grid%' AND region = 'CA_ON';

UPDATE reference_data_ranges 
SET min_value = 0.0010, mid_value = 0.0015, max_value = 0.0020,
    confidence_level = 'very_high',
    source_url = 'https://publications.gc.ca/collections/collection_2025/eccc/En84-294-2025-eng.pdf',
    last_updated = NOW(),
    date_effective = '2025-10-01'
WHERE category = 'co2_factors' AND subcategory LIKE '%Grid%' AND region = 'CA_QC';

-- Insert SK CO2 factor
INSERT INTO reference_data_ranges (category, subcategory, region, min_value, mid_value, max_value, unit, confidence_level, source_url, date_effective, last_updated)
VALUES ('co2_factors', 'Electricity Grid', 'CA_SK', 0.650, 0.670, 0.690, 'kgCO2e/kWh', 'very_high', 'https://publications.gc.ca/collections/collection_2025/eccc/En84-294-2025-eng.pdf', '2025-10-01', NOW())
ON CONFLICT DO NOTHING;

-- 6. NEW CATEGORIES - Subsidies
INSERT INTO reference_data_ranges (category, subcategory, region, min_value, mid_value, max_value, unit, confidence_level, source_url, date_effective, last_updated)
VALUES 
  ('vehicles', 'iMHZEV Rebate', 'Canada', 50000, 75000, 75000, 'CAD', 'very_high', 'https://tc.canada.ca/en/road-transportation/innovative-technologies/zero-emission-vehicles/imhzev', '2025-01-01', NOW()),
  ('electricity', 'ZEVIP Grant', 'Canada', 0, 0.50, 0.50, 'ratio', 'very_high', 'https://natural-resources.canada.ca/energy-efficiency/transportation-alternative-fuels/zero-emission-vehicle-infrastructure-program/21876', '2025-01-01', NOW())
ON CONFLICT DO NOTHING;

-- 7. Fuel Consumption reference data
INSERT INTO reference_data_ranges (category, subcategory, region, min_value, mid_value, max_value, unit, confidence_level, source_url, date_effective, last_updated)
VALUES 
  ('fuel_prices', 'Consumption Diesel HD', 'Canada', 30, 35, 40, 'L/100km', 'high', 'https://www.tc.gc.ca/', '2025-01-01', NOW()),
  ('fuel_prices', 'Consumption Hydrogen HD', 'Canada', 8, 10, 12, 'kg/100km', 'high', 'https://www.tc.gc.ca/', '2025-01-01', NOW()),
  ('fuel_prices', 'Consumption Electric HD', 'Canada', 150, 175, 200, 'kWh/100km', 'high', 'https://www.tc.gc.ca/', '2025-01-01', NOW())
ON CONFLICT DO NOTHING;