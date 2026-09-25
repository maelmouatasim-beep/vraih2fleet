// authenticate-telematics — l'utilisateur réel est vérifié (getUser) :
// verify_jwt seul laisse passer la clé anon publique.
import { handleOptions, jsonResponse } from "../_shared/cors.ts";
import { getUserOrThrow, HttpError } from "../_shared/auth.ts";

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return handleOptions(req);
  }

  try {
    await getUserOrThrow(req);

    const { provider, database, username, password } = await req.json();

    console.log(`Authenticating with provider: ${provider}`);

    if (!provider || !username || !password) {
      return jsonResponse(req, { success: false, error: 'Missing required fields' }, 400);
    }

    let authResult: { success: boolean; credentials?: string; error?: string };

    if (provider === 'geotab') {
      // Geotab requires database field
      if (!database) {
        return jsonResponse(req, { success: false, error: 'Database is required for Geotab' }, 400);
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
      return jsonResponse(req, { success: false, error: 'Unsupported provider' }, 400);
    }

    return jsonResponse(req, authResult, authResult.success ? 200 : 401);

  } catch (error) {
    console.error('Error in authenticate-telematics:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return jsonResponse(req, { success: false, error: errorMessage }, 500);
  }
});
