-- First, let's check and drop any trigger that references last_updated
-- Then recreate it with the correct column name (updated_at)

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS update_scenarios_last_updated ON public.scenarios;
DROP TRIGGER IF EXISTS update_scenarios_updated_at ON public.scenarios;

-- Recreate trigger with correct column name
CREATE TRIGGER update_scenarios_updated_at
BEFORE UPDATE ON public.scenarios
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();