import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check if this is a manual sync for a specific connection
    let connectionId: string | null = null;
    try {
      const body = await req.json();
      connectionId = body.connectionId || null;
    } catch {
      // No body or invalid JSON - sync all connections
    }

    console.log(connectionId ? `Manual sync for connection: ${connectionId}` : 'Scheduled sync for all connections');

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
      return new Response(
        JSON.stringify({ success: true, message: 'No connections to sync', synced: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
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

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Synced ${connections.length} connection(s)`,
        connectionsProcessed: connections.length,
        vehiclesUpdated: totalUpdated,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Sync error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
