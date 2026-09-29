// Subventions confirmées par le client (confirmed_subsidies) — RLS :
// éditeur du projet écrit, tiers ne lit pas, référence du document
// obligatoire.
import { assert, assertEquals } from "jsr:@std/assert@1";
import { createTestUser, type TestUser } from "./helpers.ts";

async function projetEtVehicule(user: TestUser): Promise<{ projet: string; vehicule: string }> {
  const { data: org } = await user.client
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", user.id)
    .limit(1)
    .single();
  const { data: projet, error: e1 } = await user.client
    .from("projects")
    .insert({ name: "Projet subventions", user_id: user.id, organization_id: org!.organization_id })
    .select("id")
    .single();
  if (e1) throw e1;
  const { data: veh, error: e2 } = await user.client
    .from("vehicles")
    .insert({
      organization_id: org!.organization_id,
      unit_number: `BUS-${Math.floor(Math.random() * 100000)}`,
      category: "autobus_urbain_12m",
      fuel_type: "diesel",
    })
    .select("id")
    .single();
  if (e2) throw e2;
  return { projet: projet.id, vehicule: veh.id };
}

Deno.test("l'éditeur du projet saisit une subvention confirmée et la relit", async () => {
  const a = await createTestUser("subv-conf-1");
  const { projet, vehicule } = await projetEtVehicule(a);
  const { data, error } = await a.client
    .from("confirmed_subsidies")
    .insert({
      project_id: projet,
      vehicle_id: vehicule,
      program_id: "pagtcp",
      amount: 400000,
      document_reference: "lettre MTMD 2026-1234",
    })
    .select()
    .single();
  if (error) throw error;
  assertEquals(data.amount, 400000);
  const { data: relues } = await a.client
    .from("confirmed_subsidies")
    .select("id")
    .eq("project_id", projet);
  assertEquals(relues?.length, 1);
});

Deno.test("la référence du document est OBLIGATOIRE (contrainte)", async () => {
  const a = await createTestUser("subv-conf-2");
  const { projet, vehicule } = await projetEtVehicule(a);
  const { error } = await a.client.from("confirmed_subsidies").insert({
    project_id: projet,
    vehicle_id: vehicule,
    program_id: "ftcze",
    amount: 100000,
    document_reference: "",
  });
  assert(error, "une référence vide aurait dû être refusée");
});

Deno.test("un tiers ne lit ni n'écrit les subventions confirmées d'un autre projet", async () => {
  const a = await createTestUser("subv-conf-3");
  const b = await createTestUser("subv-conf-4");
  const { projet, vehicule } = await projetEtVehicule(a);
  await a.client.from("confirmed_subsidies").insert({
    project_id: projet,
    vehicle_id: vehicule,
    program_id: "pagtcp",
    amount: 250000,
    document_reference: "décision 2026-77",
  });
  const { data: vues } = await b.client
    .from("confirmed_subsidies")
    .select("id")
    .eq("project_id", projet);
  assertEquals(vues ?? [], []);
  const { error } = await b.client.from("confirmed_subsidies").insert({
    project_id: projet,
    vehicle_id: vehicule,
    program_id: "autre",
    label: "intrus",
    amount: 1,
    document_reference: "x",
  });
  assert(error, "l'écriture par un tiers aurait dû être refusée");
});
