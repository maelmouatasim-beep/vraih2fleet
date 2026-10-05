// authenticate-telematics — l'utilisateur réel est vérifié (getUser) :
// verify_jwt seul laisse passer la clé anon publique.
//
// Les identifiants obtenus du fournisseur (jeton de session Geotab, jeton
// d'API Samsara) sont CHIFFRÉS ici (AES-256-GCM, _shared/telematicsCrypto.ts)
// et enregistrés avec le client RLS de l'utilisateur. Ils ne sont JAMAIS
// renvoyés au navigateur. `enregistrer: false` = simple test de connexion.
import { handleOptions, jsonResponse } from "../_shared/cors.ts";
import { getUserOrThrow, HttpError } from "../_shared/auth.ts";
import { CleAbsenteError, chiffrer, trousseauDepuisEnv } from "../_shared/telematicsCrypto.ts";
import { z } from "npm:zod@3.23.8";

const Corps = z.object({
  provider: z.enum(["geotab", "samsara"]),
  database: z.string().trim().max(200).nullish(),
  username: z.string().trim().min(1).max(200),
  password: z.string().min(1).max(2000),
  enregistrer: z.boolean().optional().default(true),
});

/** Colonnes renvoyées au navigateur : jamais encrypted_credentials. */
const COLONNES_PUBLIQUES = "id, user_id, provider, database, username, status, last_sync_at, created_at, updated_at";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return handleOptions(req);
  }

  try {
    const { user, supabase } = await getUserOrThrow(req);

    const lu = Corps.safeParse(await req.json().catch(() => null));
    if (!lu.success) {
      return jsonResponse(req, { success: false, error: "Missing required fields" }, 400);
    }
    const { provider, database, username, password, enregistrer } = lu.data;

    // Clé vérifiée AVANT d'appeler le fournisseur : pas d'authentification
    // inutile si rien ne pourra être enregistré.
    const trousseau = enregistrer ? await trousseauDepuisEnv() : null;

    console.log(`Authenticating with provider: ${provider}`);

    let identifiants: Record<string, unknown> | null = null;
    let erreur: string | null = null;

    if (provider === "geotab") {
      if (!database) {
        return jsonResponse(req, { success: false, error: "Database is required for Geotab" }, 400);
      }
      const geotabResponse = await fetch("https://my.geotab.com/apiv1", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ method: "Authenticate", params: { database, userName: username, password } }),
      });
      const geotabData = await geotabResponse.json();
      if (geotabData.result?.credentials) {
        identifiants = {
          sessionId: geotabData.result.credentials.sessionId,
          database: geotabData.result.credentials.database,
          userName: geotabData.result.credentials.userName,
          server: geotabData.result.path,
        };
      } else {
        erreur = geotabData.error?.message || "Geotab authentication failed";
      }
    } else {
      // Samsara : le jeton d'API est saisi dans le champ mot de passe.
      const samsaraResponse = await fetch("https://api.samsara.com/fleet/drivers", {
        method: "GET",
        headers: { Authorization: `Bearer ${password}`, "Content-Type": "application/json" },
      });
      if (samsaraResponse.ok) {
        identifiants = { apiToken: password };
      } else {
        const errorData = await samsaraResponse.json().catch(() => ({}));
        erreur = errorData.message || `Samsara authentication failed (${samsaraResponse.status})`;
      }
    }

    if (!identifiants) {
      return jsonResponse(req, { success: false, error: erreur }, 401);
    }
    if (!trousseau) {
      return jsonResponse(req, { success: true }, 200);
    }

    const { data: connection, error: eEcriture } = await supabase
      .from("telematics_connections")
      .upsert(
        {
          user_id: user.id,
          provider,
          database: provider === "geotab" ? database : null,
          username,
          encrypted_credentials: await chiffrer(identifiants, { userId: user.id, provider }, trousseau),
          status: "connected",
          last_sync_at: new Date().toISOString(),
        },
        { onConflict: "user_id,provider" },
      )
      .select(COLONNES_PUBLIQUES)
      .single();
    if (eEcriture) throw eEcriture;

    return jsonResponse(req, { success: true, connection }, 200);
  } catch (error) {
    if (error instanceof CleAbsenteError) {
      return jsonResponse(req, { success: false, error: "service_non_configure", service: "telematique" }, 503);
    }
    if (error instanceof HttpError) {
      return jsonResponse(req, { success: false, error: error.message }, error.status);
    }
    console.error("Error in authenticate-telematics:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return jsonResponse(req, { success: false, error: errorMessage }, 500);
  }
});
