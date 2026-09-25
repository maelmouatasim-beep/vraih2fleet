// Authentification de l'appelant, partagée par toutes les edge functions.
//
// Règle du dépôt : AUCUNE edge function ne traite une requête sans passer par
// l'un de ces contrôles (getUserOrThrow, requireCronSecret ou
// requireInternalSecret). verify_jwt de config.toml n'est pas une
// authentification : la clé anon publique suffit à le franchir.

import {
  createClient,
  type SupabaseClient,
  type User,
} from "npm:@supabase/supabase-js@2.49.4";

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/**
 * Vérifie le JWT utilisateur du header Authorization auprès de l'API Auth et
 * retourne l'utilisateur réel + un client Supabase qui porte son jeton (donc
 * soumis à la RLS). Lève HttpError(401) sinon.
 */
export async function getUserOrThrow(
  req: Request,
): Promise<{ user: User; supabase: SupabaseClient; token: string }> {
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) throw new HttpError(401, "Authentication required");

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey =
    Deno.env.get("SUPABASE_ANON_KEY") ??
    Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;

  const supabase = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) {
    throw new HttpError(401, "Invalid or expired token");
  }
  return { user: data.user, supabase, token };
}

/** Compare deux chaînes en temps constant. */
function timingSafeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const ab = enc.encode(a);
  const bb = enc.encode(b);
  if (ab.length !== bb.length) return false;
  let diff = 0;
  for (let i = 0; i < ab.length; i++) diff |= ab[i] ^ bb[i];
  return diff === 0;
}

/**
 * Exige le secret partagé des tâches planifiées (header x-cron-secret,
 * secret CRON_SECRET). Lève HttpError(401) si absent ou faux, et
 * HttpError(500) si le secret n'est pas configuré côté serveur.
 */
export function requireCronSecret(req: Request): void {
  const expected = Deno.env.get("CRON_SECRET");
  if (!expected) throw new HttpError(500, "CRON_SECRET is not configured");
  const provided = req.headers.get("x-cron-secret") ?? "";
  if (!provided || !timingSafeEqual(provided, expected)) {
    throw new HttpError(401, "Invalid cron secret");
  }
}

/**
 * Exige le secret partagé des appels internes de service à service
 * (header x-internal-secret, secret INTERNAL_FUNCTION_SECRET).
 */
export function requireInternalSecret(req: Request): void {
  const expected = Deno.env.get("INTERNAL_FUNCTION_SECRET");
  if (!expected) {
    throw new HttpError(500, "INTERNAL_FUNCTION_SECRET is not configured");
  }
  const provided = req.headers.get("x-internal-secret") ?? "";
  if (!provided || !timingSafeEqual(provided, expected)) {
    throw new HttpError(401, "Invalid internal secret");
  }
}

/** Client service-role : réservé aux fonctions appelées par cron/interne. */
export function serviceRoleClient(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

/** true quand le drapeau FEATURE_PUBLIC_API est activé (false par défaut). */
export function isPublicApiEnabled(): boolean {
  return Deno.env.get("FEATURE_PUBLIC_API") === "true";
}
