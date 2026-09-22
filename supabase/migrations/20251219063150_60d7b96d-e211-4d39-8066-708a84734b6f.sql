-- Add fleet manager specific columns to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS function_title text,
ADD COLUMN IF NOT EXISTS fleet_size text,
ADD COLUMN IF NOT EXISTS fleet_types text[],
ADD COLUMN IF NOT EXISTS newsletter_opt_in boolean DEFAULT false;

-- Update the handle_new_user function to include new fields
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
  
  RETURN NEW;
END;
$$;