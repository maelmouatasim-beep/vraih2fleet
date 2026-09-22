import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export function useMapboxToken() {
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchToken() {
      try {
        const { data, error: fnError } = await supabase.functions.invoke('get-mapbox-token');
        
        if (fnError) {
          throw fnError;
        }
        
        if (data?.success && data?.token) {
          setToken(data.token);
        } else {
          setError(data?.error || 'Failed to fetch Mapbox token');
        }
      } catch (err) {
        console.error('Error fetching Mapbox token:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch Mapbox token');
      } finally {
        setLoading(false);
      }
    }

    fetchToken();
  }, []);

  return { token, loading, error };
}
