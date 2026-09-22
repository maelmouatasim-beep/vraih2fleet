import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { provider, database, username, password } = await req.json();

    console.log(`Authenticating with provider: ${provider}`);

    if (!provider || !username || !password) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let authResult: { success: boolean; credentials?: string; error?: string };

    if (provider === 'geotab') {
      // Geotab requires database field
      if (!database) {
        return new Response(
          JSON.stringify({ success: false, error: 'Database is required for Geotab' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Authenticate with Geotab API
      const geotabResponse = await fetch('https://my.geotab.com/apiv1', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          method: 'Authenticate',
          params: {
            database: database,
            userName: username,
            password: password
          }
        })
      });

      const geotabData = await geotabResponse.json();
      console.log('Geotab response:', JSON.stringify(geotabData));

      if (geotabData.result?.credentials) {
        // Encode credentials as base64 for storage
        const credentialsToStore = JSON.stringify({
          sessionId: geotabData.result.credentials.sessionId,
          database: geotabData.result.credentials.database,
          userName: geotabData.result.credentials.userName,
          server: geotabData.result.path
        });
        
        authResult = {
          success: true,
          credentials: btoa(credentialsToStore)
        };
      } else {
        authResult = {
          success: false,
          error: geotabData.error?.message || 'Geotab authentication failed'
        };
      }
    } else if (provider === 'samsara') {
      // Samsara uses API token (password field contains the token)
      const samsaraResponse = await fetch('https://api.samsara.com/fleet/drivers', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${password}`,
          'Content-Type': 'application/json'
        }
      });

      if (samsaraResponse.ok) {
        // Store the API token (already encrypted conceptually as it's the auth method)
        const credentialsToStore = JSON.stringify({
          apiToken: password
        });
        
        authResult = {
          success: true,
          credentials: btoa(credentialsToStore)
        };
      } else {
        const errorData = await samsaraResponse.json().catch(() => ({}));
        authResult = {
          success: false,
          error: errorData.message || `Samsara authentication failed (${samsaraResponse.status})`
        };
      }
    } else {
      return new Response(
        JSON.stringify({ success: false, error: 'Unsupported provider' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify(authResult),
      { status: authResult.success ? 200 : 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in authenticate-telematics:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
