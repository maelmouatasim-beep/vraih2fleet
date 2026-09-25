// fetch-telematics-vehicles — l'utilisateur réel est vérifié (getUser).
import { handleOptions, jsonResponse } from "../_shared/cors.ts";
import { getUserOrThrow, HttpError } from "../_shared/auth.ts";

// Geotab API base URL
const GEOTAB_API_URL = Deno.env.get('GEOTAB_API_URL') || 'https://my.geotab.com/apiv1';

// Samsara API base URL
const SAMSARA_API_URL = Deno.env.get('SAMSARA_API_URL') || 'https://api.samsara.com';

interface GeotabCredentials {
  sessionId: string;
  database: string;
  userName: string;
  server: string;
}

interface GeotabDevice {
  id: string;
  name: string;
  serialNumber?: string;
  vehicleIdentificationNumber?: string;
  deviceType?: string;
}

interface GeotabStatusData {
  device: { id: string };
  data: number; // odometer in meters
  dateTime: string;
}

interface SamsaraVehicle {
  id: string;
  name: string;
  vin?: string;
  make?: string;
  model?: string;
  year?: number;
  vehicleType?: string;
}

interface SamsaraVehicleStats {
  id: string;
  name: string;
  obdOdometerMeters?: { value: number; time: string };
  gpsOdometerMeters?: { value: number; time: string };
}

async function fetchGeotabVehicles(credentials: GeotabCredentials): Promise<any[]> {
  console.log('Fetching vehicles from Geotab...');
  
  const serverUrl = credentials.server || GEOTAB_API_URL;
  const apiUrl = serverUrl.startsWith('http') ? serverUrl : `https://${serverUrl}/apiv1`;
  
  // Fetch devices
  const devicesResponse = await fetch(apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      method: 'Get',
      params: {
        typeName: 'Device',
        credentials: {
          database: credentials.database,
          sessionId: credentials.sessionId,
          userName: credentials.userName,
        },
      },
    }),
  });

  const devicesData = await devicesResponse.json();
  console.log(`Geotab devices response status: ${devicesResponse.status}`);
  
  if (devicesData.error) {
    console.error('Geotab API error:', devicesData.error);
    // Detect session expiration
    const errorMsg = devicesData.error.message || devicesData.error.name || '';
    if (errorMsg.includes('InvalidCredentials') || 
        errorMsg.includes('session') || 
        errorMsg.includes('Session') ||
        errorMsg.includes('DbUnavailable')) {
      throw new Error('SESSION_EXPIRED');
    }
    throw new Error(devicesData.error.message || 'Geotab API error');
  }

  const devices: GeotabDevice[] = devicesData.result || [];
  console.log(`Fetched ${devices.length} devices from Geotab`);

  // Fetch odometer data for all devices (StatusData with diagnostic for odometer)
  // Geotab uses DiagnosticOdometerAdjustmentId for odometer readings
  const odometerDiagnosticId = 'DiagnosticOdometerAdjustmentId';
  
  // Get current date and date from 1 year ago for calculating annual km
  const toDate = new Date().toISOString();
  const fromDate = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString();
  
  // Create a map to store odometer data
  const odometerMap = new Map<string, { current: number; yearAgo: number | null }>();
  
  try {
    // Fetch current odometer readings
    const currentOdometerResponse = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        method: 'Get',
        params: {
          typeName: 'StatusData',
          search: {
            diagnosticSearch: { id: odometerDiagnosticId },
            fromDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), // Last 7 days
            toDate: toDate,
          },
          credentials: {
            database: credentials.database,
            sessionId: credentials.sessionId,
            userName: credentials.userName,
          },
        },
      }),
    });

    const currentOdometerData = await currentOdometerResponse.json();
    
    if (currentOdometerData.result) {
      // Get the most recent reading for each device
      for (const reading of currentOdometerData.result as GeotabStatusData[]) {
        const deviceId = reading.device.id;
        const odometerKm = reading.data / 1000; // Convert meters to km
        
        if (!odometerMap.has(deviceId) || odometerKm > (odometerMap.get(deviceId)?.current || 0)) {
          odometerMap.set(deviceId, { current: odometerKm, yearAgo: null });
        }
      }
    }

    // Fetch odometer readings from ~1 year ago
    const yearAgoOdometerResponse = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        method: 'Get',
        params: {
          typeName: 'StatusData',
          search: {
            diagnosticSearch: { id: odometerDiagnosticId },
            fromDate: fromDate,
            toDate: new Date(Date.now() - 358 * 24 * 60 * 60 * 1000).toISOString(), // Around 1 year ago
          },
          credentials: {
            database: credentials.database,
            sessionId: credentials.sessionId,
            userName: credentials.userName,
          },
        },
      }),
    });

    const yearAgoOdometerData = await yearAgoOdometerResponse.json();
    
    if (yearAgoOdometerData.result) {
      for (const reading of yearAgoOdometerData.result as GeotabStatusData[]) {
        const deviceId = reading.device.id;
        const odometerKm = reading.data / 1000;
        
        if (odometerMap.has(deviceId)) {
          const existing = odometerMap.get(deviceId)!;
          if (existing.yearAgo === null || odometerKm < existing.yearAgo) {
            existing.yearAgo = odometerKm;
          }
        }
      }
    }

    console.log(`Fetched odometer data for ${odometerMap.size} devices`);
  } catch (odometerError) {
    console.warn('Failed to fetch odometer data, will use estimates:', odometerError);
  }

  // Combine device info with odometer data
  return devices.map((device: GeotabDevice) => {
    const odometer = odometerMap.get(device.id);
    let annualKm: number | null = null;
    let currentOdometer: number | null = null;
    
    if (odometer) {
      currentOdometer = Math.round(odometer.current);
      if (odometer.yearAgo !== null && odometer.current > odometer.yearAgo) {
        annualKm = Math.round(odometer.current - odometer.yearAgo);
      }
    }
    
    return {
      id: device.id,
      name: device.name || 'Unknown Vehicle',
      serialNumber: device.serialNumber,
      vehicleIdentificationNumber: device.vehicleIdentificationNumber,
      deviceType: device.deviceType,
      currentOdometer,
      annualKm,
    };
  });
}

