// Tests d'intégration contre Supabase LOCAL uniquement (voir helpers.ts).
// FEATURE_PUBLIC_API est absent de l'env de test : l'API publique est
// désactivée et doit répondre 404 à tout, même avec une clé.
import { assertEquals } from "jsr:@std/assert@1";
import { ANON_KEY, functionUrl } from "../../tests/helpers.ts";

Deno.test("api-gateway - 404 quand FEATURE_PUBLIC_API est désactivé", async () => {
  const response = await fetch(`${functionUrl("api-gateway")}/projects`, {
    headers: {
      apikey: ANON_KEY,
      Authorization: `Bearer ${ANON_KEY}`,
      "x-api-key": "h2f_nimportequoi",
    },
  });
  assertEquals(response.status, 404);
  await response.text();
});

Deno.test("mcp - 404 quand FEATURE_PUBLIC_API est désactivé", async () => {
  const response = await fetch(functionUrl("mcp"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: ANON_KEY,
      Authorization: `Bearer ${ANON_KEY}`,
    },
    body: JSON.stringify({ jsonrpc: "2.0", method: "initialize", id: 1 }),
  });
  assertEquals(response.status, 404);
  await response.text();
});
