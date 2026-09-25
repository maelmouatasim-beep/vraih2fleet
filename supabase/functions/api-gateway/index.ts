// api-gateway — API publique REPORTÉE : derrière FEATURE_PUBLIC_API
// (404 pour tout appel quand le drapeau est absent/false).
// Corrections dormantes : recherche de clé par hash (l'UI stockait un
// key_prefix de 8 caractères, le gateway en cherchait 12) et anti-SSRF sur
// les livraisons de webhooks (https public uniquement).
import { createClient } from "npm:@supabase/supabase-js@2.49.4";
import { isPublicApiEnabled } from "../_shared/auth.ts";
import { safeHttpsUrl } from "../_shared/validation.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-api-key, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
};

// Helper pour réponses JSON
function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function jsonError(status: number, message: string, code?: string) {
  return jsonResponse({ error: { message, code: code || "error" } }, status);
}

// Hash SHA-256 pour validation clé API
async function hashKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Vérifier si un scope est autorisé
function hasScope(keyScopes: string[], requiredScope: string): boolean {
  return keyScopes.includes(requiredScope) || keyScopes.includes("*");
}

// Type pour le client Supabase
// deno-lint-ignore no-explicit-any
type SupabaseClient = any;

Deno.serve(async (req) => {
  // API publique désactivée par défaut : ne rien révéler.
  if (!isPublicApiEnabled()) {
    return new Response("Not Found", { status: 404 });
  }

  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    // 1. Extraire et valider la clé API
    const apiKey = req.headers.get("x-api-key");
    if (!apiKey) {
      return jsonError(401, "Missing API key. Include x-api-key header.", "missing_api_key");
    }

    if (!apiKey.startsWith("h2f_")) {
      return jsonError(401, "Invalid API key format.", "invalid_key_format");
    }

    // Recherche par hash uniquement : le key_prefix n'est qu'un indicatif
    // d'affichage (des enregistrements historiques en ont 8 caractères).
    const keyHash = await hashKey(apiKey);

    const { data: keyRecord, error: keyError } = await supabase
      .from("api_keys")
      .select("*")
      .eq("key_hash", keyHash)
      .eq("is_active", true)
      .single();

    if (keyError || !keyRecord) {
      return jsonError(401, "Invalid or inactive API key.", "invalid_api_key");
    }

    // 2. Vérifier rate limit
    const hourAgo = new Date(Date.now() - 3600000);
    const lastReset = new Date(keyRecord.last_reset_at);
    const rateLimit = keyRecord.rate_limit_per_hour || 100;
    
    if (lastReset < hourAgo) {
      // Reset counter
      await supabase
        .from("api_keys")
        .update({ 
          request_count: 1, 
          last_reset_at: new Date().toISOString(),
          last_used_at: new Date().toISOString()
        })
        .eq("id", keyRecord.id);
    } else if ((keyRecord.request_count || 0) >= rateLimit) {
      return jsonError(429, `Rate limit exceeded. Limit: ${rateLimit} requests/hour.`, "rate_limit_exceeded");
    } else {
      await supabase
        .from("api_keys")
        .update({ 
          request_count: (keyRecord.request_count || 0) + 1,
          last_used_at: new Date().toISOString()
        })
        .eq("id", keyRecord.id);
    }

    // 3. Router vers le bon handler
    const url = new URL(req.url);
    const path = url.pathname.replace("/api-gateway", "").replace(/^\/+/, "");
    const pathParts = path.split("/").filter(Boolean);
    const method = req.method;
    const scopes: string[] = keyRecord.scopes || ["read:scenarios", "read:results"];
    const userId = keyRecord.user_id;

    // GET /projects
    if (method === "GET" && pathParts[0] === "projects" && pathParts.length === 1) {
      if (!hasScope(scopes, "read:projects")) {
        return jsonError(403, "Scope 'read:projects' required.", "insufficient_scope");
      }
      return await handleGetProjects(supabase, userId, url);
    }

    // GET /scenarios
    if (method === "GET" && pathParts[0] === "scenarios" && pathParts.length === 1) {
      if (!hasScope(scopes, "read:scenarios")) {
        return jsonError(403, "Scope 'read:scenarios' required.", "insufficient_scope");
      }
      return await handleGetScenarios(supabase, userId, url);
    }

    // GET /scenarios/:id
    if (method === "GET" && pathParts[0] === "scenarios" && pathParts.length === 2 && pathParts[1] !== "results") {
      if (!hasScope(scopes, "read:scenarios")) {
        return jsonError(403, "Scope 'read:scenarios' required.", "insufficient_scope");
      }
      return await handleGetScenarioById(supabase, userId, pathParts[1]);
    }

    // GET /scenarios/:id/results
    if (method === "GET" && pathParts[0] === "scenarios" && pathParts.length === 3 && pathParts[2] === "results") {
      if (!hasScope(scopes, "read:results")) {
        return jsonError(403, "Scope 'read:results' required.", "insufficient_scope");
      }
      return await handleGetScenarioResults(supabase, userId, pathParts[1]);
    }

    // POST /scenarios
    if (method === "POST" && pathParts[0] === "scenarios" && pathParts.length === 1) {
      if (!hasScope(scopes, "write:scenarios")) {
        return jsonError(403, "Scope 'write:scenarios' required.", "insufficient_scope");
      }
      const body = await req.json();
      return await handleCreateScenario(supabase, userId, body);
    }

    // POST /scenarios/:id/calculate
    if (method === "POST" && pathParts[0] === "scenarios" && pathParts.length === 3 && pathParts[2] === "calculate") {
      if (!hasScope(scopes, "trigger:calculate")) {
        return jsonError(403, "Scope 'trigger:calculate' required.", "insufficient_scope");
      }
      return await handleCalculateScenario(supabase, supabaseUrl, serviceRoleKey, userId, pathParts[1]);
    }

    // GET /reference-data
    if (method === "GET" && pathParts[0] === "reference-data" && pathParts.length === 1) {
      if (!hasScope(scopes, "read:reference")) {
        return jsonError(403, "Scope 'read:reference' required.", "insufficient_scope");
      }
      return await handleGetReferenceData(supabase, url);
    }

    // Route non trouvée
    return jsonError(404, `Endpoint not found: ${method} /${path}`, "not_found");

  } catch (error) {
    console.error("API Gateway error:", error);
    return jsonError(500, "Internal server error.", "internal_error");
  }
});

