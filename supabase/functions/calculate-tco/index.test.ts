// Tests d'intégration contre Supabase LOCAL uniquement (voir helpers.ts).
import { assertEquals } from "jsr:@std/assert@1";
import { callFunction, createTestUser } from "../../tests/helpers.ts";

Deno.test("calculate-tco - refuse la clé anon seule (401)", async () => {
  const response = await callFunction("calculate-tco", {
    scenarioId: crypto.randomUUID(),
  });
  assertEquals(response.status, 401);
  await response.text();
});

Deno.test("calculate-tco - scenarioId manquant => 400", async () => {
  const user = await createTestUser("tco-400");
  const response = await callFunction(
    "calculate-tco",
    {},
    { Authorization: `Bearer ${user.token}` },
  );
  assertEquals(response.status, 400);
  await response.text();
});

Deno.test("calculate-tco - scénario d'autrui (IDOR) => 404", async () => {
  const owner = await createTestUser("tco-owner");
  const attacker = await createTestUser("tco-attacker");

  const { data: project } = await owner.client
    .from("projects")
    .insert({ name: "P TCO", user_id: owner.id })
    .select("id")
    .single();
  const { data: scenario } = await owner.client
    .from("scenarios")
    .insert({
      project_id: project!.id,
      name: "S TCO",
      region: "CA_QC",
      analysis_years: 10,
      discount_rate: 5,
      fleet_composition: {
        diesel: { count: 2, annualKm: 60000 },
        ev: { count: 1, annualKm: 60000 },
        hydrogen: { count: 0, annualKm: 0 },
      },
    })
    .select("id")
    .single();

  const response = await callFunction(
    "calculate-tco",
    { scenarioId: scenario!.id },
    { Authorization: `Bearer ${attacker.token}` },
  );
  assertEquals(response.status, 404, "l'IDOR sur scenarioId doit renvoyer 404");
  await response.text();
});

Deno.test("calculate-tco - le propriétaire calcule et le résultat est enregistré", async () => {
  const owner = await createTestUser("tco-legit");
  const { data: project } = await owner.client
    .from("projects")
    .insert({ name: "P TCO 2", user_id: owner.id })
    .select("id")
    .single();
  const { data: scenario } = await owner.client
    .from("scenarios")
    .insert({
      project_id: project!.id,
      name: "S TCO 2",
      region: "CA_QC",
      analysis_years: 10,
      discount_rate: 5,
      fleet_composition: {
        diesel: { count: 2, annualKm: 60000 },
        ev: { count: 1, annualKm: 60000 },
        hydrogen: { count: 0, annualKm: 0 },
      },
    })
    .select("id")
    .single();

  const response = await callFunction(
    "calculate-tco",
    { scenarioId: scenario!.id },
    { Authorization: `Bearer ${owner.token}` },
  );
  assertEquals(response.status, 200);
  const body = await response.json();
  assertEquals(body.success, true);

  const { data: results } = await owner.client
    .from("tco_results")
    .select("id")
    .eq("scenario_id", scenario!.id);
  assertEquals(results?.length, 1);
});
