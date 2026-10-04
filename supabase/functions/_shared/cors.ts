// CORS partagé par toutes les edge functions.
//
// Les origines autorisées viennent de la variable d'environnement
// ALLOWED_ORIGINS (liste séparée par des virgules, ex. :
// "https://h2fleet.ca,https://www.h2fleet.ca,https://*.h2fleet.pages.dev").
// Une entrée « https://*.domaine » autorise UN seul niveau de sous-domaine
// en HTTPS (déploiements d'aperçu Cloudflare Pages) — jamais le domaine nu
// ni un sous-sous-domaine. Sans configuration, seuls les localhost de dev
// sont autorisés — jamais "*".

const DEV_ORIGINS = [
  "http://localhost:8080",
  "http://127.0.0.1:8080",
  "http://localhost:5173",
];

function allowedOrigins(): string[] {
  const raw = Deno.env.get("ALLOWED_ORIGINS");
  if (!raw) return DEV_ORIGINS;
  return raw
    .split(",")
    .map((o) => o.trim().replace(/\/+$/, ""))
    .filter(Boolean);
}

/** L'origine est-elle dans la liste (entrées exactes ou « https://*.domaine ») ? */
export function origineAutorisee(origin: string, liste: string[] = allowedOrigins()): boolean {
  if (!origin) return false;
  for (const entree of liste) {
    if (entree === origin) return true;
    const m = /^https:\/\/\*\.([a-z0-9.-]+)$/i.exec(entree);
    if (!m) continue;
    const suffixe = `.${m[1].toLowerCase()}`;
    const o = /^https:\/\/([a-z0-9-]+)(\.[a-z0-9.-]+)$/i.exec(origin);
    if (o && o[2].toLowerCase() === suffixe) return true;
  }
  return false;
}

/**
 * En-têtes CORS pour la requête donnée. L'origine n'est renvoyée que si elle
 * est dans la liste blanche ; sinon aucun Access-Control-Allow-Origin n'est
 * émis (le navigateur bloque alors la lecture de la réponse).
 */
export function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin")?.replace(/\/+$/, "") ?? "";
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-cron-secret, x-internal-secret",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    Vary: "Origin",
  };
  if (origineAutorisee(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }
  return headers;
}

/** Réponse au préflight OPTIONS. */
export function handleOptions(req: Request): Response {
  return new Response(null, { headers: corsHeaders(req) });
}

/** Réponse JSON avec les en-têtes CORS de la requête. */
export function jsonResponse(
  req: Request,
  body: unknown,
  status = 200,
  extraHeaders: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(req),
      "Content-Type": "application/json",
      ...extraHeaders,
    },
  });
}
