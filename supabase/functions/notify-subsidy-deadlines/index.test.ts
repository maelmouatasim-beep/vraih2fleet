// Tests d'intégration contre Supabase LOCAL uniquement (voir helpers.ts).
import { assertEquals } from "jsr:@std/assert@1";
import { callFunction, TEST_CRON_SECRET } from "../../tests/helpers.ts";

Deno.test("notify-subsidy-deadlines - sans secret => 401 (plus d'envoi massif ouvert)", async () => {
  const response = await callFunction("notify-subsidy-deadlines", {});
  assertEquals(response.status, 401);
  await response.text();
});

Deno.test("notify-subsidy-deadlines - mauvais secret => 401", async () => {
  const response = await callFunction(
    "notify-subsidy-deadlines",
    {},
    { "x-cron-secret": "mauvais" },
  );
  assertEquals(response.status, 401);
  await response.text();
});

Deno.test("notify-subsidy-deadlines - bon secret => 200", async () => {
  const response = await callFunction(
    "notify-subsidy-deadlines",
    {},
    { "x-cron-secret": TEST_CRON_SECRET },
  );
  assertEquals(response.status, 200);
  await response.text();
});
