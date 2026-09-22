-- Create subscriptions table
CREATE TABLE public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  tier text NOT NULL DEFAULT 'free' CHECK (tier IN ('free', 'small', 'medium', 'large')),
  status text NOT NULL DEFAULT 'trial' CHECK (status IN ('active', 'trial', 'canceled', 'expired')),
  fleet_size integer DEFAULT 0,
  trial_end_date timestamp with time zone,
  subscription_start_date timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- RLS policies: users can only see/manage their own subscription
CREATE POLICY "Users can view their own subscription"
ON public.subscriptions
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own subscription"
ON public.subscriptions
FOR UPDATE
USING (auth.uid() = user_id);

-- Create trigger for updated_at
CREATE TRIGGER update_subscriptions_updated_at
BEFORE UPDATE ON public.subscriptions
FOR EACH ROW
EXECUTE FUNCTION public.update_profile_updated_at();

-- Modify handle_new_user to also create a subscription record
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Create profile with extended fields
  INSERT INTO public.profiles (id, full_name, company, function_title, fleet_size, fleet_types, newsletter_opt_in)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data ->> 'full_name',
    NEW.raw_user_meta_data ->> 'company',
    NEW.raw_user_meta_data ->> 'function_title',
    NEW.raw_user_meta_data ->> 'fleet_size',
    CASE 
      WHEN NEW.raw_user_meta_data -> 'fleet_types' IS NOT NULL 
      THEN ARRAY(SELECT jsonb_array_elements_text(NEW.raw_user_meta_data -> 'fleet_types'))
      ELSE NULL 
    END,
    COALESCE((NEW.raw_user_meta_data ->> 'newsletter_opt_in')::boolean, false)
  );
  
  -- Assign default 'user' role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user');
  
  -- Create default free subscription with 14-day trial
  INSERT INTO public.subscriptions (user_id, tier, status, trial_end_date, subscription_start_date)
  VALUES (NEW.id, 'free', 'trial', now() + interval '14 days', now());
  
  RETURN NEW;
END;
$$;