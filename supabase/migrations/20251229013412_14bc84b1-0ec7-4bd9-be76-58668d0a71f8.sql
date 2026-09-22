-- Add new supplier type values to the enum
ALTER TYPE supplier_type ADD VALUE IF NOT EXISTS 'charging_infrastructure';
ALTER TYPE supplier_type ADD VALUE IF NOT EXISTS 'biomethane';
ALTER TYPE supplier_type ADD VALUE IF NOT EXISTS 'diesel_biodiesel';
ALTER TYPE supplier_type ADD VALUE IF NOT EXISTS 'retrofit_services';
ALTER TYPE supplier_type ADD VALUE IF NOT EXISTS 'other';