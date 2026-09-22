-- Add columns to store applied energy prices for What-If analysis synchronization
ALTER TABLE tco_results 
ADD COLUMN IF NOT EXISTS applied_diesel_price NUMERIC,
ADD COLUMN IF NOT EXISTS applied_electricity_price NUMERIC,
ADD COLUMN IF NOT EXISTS applied_hydrogen_price NUMERIC;

-- Add comment for documentation
COMMENT ON COLUMN tco_results.applied_diesel_price IS 'Diesel price ($/L) used for this TCO calculation';
COMMENT ON COLUMN tco_results.applied_electricity_price IS 'Electricity price ($/kWh) used for this TCO calculation';
COMMENT ON COLUMN tco_results.applied_hydrogen_price IS 'Hydrogen price ($/kg) used for this TCO calculation';