// ============== HANDLERS ==============

async function handleGetProjects(supabase: SupabaseClient, userId: string, url: URL) {
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "20"), 100);
  const offset = parseInt(url.searchParams.get("offset") || "0");

  const { data: projects, error, count } = await supabase
    .from("projects")
    .select("id, name, country, currency, created_at, updated_at", { count: "exact" })
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    return jsonError(500, "Failed to fetch projects.", "db_error");
  }

  // Compter les scénarios par projet
  const projectsWithCounts = await Promise.all(
    (projects || []).map(async (project: { id: string; name: string; country: string; currency: string; created_at: string; updated_at: string }) => {
      const { count: scenariosCount } = await supabase
        .from("scenarios")
        .select("id", { count: "exact", head: true })
        .eq("project_id", project.id);
      
      return {
        ...project,
        scenarios_count: scenariosCount || 0,
      };
    })
  );

  return jsonResponse({
    data: projectsWithCounts,
    meta: { total: count || 0, limit, offset },
  });
}

async function handleGetScenarios(supabase: SupabaseClient, userId: string, url: URL) {
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "20"), 100);
  const offset = parseInt(url.searchParams.get("offset") || "0");
  const projectId = url.searchParams.get("project_id");

  // D'abord récupérer les projets de l'utilisateur
  const { data: userProjects } = await supabase
    .from("projects")
    .select("id")
    .eq("user_id", userId);

  const projectIds = (userProjects || []).map((p: { id: string }) => p.id);

  if (projectIds.length === 0) {
    return jsonResponse({ data: [], meta: { total: 0, limit, offset } });
  }

  let query = supabase
    .from("scenarios")
    .select("id, project_id, name, description, region, analysis_years, discount_rate, fleet_composition, created_at, updated_at", { count: "exact" })
    .in("project_id", projectIds)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (projectId) {
    query = query.eq("project_id", projectId);
  }

  const { data: scenarios, error, count } = await query;

  if (error) {
    return jsonError(500, "Failed to fetch scenarios.", "db_error");
  }

  // Vérifier si chaque scénario a des résultats
  interface ScenarioRow {
    id: string;
    project_id: string;
    name: string;
    description: string | null;
    region: string;
    analysis_years: number;
    discount_rate: number;
    fleet_composition: Record<string, { count?: number }>;
    created_at: string;
    updated_at: string;
  }

  const scenariosWithMeta = await Promise.all(
    (scenarios || []).map(async (scenario: ScenarioRow) => {
      const { count: resultsCount } = await supabase
        .from("tco_results")
        .select("id", { count: "exact", head: true })
        .eq("scenario_id", scenario.id);

      const fleet = scenario.fleet_composition || {};
      
      return {
        id: scenario.id,
        project_id: scenario.project_id,
        name: scenario.name,
        description: scenario.description,
        region: scenario.region,
        analysis_years: scenario.analysis_years,
        discount_rate: scenario.discount_rate,
        fleet_summary: {
          diesel: fleet?.diesel?.count || 0,
          ev: fleet?.ev?.count || 0,
          hydrogen: fleet?.hydrogen?.count || 0,
          total: (fleet?.diesel?.count || 0) + (fleet?.ev?.count || 0) + (fleet?.hydrogen?.count || 0),
        },
        has_results: (resultsCount || 0) > 0,
        created_at: scenario.created_at,
        updated_at: scenario.updated_at,
      };
    })
  );

  return jsonResponse({
    data: scenariosWithMeta,
    meta: { total: count || 0, limit, offset },
  });
}

