// Revue B4-B6 : gouvernance des organisations — membre retiré, reader
// en lecture seule, dernier admin protégé, organisation garantie.
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

Deno.test("B4 : un membre RETIRÉ perd immédiatement l'accès aux données de l'organisation", async () => {
  const a = await createTestUser("gouv-1");
  const b = await createTestUser("gouv-2");
  const orgA = await orgOf(a);
  const admin = adminClient();
  const { data: ligne } = await admin
    .from("organization_members")
    .insert({ organization_id: orgA, user_id: b.id, role: "member" })
    .select("id")
    .single();
  const { data: projet } = await a.client
    .from("projects")
    .insert({ name: "Projet gouvernance", user_id: a.id, organization_id: orgA })
    .select("id")
    .single();

  const { data: avant } = await b.client.from("projects").select("id").eq("id", projet!.id);
  assertEquals(avant?.length, 1, "membre : doit voir le projet d'équipe");

  await admin.from("organization_members").delete().eq("id", ligne!.id);

  const { data: apres } = await b.client.from("projects").select("id").eq("id", projet!.id);
  assertEquals(apres ?? [], [], "membre retiré : ne doit plus voir le projet");
});

Deno.test("B4 : un READER lit mais n'écrit ni la flotte ni les projets de l'organisation", async () => {
  const a = await createTestUser("gouv-3");
  const lecteur = await createTestUser("gouv-4");
  const orgA = await orgOf(a);
  const admin = adminClient();
  await admin.from("organization_members").insert({ organization_id: orgA, user_id: lecteur.id, role: "reader" });
  const { data: projet } = await a.client
    .from("projects")
    .insert({ name: "Projet lecture", user_id: a.id, organization_id: orgA })
    .select("id")
    .single();

  const { data: vus } = await lecteur.client.from("projects").select("id").eq("id", projet!.id);
  assertEquals(vus?.length, 1);

  const { data: maj } = await lecteur.client
    .from("projects")
    .update({ name: "piraté" })
    .eq("id", projet!.id)
    .select();
  assertEquals(maj ?? [], [], "un reader ne modifie pas les projets");

  const { error: eVeh } = await lecteur.client.from("vehicles").insert({
    organization_id: orgA,
    unit_number: "READER-01",
    category: "camionnette",
    fuel_type: "diesel",
  });
  assert(eVeh, "un reader ne crée pas de véhicule");
});

Deno.test("B4 : le DERNIER ADMIN ne peut ni partir ni être rétrogradé ; possible dès qu'un second admin existe", async () => {
  const a = await createTestUser("gouv-5");
  const b = await createTestUser("gouv-6");
  const orgA = await orgOf(a);
  const admin = adminClient();
  const { data: ligneA } = await admin
    .from("organization_members")
    .select("id")
    .eq("organization_id", orgA)
    .eq("user_id", a.id)
    .single();

  const { error: eDepart } = await admin.from("organization_members").delete().eq("id", ligneA!.id);
  assert(eDepart, "le départ du dernier admin doit être refusé");

  const { error: eRetro } = await admin
    .from("organization_members")
    .update({ role: "member" })
    .eq("id", ligneA!.id);
  assert(eRetro, "la rétrogradation du dernier admin doit être refusée");

  await admin.from("organization_members").insert({ organization_id: orgA, user_id: b.id, role: "admin" });
  const { error: eOk } = await admin.from("organization_members").delete().eq("id", ligneA!.id);
  assertEquals(eOk, null, "avec un second admin, le départ est permis");
});

Deno.test("B4 : la suppression de l'organisation reste possible malgré le verrou du dernier admin", async () => {
  const a = await createTestUser("gouv-7");
  const orgA = await orgOf(a);
  const { error } = await a.client.from("organizations").delete().eq("id", orgA);
  assertEquals(error, null, "un admin peut supprimer son organisation (cascade des membres comprise)");
  const { data } = await a.client.from("organization_members").select("id").eq("organization_id", orgA);
  assertEquals(data ?? [], []);
});
