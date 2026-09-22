-- Fix security warnings by setting search_path on functions
CREATE OR REPLACE FUNCTION public.update_reference_last_updated()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_updated = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = public;

CREATE OR REPLACE FUNCTION public.log_reference_change()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.reference_data_history (
    reference_id,
    old_min_value, old_mid_value, old_max_value,
    new_min_value, new_mid_value, new_max_value,
    changed_by
  ) VALUES (
    OLD.id,
    OLD.min_value, OLD.mid_value, OLD.max_value,
    NEW.min_value, NEW.mid_value, NEW.max_value,
    current_user
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = public;