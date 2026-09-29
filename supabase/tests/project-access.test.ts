// Revue B1-B3 : accès projet aligné sur l'organisation, verrou de
// transfert, cohérence véhicule/projet et visibilité des véhicules
// pour les collaborateurs externes.
import { assert, assertEquals } from "jsr:@std/assert@1";
import { adminClient, createTestUser, type TestUser } from "./helpers.ts";

async function orgOf(user: TestUser): Promise<string> {
  const { data } = await user.client
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", user.id)
    .limit(1)
    .single();
  return data!.organization_id;
}

async function projetOrg(user: TestUser, org: string): Promise<string> {
  const { data, error } = await user.client
    .from("projects")
    .insert({ name: "Projet accès", user_id: user.id, organization_id: org })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

Deno.test("B2 : un membre de l'organisation lit et crée scénarios et tâches du projet d'équipe", async () => {
  const a = await createTestUser("acces-1");
  const b = await createTestUser("acces-2");
  const orgA = await orgOf(a);
  const projet = await projetOrg(a, orgA);
  const admin = adminClient();
  await admin.from("organization_members").insert({ organization_id: orgA, user_id: b.id, role: "member" });

  const { error: eScenario } = await a.client
    .from("scenarios")
    .insert({ name: "Scénario A", project_id: projet });
  if (eScenario) throw eScenario;

  const { data: scenariosVus } = await b.client.from("scenarios").select("id").eq("project_id", projet);
  assertEquals(scenariosVus?.length, 1, "le membre doit voir les scénarios du projet d'équipe");

  const { error: eTache } = await b.client
    .from("tasks")
    .insert({ project_id: projet, title: "Tâche de b", created_by: b.id });
  if (eTache) throw eTache;
  const { data: tachesVues } = await a.client.from("tasks").select("id").eq("project_id", projet);
  assertEquals(tachesVues?.length, 1);
});

Deno.test("B1 : un membre écrivain modifie le projet mais ne peut PAS le transférer", async () => {
  const a = await createTestUser("acces-3");
  const b = await createTestUser("acces-4");
  const orgA = await orgOf(a);
  const orgB = await orgOf(b);
  const projet = await projetOrg(a, orgA);
  const admin = adminClient();
  await admin.from("organization_members").insert({ organization_id: orgA, user_id: b.id, role: "member" });

  // modification ordinaire : permise
  const { error: eNom } = await b.client.from("projects").update({ name: "Renommé" }).eq("id", projet);
  assertEquals(eNom, null);

  // s'approprier le projet : refusé (trigger)
  const { error: eProprio } = await b.client.from("projects").update({ user_id: b.id }).eq("id", projet);
  assert(eProprio, "le transfert de propriété par un membre non admin doit être refusé");

  // le déplacer vers sa propre organisation : refusé
  const { error: eOrg } = await b.client
    .from("projects")
    .update({ organization_id: orgB })
    .eq("id", projet);
  assert(eOrg, "le changement d'organisation par un membre non admin doit être refusé");

  // le propriétaire, lui, peut transférer
  const { error: eOk } = await a.client.from("projects").update({ user_id: a.id }).eq("id", projet);
  assertEquals(eOk, null);
});

Deno.test("B3 : un véhicule d'une AUTRE organisation ne peut pas entrer dans le projet", async () => {
  const a = await createTestUser("acces-5");
  const b = await createTestUser("acces-6");
  const orgA = await orgOf(a);
  const orgB = await orgOf(b);
  const projet = await projetOrg(a, orgA);
  const admin = adminClient();
  const { data: vehB, error: eVeh } = await admin
    .from("vehicles")
    .insert({ organization_id: orgB, unit_number: "AUTRE-01", category: "camionnette", fuel_type: "diesel" })
    .select("id")
    .single();
  if (eVeh) throw eVeh;

  const { error } = await a.client
    .from("project_vehicles")
    .insert({ project_id: projet, vehicle_id: vehB.id });
  assert(error, "le trigger doit refuser un véhicule d'une autre organisation");
});

Deno.test("B3 : un collaborateur externe voit les véhicules du projet (jointure jamais nulle)", async () => {
  const a = await createTestUser("acces-7");
  const c = await createTestUser("acces-8");
  const orgA = await orgOf(a);
  const projet = await projetOrg(a, orgA);
  const { data: veh, error: eVeh } = await a.client
    .from("vehicles")
    .insert({ organization_id: orgA, unit_number: "V-100", category: "camionnette", fuel_type: "diesel" })
    .select("id")
    .single();
  if (eVeh) throw eVeh;
  await a.client.from("project_vehicles").insert({ project_id: projet, vehicle_id: veh.id });

  const admin = adminClient();
  await admin.from("project_collaborators").insert({ project_id: projet, user_id: c.id, role: "viewer" });

  const { data, error } = await c.client
    .from("project_vehicles")
    .select("*, vehicles(*)")
    .eq("project_id", projet);
  if (error) throw error;
  assertEquals(data?.length, 1);
  assert(data![0].vehicles, "le véhicule joint doit être visible pour le collaborateur externe");
  assertEquals((data![0].vehicles as { unit_number: string }).unit_number, "V-100");
});
