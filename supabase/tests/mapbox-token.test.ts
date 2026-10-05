// get-mapbox-token aligné sur _shared/ : utilisateur réel exigé, 503 propre
// sans jeton configuré (env de test). La règle CORS (ALLOWED_ORIGINS) est
// testée unitairement dans cors.test.ts : la passerelle Kong du Supabase
// LOCAL ajoute elle-même « Access-Control-Allow-Origin: * » aux réponses.
import { assertEquals } from "jsr:@std/assert@1";
import { ANON_KEY, createTestUser, SUPABASE_URL } from "./helpers.ts";

const appeler = (token: string) =>
  fetch(`${SUPABASE_URL}/functions/v1/get-mapbox-token`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, apikey: ANON_KEY },
  });

Deno.test("get-mapbox-token : clé anon seule refusée (401)", async () => {
  const r = await appeler(ANON_KEY);
  await r.body?.cancel();
  assertEquals(r.status, 401);
});

Deno.test("get-mapbox-token : utilisateur réel, jeton absent → 503 service_non_configure", async () => {
  const u = await createTestUser("mapbox");
  const r = await appeler(u.token);
  assertEquals(r.status, 503);
  assertEquals((await r.json()).error, "service_non_configure");
});