async function handleGetScenarioById(supabase: SupabaseClient, userId: string, scenarioId: string) {
  // Vérifier que le scénario appartient à l'utilisateur
  const { data: scenario, error } = await supabase
    .from("scenarios")
    .select(`
      id, project_id, name, description, region, analysis_years, discount_rate, fleet_composition, created_at, updated_at,
      projects!inner(id, user_id, name)
    `)
    .eq("id", scenarioId)
    .single();

  if (error || !scenario) {
    return jsonError(404, "Scenario not found.", "not_found");
  }

  const project = scenario.projects as { user_id: string };
  if (project.user_id !== userId) {
    return jsonError(403, "Access denied.", "forbidden");
  }

  const fleet = scenario.fleet_composition as Record<string, { count?: number; annualKm?: number }>;

  return jsonResponse({
    data: {
      id: scenario.id,
      project_id: scenario.project_id,
      name: scenario.name,
      description: scenario.description,
      region: scenario.region,
      analysis_years: scenario.analysis_years,
      discount_rate: scenario.discount_rate,
      fleet_composition: {
        diesel: { count: fleet?.diesel?.count || 0, annual_km: fleet?.diesel?.annualKm || 0 },
        ev: { count: fleet?.ev?.count || 0, annual_km: fleet?.ev?.annualKm || 0 },
        hydrogen: { count: fleet?.hydrogen?.count || 0, annual_km: fleet?.hydrogen?.annualKm || 0 },
      },
      created_at: scenario.created_at,
      updated_at: scenario.updated_at,
    },
  });
}

