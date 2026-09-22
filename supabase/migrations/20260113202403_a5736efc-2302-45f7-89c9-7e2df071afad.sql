-- Create email_leads table for calculator lead capture
CREATE TABLE public.email_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  calculator_inputs JSONB,
  calculator_results_summary JSONB,
  source TEXT DEFAULT 'calculator',
  converted_to_user BOOLEAN DEFAULT false,
  converted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.email_leads ENABLE ROW LEVEL SECURITY;

-- Anyone can insert leads (public form)
CREATE POLICY "Anyone can insert leads"
ON public.email_leads FOR INSERT
WITH CHECK (true);

-- Only admins can read leads
CREATE POLICY "Admins can read leads"
ON public.email_leads FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));