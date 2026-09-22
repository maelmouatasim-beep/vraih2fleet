-- Create user_favorite_suppliers table
CREATE TABLE public.user_favorite_suppliers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  supplier_id UUID NOT NULL REFERENCES public.hydrogen_suppliers(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, supplier_id)
);

-- Enable RLS
ALTER TABLE public.user_favorite_suppliers ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own favorites"
  ON public.user_favorite_suppliers
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can add their own favorites"
  ON public.user_favorite_suppliers
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove their own favorites"
  ON public.user_favorite_suppliers
  FOR DELETE
  USING (auth.uid() = user_id);

-- Add economic columns to hydrogen_suppliers
ALTER TABLE public.hydrogen_suppliers 
ADD COLUMN IF NOT EXISTS price_range_min NUMERIC,
ADD COLUMN IF NOT EXISTS price_range_max NUMERIC,
ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'CAD',
ADD COLUMN IF NOT EXISTS warranty_years INTEGER,
ADD COLUMN IF NOT EXISTS delivery_time_weeks INTEGER,
ADD COLUMN IF NOT EXISTS vehicle_categories TEXT[] DEFAULT '{}'::text[];