async function handleGetScenarioResults(supabase: SupabaseClient, userId: string, scenarioId: string) {
  // Vérifier que le scénario appartient à l'utilisateur
  const { data: scenario, error: scenarioError } = await supabase
    .from("scenarios")
    .select(`
      id, name,
      projects!inner(id, user_id)
    `)
    .eq("id", scenarioId)
    .single();

  if (scenarioError || !scenario) {
    return jsonError(404, "Scenario not found.", "not_found");
  }

  const project = scenario.projects as { user_id: string };
  if (project.user_id !== userId) {
    return jsonError(403, "Access denied.", "forbidden");
  }

  // Récupérer les résultats les plus récents
  const { data: result, error: resultError } = await supabase
    .from("tco_results")
    .select("*")
    .eq("scenario_id", scenarioId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (resultError || !result) {
    return jsonError(404, "No results found for this scenario. Run a calculation first.", "no_results");
  }

  return jsonResponse({
    data: {
      scenario_id: scenarioId,
      scenario_name: scenario.name,
      calculated_at: result.created_at,
      summary: {
        tco_total: result.tco_total,
        tco_per_km: result.tco_per_km,
        capex: result.capex,
        opex_total: result.opex_total,
        npv: result.npv,
        payback_years: result.payback_period_years,
        residual_value: result.residual_value,
      },
      emissions: {
        co2_total_tonnes: result.co2_total,
        co2_savings_tonnes: result.co2_savings,
        co2_savings_percent: result.co2_savings_percent,
      },
      infrastructure: {
        charging_stations: result.charging_stations,
        charging_stations_cost: result.charging_stations_cost,
        h2_stations: result.h2_stations,
        h2_stations_cost: result.h2_stations_cost,
        total_infrastructure_cost: result.total_infrastructure_cost,
      },
      advanced_costs: {
        downtime_cost: result.downtime_cost,
        insurance_cost: result.insurance_cost,
        telematics_cost: result.telematics_cost,
        grid_demand_cost: result.grid_demand_cost,
        carbon_credits_value: result.carbon_credits_value,
        cold_weather_impact: result.cold_weather_impact,
      },
      by_vehicle_type: result.by_vehicle_type,
      yearly_breakdown: result.yearly_breakdown,
      applied_prices: {
        diesel: result.applied_diesel_price,
        electricity: result.applied_electricity_price,
        hydrogen: result.applied_hydrogen_price,
      },
    },
  });
}

async function handleCreateScenario(supabase: SupabaseClient, userId: string, body: unknown) {
  const input = body as {
    project_id?: string;
    name?: string;
    description?: string;
    region?: string;
    analysis_years?: number;
    discount_rate?: number;
    fleet_composition?: Record<string, { count?: number; annualKm?: number }>;
  };

  // Validation
  if (!input.project_id) {
    return jsonError(400, "project_id is required.", "validation_error");
  }
  if (!input.name) {
    return jsonError(400, "name is required.", "validation_error");
  }

  // Vérifier que le projet appartient à l'utilisateur
  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id, user_id")
    .eq("id", input.project_id)
    .single();

  if (projectError || !project) {
    return jsonError(404, "Project not found.", "not_found");
  }

  if (project.user_id !== userId) {
    return jsonError(403, "Access denied to this project.", "forbidden");
  }

  // Créer le scénario
  const fleetComposition = input.fleet_composition || {
    diesel: { count: 0, annualKm: 0 },
    ev: { count: 0, annualKm: 0 },
    hydrogen: { count: 0, annualKm: 0 },
  };

  const { data: newScenario, error: createError } = await supabase
    .from("scenarios")
    .insert({
      project_id: input.project_id,
      name: input.name,
      description: input.description || null,
      region: input.region || "CA_QC",
      analysis_years: input.analysis_years || 10,
      discount_rate: input.discount_rate || 5,
      fleet_composition: fleetComposition,
    })
    .select()
    .single();

  if (createError) {
    console.error("Create scenario error:", createError);
    return jsonError(500, "Failed to create scenario.", "db_error");
  }

  return jsonResponse(
    {
      data: {
        id: newScenario.id,
        name: newScenario.name,
        project_id: newScenario.project_id,
        created_at: newScenario.created_at,
      },
    },
    201
  );
}

async function handleCalculateScenario(
  supabase: SupabaseClient,
  supabaseUrl: string,
  serviceRoleKey: string,
  userId: string,
  scenarioId: string
) {
  // Vérifier que le scénario appartient à l'utilisateur
  const { data: scenario, error: scenarioError } = await supabase
    .from("scenarios")
    .select(`
      id, name,
      projects!inner(id, user_id)
    `)
    .eq("id", scenarioId)
    .single();

  if (scenarioError || !scenario) {
    return jsonError(404, "Scenario not found.", "not_found");
  }

  const project = scenario.projects as { user_id: string };
  if (project.user_id !== userId) {
    return jsonError(403, "Access denied.", "forbidden");
  }

  // Appeler la fonction calculate-tco existante
  const calculateResponse = await fetch(`${supabaseUrl}/functions/v1/calculate-tco`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${serviceRoleKey}`,
    },
    body: JSON.stringify({ scenarioId }),
  });

  if (!calculateResponse.ok) {
    const errorText = await calculateResponse.text();
    console.error("Calculate TCO error:", errorText);
    return jsonError(500, "Calculation failed.", "calculation_error");
  }

  const calcResult = await calculateResponse.json();

  // Récupérer les résultats sauvegardés
  const { data: result } = await supabase
    .from("tco_results")
    .select("id, tco_total, co2_savings_percent, created_at")
    .eq("scenario_id", scenarioId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  // Déclencher webhooks (async, ne pas attendre)
  triggerWebhooks(supabase, userId, "tco.calculated", {
    scenario_id: scenarioId,
    scenario_name: scenario.name,
    tco_total: result?.tco_total,
    co2_savings_percent: result?.co2_savings_percent,
  });

  return jsonResponse({
    data: {
      status: "completed",
      result_id: result?.id,
      calculated_at: result?.created_at || new Date().toISOString(),
      summary: {
        tco_total: result?.tco_total || calcResult.tco_total,
        co2_savings_percent: result?.co2_savings_percent || calcResult.co2_savings_percent,
      },
    },
  });
}

async function handleGetReferenceData(supabase: SupabaseClient, url: URL) {
  const region = url.searchParams.get("region");
  const category = url.searchParams.get("category");

  if (!region) {
    return jsonError(400, "region parameter is required.", "validation_error");
  }

  // Récupérer les prix de référence
  const { data: pricing } = await supabase
    .from("reference_pricing")
    .select("*")
    .eq("region", region)
    .or("valid_to.is.null,valid_to.gte." + new Date().toISOString().split("T")[0]);

  // Récupérer les données de référence
  let refQuery = supabase
    .from("reference_data_ranges")
    .select("*")
    .eq("region", region);

  if (category) {
    refQuery = refQuery.eq("category", category);
  }

  const { data: refData } = await refQuery;

  // Organiser les données
  const fuelPrices: Record<string, { min?: number; mid?: number; max?: number; unit: string }> = {};
  const vehicleCosts: Record<string, { min?: number; mid?: number; max?: number; unit: string }> = {};

  interface PricingRow {
    fuel_type: string;
    price_per_unit: number;
    currency: string;
  }

  (pricing || []).forEach((p: PricingRow) => {
    fuelPrices[p.fuel_type] = {
      min: p.price_per_unit * 0.9,
      mid: p.price_per_unit,
      max: p.price_per_unit * 1.1,
      unit: `${p.currency}/${p.fuel_type === "electricity" ? "kWh" : p.fuel_type === "hydrogen" ? "kg" : "L"}`,
    };
  });

  interface RefDataRow {
    category: string;
    subcategory: string;
    min_value: number;
    mid_value: number;
    max_value: number;
    unit: string;
  }

  (refData || []).forEach((r: RefDataRow) => {
    if (r.category === "vehicle_cost") {
      vehicleCosts[r.subcategory] = {
        min: r.min_value,
        mid: r.mid_value,
        max: r.max_value,
        unit: r.unit,
      };
    }
  });

  return jsonResponse({
    data: {
      region,
      fuel_prices: fuelPrices,
      vehicle_costs: vehicleCosts,
      last_updated: new Date().toISOString(),
    },
  });
}

// Fonction pour déclencher les webhooks (fire-and-forget)
async function triggerWebhooks(
  supabase: SupabaseClient,
  userId: string,
  eventType: string,
  payload: unknown
) {
  try {
    const { data: webhooks } = await supabase
      .from("webhooks")
      .select("*")
      .eq("user_id", userId)
      .eq("is_active", true)
      .contains("events", [eventType]);

    if (!webhooks || webhooks.length === 0) return;

    interface WebhookRow {
      id: string;
      url: string;
      secret: string;
      failure_count: number;
    }

    for (const webhook of webhooks as WebhookRow[]) {
      try {
        // SSRF : uniquement https vers un hôte public.
        const targetUrl = safeHttpsUrl(webhook.url);
        if (!targetUrl) {
          await supabase.from("webhook_deliveries").insert({
            webhook_id: webhook.id,
            event_type: eventType,
            payload: payload as object,
            success: false,
            response_body: "Webhook URL rejected: https public hosts only",
          });
          continue;
        }

        const body = JSON.stringify({
          event: eventType,
          timestamp: new Date().toISOString(),
          data: payload,
        });

        // Créer signature HMAC
        const encoder = new TextEncoder();
        const key = await crypto.subtle.importKey(
          "raw",
          encoder.encode(webhook.secret),
          { name: "HMAC", hash: "SHA-256" },
          false,
          ["sign"]
        );
        const signatureBuffer = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
        const signature = Array.from(new Uint8Array(signatureBuffer))
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");

        const response = await fetch(targetUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-H2Fleet-Signature": `sha256=${signature}`,
          },
          body,
        });

        // Logger le résultat
        await supabase.from("webhook_deliveries").insert({
          webhook_id: webhook.id,
          event_type: eventType,
          payload: payload as object,
          response_status: response.status,
          success: response.ok,
        });

        // Mettre à jour last_triggered_at
        await supabase
          .from("webhooks")
          .update({ 
            last_triggered_at: new Date().toISOString(),
            failure_count: response.ok ? 0 : (webhook.failure_count || 0) + 1,
          })
          .eq("id", webhook.id);

      } catch (webhookError) {
        console.error("Webhook delivery failed:", webhookError);
        await supabase.from("webhook_deliveries").insert({
          webhook_id: webhook.id,
          event_type: eventType,
          payload: payload as object,
          success: false,
          response_body: String(webhookError),
        });
      }
    }
  } catch (error) {
    console.error("Trigger webhooks error:", error);
  }
}
