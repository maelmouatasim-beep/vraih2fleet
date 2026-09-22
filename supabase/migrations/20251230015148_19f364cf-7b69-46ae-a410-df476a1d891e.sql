-- Create telematics_connections table
CREATE TABLE public.telematics_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  provider text NOT NULL CHECK (provider IN ('geotab', 'samsara')),
  database text,
  username text NOT NULL,
  encrypted_credentials text NOT NULL,
  last_sync_at timestamptz,
  status text NOT NULL DEFAULT 'disconnected' CHECK (status IN ('connected', 'disconnected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, provider)
);

-- Enable Row Level Security
ALTER TABLE public.telematics_connections ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own telematics connections"
ON public.telematics_connections
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own telematics connections"
ON public.telematics_connections
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own telematics connections"
ON public.telematics_connections
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own telematics connections"
ON public.telematics_connections
FOR DELETE
USING (auth.uid() = user_id);

-- Create trigger for updated_at
CREATE TRIGGER update_telematics_connections_updated_at
BEFORE UPDATE ON public.telematics_connections
FOR EACH ROW
EXECUTE FUNCTION public.update_profile_updated_at();