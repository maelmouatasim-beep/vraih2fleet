// sync-telematics-data — deux modes d'appel, tous deux authentifiés :
// - mode "cron"  : header x-cron-secret (pg_cron), synchronise toutes les
//   connexions actives ;
// - mode "user"  : JWT vérifié, synchronise UNIQUEMENT une connexion
//   appartenant à l'utilisateur (fin de l'IDOR sur connectionId).
import { corsHeaders, handleOptions, jsonResponse } from "../_shared/cors.ts";
import {
  getUserOrThrow,
  HttpError,
  requireCronSecret,
  serviceRoleClient,
} from "../_shared/auth.ts";

const GEOTAB_API_URL = Deno.env.get('GEOTAB_API_URL') || 'https://my.geotab.com/apiv1';
const SAMSARA_API_URL = Deno.env.get('SAMSARA_API_URL') || 'https://api.samsara.com';

interface GeotabCredentials {
  sessionId: string;
  database: string;
  userName: string;
  server: string;
}

async function fetchGeotabOdometer(credentials: GeotabCredentials, deviceIds: string[]): Promise<Map<string, number>> {
  console.log(`Fetching odometer for ${deviceIds.length} Geotab devices...`);
  
  const serverUrl = credentials.server || GEOTAB_API_URL;
  const apiUrl = serverUrl.startsWith('http') ? serverUrl : `https://${serverUrl}/apiv1`;
  const odometerMap = new Map<string, number>();
  
  try {
    const toDate = new Date().toISOString();
    const fromDate = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString();
    
    // Fetch current odometer
    const currentResponse = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        method: 'Get',
        params: {
          typeName: 'StatusData',
          search: {
            diagnosticSearch: { id: 'DiagnosticOdometerAdjustmentId' },
            fromDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
            toDate,
          },
          credentials: {
            database: credentials.database,
            sessionId: credentials.sessionId,
            userName: credentials.userName,
          },
        },
      }),
    });

    const currentData = await currentResponse.json();
    const currentReadings = new Map<string, number>();
    
    if (currentData.result) {
      for (const reading of currentData.result) {
        const deviceId = reading.device.id;
        const km = reading.data / 1000;
        if (!currentReadings.has(deviceId) || km > currentReadings.get(deviceId)!) {
          currentReadings.set(deviceId, km);
        }
      }
    }

    // Fetch year-ago odometer
    const yearAgoResponse = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        method: 'Get',
        params: {
          typeName: 'StatusData',
          search: {
            diagnosticSearch: { id: 'DiagnosticOdometerAdjustmentId' },
            fromDate,
            toDate: new Date(Date.now() - 358 * 24 * 60 * 60 * 1000).toISOString(),
          },
          credentials: {
            database: credentials.database,
            sessionId: credentials.sessionId,
            userName: credentials.userName,
          },
        },
      }),
    });

    const yearAgoData = await yearAgoResponse.json();
    const yearAgoReadings = new Map<string, number>();
    
    if (yearAgoData.result) {
      for (const reading of yearAgoData.result) {
        const deviceId = reading.device.id;
        const km = reading.data / 1000;
        if (!yearAgoReadings.has(deviceId) || km < yearAgoReadings.get(deviceId)!) {
          yearAgoReadings.set(deviceId, km);
        }
      }
    }

    // Calculate annual km
    for (const [deviceId, current] of currentReadings) {
      const yearAgo = yearAgoReadings.get(deviceId);
      if (yearAgo !== undefined && current > yearAgo) {
        odometerMap.set(deviceId, Math.round(current - yearAgo));
      }
    }

    console.log(`Got odometer data for ${odometerMap.size} Geotab devices`);
  } catch (error) {
    console.error('Geotab odometer fetch error:', error);
  }

  return odometerMap;
}