async function fetchSamsaraVehicles(apiToken: string): Promise<any[]> {
  console.log('Fetching vehicles from Samsara...');
  
  // Fetch basic vehicle info
  const vehiclesResponse = await fetch(`${SAMSARA_API_URL}/fleet/vehicles`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${apiToken}`,
      'Content-Type': 'application/json',
    },
  });

  if (!vehiclesResponse.ok) {
    const errorText = await vehiclesResponse.text();
    console.error(`Samsara API error: ${vehiclesResponse.status} - ${errorText}`);
    throw new Error(`Samsara API error: ${vehiclesResponse.status}`);
  }

  const vehiclesData = await vehiclesResponse.json();
  const vehicles: SamsaraVehicle[] = vehiclesData.data || [];
  console.log(`Fetched ${vehicles.length} vehicles from Samsara`);

  // Fetch odometer stats for all vehicles
  const odometerMap = new Map<string, { current: number; annualKm: number | null }>();
  
  try {
    // Get vehicle stats with odometer readings
    const statsResponse = await fetch(`${SAMSARA_API_URL}/fleet/vehicles/stats?types=obdOdometerMeters,gpsOdometerMeters`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (statsResponse.ok) {
      const statsData = await statsResponse.json();
      const stats: SamsaraVehicleStats[] = statsData.data || [];
      
      for (const stat of stats) {
        // Prefer OBD odometer, fallback to GPS odometer
        const odometerMeters = stat.obdOdometerMeters?.value || stat.gpsOdometerMeters?.value;
        if (odometerMeters) {
          odometerMap.set(stat.id, {
            current: Math.round(odometerMeters / 1000), // Convert to km
            annualKm: null, // Will calculate from historical data
          });
        }
      }
      
      console.log(`Fetched odometer stats for ${odometerMap.size} vehicles`);
    }

    // Fetch historical odometer to calculate annual km
    // Samsara provides /fleet/vehicles/stats/history endpoint
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
      const historyStats = historyData.data || [];
      
      for (const vehicleHistory of historyStats) {
        const readings = vehicleHistory.obdOdometerMeters || [];
        if (readings.length >= 2) {
          // Get first and last readings
          const firstReading = readings[0]?.value || 0;
          const lastReading = readings[readings.length - 1]?.value || 0;
          const annualKm = Math.round((lastReading - firstReading) / 1000);
          
          if (odometerMap.has(vehicleHistory.id) && annualKm > 0) {
            odometerMap.get(vehicleHistory.id)!.annualKm = annualKm;
          }
        }
      }
      
      console.log('Processed historical odometer data for annual km calculation');
    }
  } catch (odometerError) {
    console.warn('Failed to fetch Samsara odometer data, will use estimates:', odometerError);
  }

  // Combine vehicle info with odometer data
  return vehicles.map((vehicle: SamsaraVehicle) => {
    const odometer = odometerMap.get(vehicle.id);
    
    return {
      id: vehicle.id,
      name: vehicle.name || 'Unknown Vehicle',
      vin: vehicle.vin,
      make: vehicle.make,
      model: vehicle.model,
      year: vehicle.year,
      vehicleType: vehicle.vehicleType,
      currentOdometer: odometer?.current || null,
      annualKm: odometer?.annualKm || null,
    };
  });
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return handleOptions(req);
  }

  try {
    await getUserOrThrow(req);

    const { provider, encryptedCredentials } = await req.json();

    console.log(`Fetching vehicles with odometer data from provider: ${provider}`);

    if (!provider || !encryptedCredentials) {
      return jsonResponse(req, { success: false, error: 'Missing required fields' }, 400);
    }

    // Decode the base64 encoded credentials
    let credentials: any;
    try {
      credentials = JSON.parse(atob(encryptedCredentials));
    } catch (e) {
      console.error('Failed to decode credentials:', e);
      return jsonResponse(req, { success: false, error: 'Invalid credentials format' }, 400);
    }

    let vehicles: any[] = [];

    if (provider === 'geotab') {
      vehicles = await fetchGeotabVehicles(credentials);
    } else if (provider === 'samsara') {
      vehicles = await fetchSamsaraVehicles(credentials.apiToken);
    } else {
      return jsonResponse(req, { success: false, error: 'Unsupported provider' }, 400);
    }

    // Count vehicles with real odometer data
    const vehiclesWithOdometer = vehicles.filter(v => v.annualKm !== null).length;
    console.log(`${vehiclesWithOdometer}/${vehicles.length} vehicles have real annual km data`);

    return jsonResponse(req, { 
        success: true, 
        vehicles,
        count: vehicles.length,
        vehiclesWithOdometerData: vehiclesWithOdometer,
        provider,
      }, 200);

  } catch (error) {
    if (error instanceof HttpError) {
      return jsonResponse(req, { success: false, error: error.message }, error.status);
    }
    console.error('Error in fetch-telematics-vehicles:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    // Return 401 for session expiration to trigger reauth flow
    const isSessionExpired = errorMessage === 'SESSION_EXPIRED' || 
                             errorMessage.includes('InvalidCredentials') ||
                             errorMessage.includes('session');
    
    return jsonResponse(req, { 
        success: false, 
        error: isSessionExpired ? 'SESSION_EXPIRED' : errorMessage,
        requiresReauth: isSessionExpired
      }, isSessionExpired ? 401 : 500);
  }
});