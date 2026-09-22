-- Create telematics_vehicles table
CREATE TABLE public.telematics_vehicles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  connection_id UUID NOT NULL REFERENCES public.telematics_connections(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  external_id TEXT NOT NULL,
  vehicle_type TEXT NOT NULL,
  make_model TEXT NOT NULL,
  annual_km INTEGER NOT NULL DEFAULT 0,
  fuel_consumption NUMERIC NOT NULL DEFAULT 0,
  route_type TEXT NOT NULL DEFAULT 'urban',
  group_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create telematics_groups table
CREATE TABLE public.telematics_groups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  vehicle_count INTEGER NOT NULL DEFAULT 0,
  avg_daily_km NUMERIC NOT NULL DEFAULT 0,
  recommended_technology TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add foreign key for group_id after telematics_groups exists
ALTER TABLE public.telematics_vehicles 
ADD CONSTRAINT telematics_vehicles_group_id_fkey 
FOREIGN KEY (group_id) REFERENCES public.telematics_groups(id) ON DELETE SET NULL;

-- Enable RLS on telematics_vehicles
ALTER TABLE public.telematics_vehicles ENABLE ROW LEVEL SECURITY;

-- Enable RLS on telematics_groups
ALTER TABLE public.telematics_groups ENABLE ROW LEVEL SECURITY;

-- RLS policies for telematics_vehicles
CREATE POLICY "Users can view their own telematics vehicles" 
ON public.telematics_vehicles 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own telematics vehicles" 
ON public.telematics_vehicles 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own telematics vehicles" 
ON public.telematics_vehicles 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own telematics vehicles" 
ON public.telematics_vehicles 
FOR DELETE 
USING (auth.uid() = user_id);

-- RLS policies for telematics_groups
CREATE POLICY "Users can view their own telematics groups" 
ON public.telematics_groups 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own telematics groups" 
ON public.telematics_groups 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own telematics groups" 
ON public.telematics_groups 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own telematics groups" 
ON public.telematics_groups 
FOR DELETE 
USING (auth.uid() = user_id);