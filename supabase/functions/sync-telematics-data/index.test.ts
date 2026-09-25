// Tests d'intégration contre Supabase LOCAL uniquement (voir helpers.ts).
import { assertEquals } from "jsr:@std/assert@1";
import {
  callFunction,
  createTestUser,
  TEST_CRON_SECRET,
} from "../../tests/helpers.ts";

Deno.test("sync-telematics-data - sans auth => 401", async () => {
  const response = await callFunction("sync-telematics-data", {});
  assertEquals(response.status, 401);
  await response.text();
});

Deno.test("sync-telematics-data - mauvais secret cron => 401", async () => {
  const response = await callFunction(
    "sync-telematics-data",
    {},
    { "x-cron-secret": "mauvais" },
  );
  assertEquals(response.status, 401);
  await response.text();
});

Deno.test("sync-telematics-data - bon secret cron => 200", async () => {
  const response = await callFunction(
    "sync-telematics-data",
    {},
    { "x-cron-secret": TEST_CRON_SECRET },
  );
  assertEquals(response.status, 200);
  const body = await response.json();
  assertEquals(body.success, true);
});

Deno.test("sync-telematics-data - mode utilisateur sans connectionId => 400", async () => {
  const user = await createTestUser("sync-400");
  const response = await callFunction(
    "sync-telematics-data",
    {},
    { Authorization: `Bearer ${user.token}` },
  );
  assertEquals(response.status, 400);
  await response.text();
});

Deno.test("sync-telematics-data - connexion d'autrui (IDOR) => 404", async () => {
  const owner = await createTestUser("sync-owner");
  const attacker = await createTestUser("sync-attacker");

  const { data: connection, error } = await owner.client
    .from("telematics_connections")
    .insert({
      user_id: owner.id,
      provider: "samsara",
      username: "owner@example.com",
      status: "connected",
      encrypted_credentials: btoa(JSON.stringify({ apiToken: "x" })),
    })
    .select("id")
    .single();
  if (error) throw error;

  const response = await callFunction(
    "sync-telematics-data",
    { connectionId: connection.id },
    { Authorization: `Bearer ${attacker.token}` },
  );
  assertEquals(response.status, 404, "l'IDOR sur connectionId doit renvoyer 404");
  await response.text();
});
