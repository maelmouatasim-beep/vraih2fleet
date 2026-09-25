// Tests d'intégration contre Supabase LOCAL (supabase start +
// supabase functions serve --env-file supabase/tests/functions.env).
// Jamais contre la production : helpers.ts refuse toute URL non-localhost.
import { assertEquals } from "jsr:@std/assert@1";
import { callFunction, createTestUser } from "../../tests/helpers.ts";

Deno.test("authenticate-telematics - refuse la clé anon seule (401)", async () => {
  const response = await callFunction("authenticate-telematics", {
    provider: "geotab",
    database: "db",
    username: "u",
    password: "p",
  });
  assertEquals(response.status, 401);
  await response.text();
});

Deno.test("authenticate-telematics - JWT réel + champs manquants => 400", async () => {
  const user = await createTestUser("telematics-auth");
  const response = await callFunction(
    "authenticate-telematics",
    { provider: "geotab" },
    { Authorization: `Bearer ${user.token}` },
  );
  assertEquals(response.status, 400);
  const body = await response.json();
  assertEquals(body.success, false);
});

Deno.test("authenticate-telematics - fournisseur inconnu => 400", async () => {
  const user = await createTestUser("telematics-auth2");
  const response = await callFunction(
    "authenticate-telematics",
    { provider: "autre", username: "u", password: "p" },
    { Authorization: `Bearer ${user.token}` },
  );
  assertEquals(response.status, 400);
  await response.text();
});
