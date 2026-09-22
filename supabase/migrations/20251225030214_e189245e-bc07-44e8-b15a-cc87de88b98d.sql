-- Create custom_reference_data table for user-specific reference data
CREATE TABLE public.custom_reference_data (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  category text NOT NULL,
  description text,
  data jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.custom_reference_data ENABLE ROW LEVEL SECURITY;

-- RLS policies: users can only manage their own custom reference data
CREATE POLICY "Users can view their own custom reference data"
ON public.custom_reference_data
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own custom reference data"
ON public.custom_reference_data
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own custom reference data"
ON public.custom_reference_data
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own custom reference data"
ON public.custom_reference_data
FOR DELETE
USING (auth.uid() = user_id);

-- Create trigger for updated_at
CREATE TRIGGER update_custom_reference_data_updated_at
BEFORE UPDATE ON public.custom_reference_data
FOR EACH ROW
EXECUTE FUNCTION public.update_profile_updated_at();