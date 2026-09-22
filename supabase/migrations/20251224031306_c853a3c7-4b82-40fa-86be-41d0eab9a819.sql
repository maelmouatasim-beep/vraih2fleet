-- Drop existing permissive write policies on reference_data_ranges
DROP POLICY IF EXISTS "Authenticated users can insert reference data" ON public.reference_data_ranges;
DROP POLICY IF EXISTS "Authenticated users can update reference data" ON public.reference_data_ranges;
DROP POLICY IF EXISTS "Authenticated users can delete reference data" ON public.reference_data_ranges;

-- Create admin-only write policies for reference_data_ranges
CREATE POLICY "Only admins can insert reference data"
ON public.reference_data_ranges
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins can update reference data"
ON public.reference_data_ranges
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins can delete reference data"
ON public.reference_data_ranges
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Drop existing permissive write policies on reference_data_conditions
DROP POLICY IF EXISTS "Authenticated users can insert conditions" ON public.reference_data_conditions;
DROP POLICY IF EXISTS "Authenticated users can update conditions" ON public.reference_data_conditions;
DROP POLICY IF EXISTS "Authenticated users can delete conditions" ON public.reference_data_conditions;

-- Create admin-only write policies for reference_data_conditions
CREATE POLICY "Only admins can insert conditions"
ON public.reference_data_conditions
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins can update conditions"
ON public.reference_data_conditions
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins can delete conditions"
ON public.reference_data_conditions
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Drop existing permissive write policy on reference_data_history
DROP POLICY IF EXISTS "Authenticated users can insert history" ON public.reference_data_history;

-- Create admin-only insert policy for reference_data_history
CREATE POLICY "Only admins can insert history"
ON public.reference_data_history
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));