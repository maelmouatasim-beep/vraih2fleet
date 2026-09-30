// Revue D4 : le taux d'actualisation des projets est une FRACTION
// (0.05 = 5 %) — défaut 0.05, pourcentage refusé par la contrainte.
import { assert, assertEquals } from "jsr:@std/assert@1";
import { createTestUser } from "./helpers.ts";

Deno.test("D4 : défaut 0.05 et pourcentage refusé", async () => {
  const a = await createTestUser("taux-1");
  const { data: projet, error } = await a.client
    .from("projects")
    .insert({ name: "Projet taux", user_id: a.id })
    .select("default_discount_rate")
    .single();
  assertEquals(error, null);
  assertEquals(Number(projet!.default_discount_rate), 0.05);

  const { error: ePourcent } = await a.client
    .from("projects")
    .insert({ name: "Projet 5 pour cent", user_id: a.id, default_discount_rate: 5 })
    .select("id")
    .single();
  assert(ePourcent, "un taux saisi en pour cent (5) doit être refusé");
});
