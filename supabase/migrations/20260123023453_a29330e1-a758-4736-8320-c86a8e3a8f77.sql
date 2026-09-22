-- Create unique index to prevent duplicate vehicles
CREATE UNIQUE INDEX IF NOT EXISTS telematics_vehicles_external_user_unique 
ON telematics_vehicles(external_id, user_id);

-- Add columns for reconciliation tracking if not exists
ALTER TABLE telematics_vehicles 
ADD COLUMN IF NOT EXISTS daily_km integer,
ADD COLUMN IF NOT EXISTS has_real_odometer boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS current_odometer integer,
ADD COLUMN IF NOT EXISTS last_updated_at timestamp with time zone DEFAULT now();

-- Create trigger for last_updated_at
DROP TRIGGER IF EXISTS update_telematics_vehicles_updated_at ON telematics_vehicles;
CREATE TRIGGER update_telematics_vehicles_updated_at
BEFORE UPDATE ON telematics_vehicles
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();