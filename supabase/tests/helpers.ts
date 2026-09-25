// Helpers des tests d'intégration contre Supabase LOCAL (supabase start).
// Ces tests ne doivent JAMAIS viser la production : l'URL est verrouillée
// sur localhost.

import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.49.4";

export const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "http://127.0.0.1:54321";
export const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
export const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
export const DB_URL = Deno.env.get("SUPABASE_DB_URL") ??
  "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

// Secrets de test (mêmes valeurs que supabase/tests/functions.env)
export const TEST_CRON_SECRET = "test-cron-secret";
export const TEST_INTERNAL_SECRET = "test-internal-secret";

const url = new URL(SUPABASE_URL);
if (!["localhost", "127.0.0.1"].includes(url.hostname)) {
  throw new Error(
    `Ces tests ne s'exécutent que contre Supabase local (reçu : ${SUPABASE_URL})`,
  );
}
if (!ANON_KEY || !SERVICE_ROLE_KEY) {
  throw new Error(
    "SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY manquants — lancer `supabase start` et exporter `supabase status -o env`",
  );
}

export function adminClient(): SupabaseClient {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function anonClient(): SupabaseClient {
  return createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export interface TestUser {
  id: string;
  email: string;
  token: string;
  client: SupabaseClient;
}

let userCounter = 0;

/** Crée un utilisateur confirmé et retourne un client authentifié. */
export async function createTestUser(label: string): Promise<TestUser> {
  const admin = adminClient();
  const email = `rls-test-${label}-${Date.now()}-${userCounter++}@example.com`;
  const password = "Test1234!secure";

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (createError || !created.user) {
    throw new Error(`createUser(${label}) failed: ${createError?.message}`);
  }

  const signIn = anonClient();
  const { data: session, error: signInError } = await signIn.auth.signInWithPassword({
    email,
    password,
  });
  if (signInError || !session.session) {
    throw new Error(`signIn(${label}) failed: ${signInError?.message}`);
  }

  const token = session.session.access_token;
  const client = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return { id: created.user.id, email, token, client };
}

export function functionUrl(name: string): string {
  return `${SUPABASE_URL}/functions/v1/${name}`;
}

/** POST JSON vers une edge function locale. */
export async function callFunction(
  name: string,
  body: unknown,
  headers: Record<string, string> = {},
): Promise<Response> {
  return await fetch(functionUrl(name), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: ANON_KEY,
      Authorization: `Bearer ${ANON_KEY}`,
      ...headers,
    },
    body: JSON.stringify(body),
  });
}
