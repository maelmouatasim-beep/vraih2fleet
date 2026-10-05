// get-mapbox-token — jeton PUBLIC Mapbox (préfixe « pk. ») pour les cartes.
// Aligné sur _shared/ : utilisateur réel vérifié (getUserOrThrow), CORS
// limité à ALLOWED_ORIGINS (plus de « * »), 503 propre si non configuré.
// Un jeton secret (« sk. ») n'est jamais renvoyé, même mal configuré.
import { handleOptions, jsonResponse } from "../_shared/cors.ts";
import { getUserOrThrow, HttpError } from "../_shared/auth.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return handleOptions(req);

  try {
    await getUserOrThrow(req);

    const mapboxToken = Deno.env.get("MAPBOX_PUBLIC_TOKEN");
    if (!mapboxToken) {
      // Service non branché : 503 explicite (voir src/lib/serviceNonConfigure.ts).
      return jsonResponse(req, { success: false, error: "service_non_configure" }, 503);
    }
    if (!mapboxToken.startsWith("pk.")) {
      console.error("MAPBOX_PUBLIC_TOKEN n'est pas un jeton public (pk.) : refusé");
      return jsonResponse(req, { success: false, error: "service_non_configure" }, 503);
    }

    return jsonResponse(req, { success: true, token: mapboxToken });
  } catch (error) {
    if (error instanceof HttpError) {
      return jsonResponse(req, { success: false, error: error.message }, error.status);
    }
    console.error("Error in get-mapbox-token:", error);
    return jsonResponse(req, { success: false, error: "Unknown error" }, 500);
  }
});
