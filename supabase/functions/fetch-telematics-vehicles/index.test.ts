// Tests d'intégration contre Supabase LOCAL uniquement (voir helpers.ts).
import { assertEquals } from "jsr:@std/assert@1";
import { callFunction, createTestUser } from "../../tests/helpers.ts";

Deno.test("fetch-telematics-vehicles - refuse la clé anon seule (401)", async () => {
  const response = await callFunction("fetch-telematics-vehicles", {
    provider: "samsara",
    encryptedCredentials: btoa(JSON.stringify({ apiToken: "x" })),
  });
  assertEquals(response.status, 401);
  await response.text();
});

Deno.test("fetch-telematics-vehicles - fournisseur absent ou inconnu => 400", async () => {
  const user = await createTestUser("telematics-fetch");
  const response = await callFunction(
    "fetch-telematics-vehicles",
    {},
    { Authorization: `Bearer ${user.token}` },
  );
  assertEquals(response.status, 400);
  await response.text();
});

// Les identifiants ne viennent plus du navigateur : un « encryptedCredentials »
// envoyé est ignoré ; sans connexion active de l'appelant → 404.
Deno.test("fetch-telematics-vehicles - identifiants du corps ignorés, aucune connexion => 404", async () => {
  const user = await createTestUser("telematics-fetch2");
  const response = await callFunction(
    "fetch-telematics-vehicles",
    { provider: "samsara", encryptedCredentials: btoa(JSON.stringify({ apiToken: "x" })) },
    { Authorization: `Bearer ${user.token}` },
  );
  assertEquals(response.status, 404);
  await response.text();
});
