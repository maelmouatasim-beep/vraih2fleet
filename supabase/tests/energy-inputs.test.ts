// Revue A1c : données client de prix de l'énergie (energy_client_inputs).
// RLS : membre écrit la ligne de son organisation, un tiers ne la lit
// pas, un « reader » ne modifie rien.
import { assert, assertEquals } from "jsr:@std/assert@1";
import { adminClient, createTestUser, type TestUser } from "./helpers.ts";

async function orgOf(user: TestUser): Promise<string> {
  const { data, error } = await user.client
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  assert(data, `l'utilisateur ${user.email} n'a pas d'organisation`);
  return data.organization_id;
}

Deno.test("un admin saisit les données énergie de SON organisation et les relit", async () => {
  const a = await createTestUser("energie-1");
  const orgA = await orgOf(a);
  const { data, error } = await a.client
    .from("energy_client_inputs")
    .insert({ organization_id: orgA, diesel_price_per_l: 1.62, notes: "contrat carburant 2026" })
    .select()
    .single();
  if (error) throw error;
  assertEquals(data.diesel_price_per_l, 1.62);
  assertEquals(data.project_id, null);

  const { data: relu } = await a.client
    .from("energy_client_inputs")
    .select("diesel_price_per_l")
    .eq("organization_id", orgA);
  assertEquals(relu?.length, 1);
});

Deno.test("un utilisateur d'une AUTRE organisation ne lit ni n'écrit ces données", async () => {
  const a = await createTestUser("energie-2");
  const b = await createTestUser("energie-3");
  const orgA = await orgOf(a);
  await a.client.from("energy_client_inputs").insert({ organization_id: orgA, h2_price_per_kg: 12.5 });

  const { data: vues } = await b.client
    .from("energy_client_inputs")
    .select("id")
    .eq("organization_id", orgA);
  assertEquals(vues ?? [], []);

  const { error: errEcriture } = await b.client
    .from("energy_client_inputs")
    .insert({ organization_id: orgA, diesel_price_per_l: 9.99 });
  assert(errEcriture, "l'écriture inter-organisations aurait dû être refusée");
});

Deno.test("un membre « reader » lit mais ne modifie pas", async () => {
  const a = await createTestUser("energie-4");
  const lecteur = await createTestUser("energie-5");
  const orgA = await orgOf(a);
  const { data: ligne, error } = await a.client
    .from("energy_client_inputs")
    .insert({ organization_id: orgA, electricity_cost_per_kwh: 0.084 })
    .select("id")
    .single();
  if (error) throw error;

  const admin = adminClient();
  await admin.from("organization_members").insert({
    organization_id: orgA,
    user_id: lecteur.id,
    role: "reader",
  });

  const { data: vues } = await lecteur.client
    .from("energy_client_inputs")
    .select("id")
    .eq("organization_id", orgA);
  assertEquals(vues?.length, 1);

  const { data: majData } = await lecteur.client
    .from("energy_client_inputs")
    .update({ electricity_cost_per_kwh: 0.01 })
    .eq("id", ligne.id)
    .select();
  assertEquals(majData ?? [], [], "un reader ne doit pas pouvoir modifier");
});