async function fetchSamsaraOdometer(apiToken: string, vehicleIds: string[]): Promise<Map<string, number>> {
  console.log(`Fetching odometer for ${vehicleIds.length} Samsara vehicles...`);
  
  const odometerMap = new Map<string, number>();
  
  try {
    const endTime = new Date().toISOString();
    const startTime = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString();
    
    const historyResponse = await fetch(
      `${SAMSARA_API_URL}/fleet/vehicles/stats/history?types=obdOdometerMeters&startTime=${startTime}&endTime=${endTime}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (historyResponse.ok) {
      const historyData = await historyResponse.json();
      
      for (const vehicleHistory of historyData.data || []) {
        const readings = vehicleHistory.obdOdometerMeters || [];
        if (readings.length >= 2) {
          const firstReading = readings[0]?.value || 0;
          const lastReading = readings[readings.length - 1]?.value || 0;
          const annualKm = Math.round((lastReading - firstReading) / 1000);
          
          if (annualKm > 0) {
            odometerMap.set(vehicleHistory.id, annualKm);
          }
        }
      }
    }

    console.log(`Got odometer data for ${odometerMap.size} Samsara vehicles`);
  } catch (error) {
    console.error('Samsara odometer fetch error:', error);
  }

  return odometerMap;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return handleOptions(req);
  }

  try {
    const supabase = serviceRoleClient();

    let connectionId: string | null = null;
    try {
      const body = await req.json();
      connectionId = typeof body?.connectionId === 'string' ? body.connectionId : null;
    } catch {
      // Pas de corps : synchro globale (mode cron)
    }

    if (req.headers.get('x-cron-secret')) {
      // Mode cron : synchro de toutes les connexions actives.
      requireCronSecret(req);
    } else {
      // Mode utilisateur : JWT obligatoire + la connexion doit lui appartenir.
      const { user } = await getUserOrThrow(req);
      if (!connectionId) {
        throw new HttpError(400, 'connectionId is required');
      }
      const { data: owned } = await supabase
        .from('telematics_connections')
        .select('id')
        .eq('id', connectionId)
        .eq('user_id', user.id)
        .maybeSingle();
      if (!owned) {
        throw new HttpError(404, 'Connection not found');
      }
    }

    console.log(connectionId ? `Manual sync for one connection` : 'Scheduled sync for all connections');

    // Get active telematics connections
    let query = supabase
      .from('telematics_connections')
      .select('*')
      .eq('status', 'connected');
    
    if (connectionId) {
      query = query.eq('id', connectionId);
    }

    const { data: connections, error: connError } = await query;

    if (connError) {
      console.error('Failed to fetch connections:', connError);
      throw connError;
    }

    if (!connections || connections.length === 0) {
      console.log('No active telematics connections found');
      return jsonResponse(req, { success: true, message: 'No connections to sync', synced: 0 });
    }

    let totalUpdated = 0;

    for (const connection of connections) {
      console.log(`Processing connection: ${connection.id} (${connection.provider})`);

      // Get vehicles for this connection
      const { data: vehicles, error: vehError } = await supabase
        .from('telematics_vehicles')
        .select('id, external_id')
        .eq('connection_id', connection.id);

      if (vehError || !vehicles || vehicles.length === 0) {
        console.log(`No vehicles found for connection ${connection.id}`);
        continue;
      }

      // Decode credentials
      let credentials: any;
      try {
        credentials = JSON.parse(atob(connection.encrypted_credentials));
      } catch {
        console.error(`Failed to decode credentials for connection ${connection.id}`);
        continue;
      }

      // Fetch updated odometer data
      let odometerData: Map<string, number>;
      const externalIds = vehicles.map(v => v.external_id);

      if (connection.provider === 'geotab') {
        odometerData = await fetchGeotabOdometer(credentials, externalIds);
      } else if (connection.provider === 'samsara') {
        odometerData = await fetchSamsaraOdometer(credentials.apiToken, externalIds);
      } else {
        console.log(`Unknown provider: ${connection.provider}`);
        continue;
      }

      // Update vehicles with new odometer data
      for (const vehicle of vehicles) {
        const annualKm = odometerData.get(vehicle.external_id);
        if (annualKm && annualKm > 0) {
          const { error: updateError } = await supabase
            .from('telematics_vehicles')
            .update({ annual_km: annualKm })
            .eq('id', vehicle.id);

          if (!updateError) {
            totalUpdated++;
          }
        }
      }

      // Update connection's last_sync_at
      await supabase
        .from('telematics_connections')
        .update({ last_sync_at: new Date().toISOString() })
        .eq('id', connection.id);

      console.log(`Updated ${totalUpdated} vehicles for connection ${connection.id}`);
    }

    console.log(`Sync complete. Total vehicles updated: ${totalUpdated}`);

    return jsonResponse(req, { 
      success: true, 
      message: `Synced ${connections.length} connection(s)`,
      connectionsProcessed: connections.length,
      vehiclesUpdated: totalUpdated,
    });

  } catch (error) {
    if (error instanceof HttpError) {
      return jsonResponse(req, { success: false, error: error.message }, error.status);
    }
    console.error('Sync error:', error);
    return jsonResponse(req, { success: false, error: error instanceof Error ? error.message : 'Unknown error' }, 500);
  }
});
