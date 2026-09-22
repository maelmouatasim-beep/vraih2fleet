-- Ajouter les colonnes tco_savings et baseline_tco à tco_results
ALTER TABLE public.tco_results
ADD COLUMN IF NOT EXISTS tco_savings NUMERIC,
ADD COLUMN IF NOT EXISTS baseline_tco NUMERIC;

-- Créer une table pour les objectifs ESG de l'utilisateur
CREATE TABLE IF NOT EXISTS public.user_objectives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  target_zev_percent NUMERIC DEFAULT 50,
  target_year INTEGER DEFAULT 2030,
  target_co2_reduction NUMERIC DEFAULT 50,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.user_objectives ENABLE ROW LEVEL SECURITY;

-- RLS Policies pour user_objectives
CREATE POLICY "Users can view own objectives"
ON public.user_objectives FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own objectives"
ON public.user_objectives FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own objectives"
ON public.user_objectives FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own objectives"
ON public.user_objectives FOR DELETE
USING (auth.uid() = user_id);

-- Trigger pour updated_at
CREATE OR REPLACE FUNCTION public.update_user_objectives_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_objectives_timestamp
BEFORE UPDATE ON public.user_objectives
FOR EACH ROW
EXECUTE FUNCTION public.update_user_objectives_updated_at();