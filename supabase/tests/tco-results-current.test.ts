// Revue B7 : UNE seule ligne courante par scénario, même sous
// insertions CONCURRENTES (verrou consultatif du trigger).
import { assert, assertEquals } from "jsr:@std/assert@1";
import { createTestUser } from "./helpers.ts";

async function scenario(user: Awaited<ReturnType<typeof createTestUser>>): Promise<string> {
  const { data: projet } = await user.client
    .from("projects")
    .insert({ name: "Projet is_current", user_id: user.id })
    .select("id")
    .single();
  const { data: s, error } = await user.client
    .from("scenarios")
    .insert({ name: "Scénario", project_id: projet!.id })
    .select("id")
    .single();
  if (error) throw error;
  return s.id;
}

Deno.test("chaque insertion devient LA courante, la précédente passe à l'historique", async () => {
  const a = await createTestUser("current-1");
  const sid = await scenario(a);
  await a.client.from("tco_results").insert({ scenario_id: sid });
  await a.client.from("tco_results").insert({ scenario_id: sid });
  const { data } = await a.client
    .from("tco_results")
    .select("id, is_current")
    .eq("scenario_id", sid);
  assertEquals(data?.length, 2);
  assertEquals(data?.filter((r) => r.is_current).length, 1);
});

Deno.test("insertions CONCURRENTES : toutes réussissent, une seule ligne courante", async () => {
  const a = await createTestUser("current-2");
  const sid = await scenario(a);
  const resultats = await Promise.all(
    Array.from({ length: 6 }, () => a.client.from("tco_results").insert({ scenario_id: sid })),
  );
  for (const r of resultats) {
    assertEquals(r.error, null, `insertion concurrente refusée : ${r.error?.message}`);
  }
  const { data } = await a.client
    .from("tco_results")
    .select("is_current")
    .eq("scenario_id", sid);
  assertEquals(data?.length, 6);
  assertEquals(data?.filter((r) => r.is_current).length, 1, "exactement UNE ligne courante");
  assert(data!.some((r) => !r.is_current));
});
