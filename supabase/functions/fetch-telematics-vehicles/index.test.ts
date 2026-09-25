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

Deno.test("fetch-telematics-vehicles - JWT réel + champs manquants => 400", async () => {
  const user = await createTestUser("telematics-fetch");
  const response = await callFunction(
    "fetch-telematics-vehicles",
    { provider: "samsara" },
    { Authorization: `Bearer ${user.token}` },
  );
  assertEquals(response.status, 400);
  await response.text();
});

Deno.test("fetch-telematics-vehicles - identifiants illisibles => 400", async () => {
  const user = await createTestUser("telematics-fetch2");
  const response = await callFunction(
    "fetch-telematics-vehicles",
    { provider: "samsara", encryptedCredentials: "pas-du-base64-json" },
    { Authorization: `Bearer ${user.token}` },
  );
  assertEquals(response.status, 400);
  await response.text();
});
