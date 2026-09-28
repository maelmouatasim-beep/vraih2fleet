// Phase 2a : entité organisation — création automatique à l'inscription,
// isolation entre organisations, rôles, visibilité des projets d'équipe.
import { assert, assertEquals } from "jsr:@std/assert@1";
import { adminClient, createTestUser, type TestUser } from "./helpers.ts";

async function orgOf(user: TestUser): Promise<{ id: string; role: string }> {
  const { data, error } = await user.client
    .from("organization_members")
    .select("organization_id, role")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  assert(data, `l'utilisateur ${user.email} n'a pas d'organisation`);
  return { id: data.organization_id, role: data.role };
}

Deno.test("chaque nouvel utilisateur reçoit sa propre organisation et en est admin", async () => {
  const a = await createTestUser('org-test-1');
  const { id, role } = await orgOf(a);
  assertEquals(role, "admin");
  const { data: org } = await a.client.from("organizations").select("*").eq("id", id).single();
  assert(org);
  assertEquals(org.currency, "CAD");
  assertEquals(org.region, "CA_QC");
});

Deno.test("un utilisateur ne voit ni l'organisation ni les membres d'une autre organisation", async () => {
  const a = await createTestUser('org-test-2');
  const b = await createTestUser('org-test-3');
  const orgA = await orgOf(a);

  const { data: orgsVues } = await b.client.from("organizations").select("id").eq("id", orgA.id);
  assertEquals(orgsVues ?? [], []);

  const { data: membresVus } = await b.client
    .from("organization_members")
    .select("id")
    .eq("organization_id", orgA.id);
  assertEquals(membresVus ?? [], []);
});

Deno.test("un membre de l'organisation voit les projets de l'organisation sans en être propriétaire", async () => {
  const a = await createTestUser('org-test-4');
  const b = await createTestUser('org-test-5');
  const orgA = await orgOf(a);

  // A crée un projet rattaché à son organisation
  const { data: projet, error: errProjet } = await a.client
    .from("projects")
    .insert({ name: "Projet d'équipe", user_id: a.id, organization_id: orgA.id })
    .select("id")
    .single();
  if (errProjet) throw errProjet;

  // B (autre organisation) ne le voit pas
  const { data: vuParB } = await b.client.from("projects").select("id").eq("id", projet.id);
  assertEquals(vuParB ?? [], []);

  // L'admin ajoute B comme lecteur de l'organisation de A
  const admin = adminClient();
  const { error: errAjout } = await admin
    .from("organization_members")
    .insert({ organization_id: orgA.id, user_id: b.id, role: "reader" });
  if (errAjout) throw errAjout;

  // B voit maintenant le projet…
  const { data: vuApres } = await b.client.from("projects").select("id").eq("id", projet.id);
  assertEquals(vuApres?.length, 1);

  // …mais un « reader » ne peut pas le modifier
  const { data: majData } = await b.client
    .from("projects")
    .update({ name: "piraté" })
    .eq("id", projet.id)
    .select("id");
  assertEquals(majData ?? [], []);
});

Deno.test("seul un admin de l'organisation peut ajouter des membres", async () => {
  const a = await createTestUser('org-test-6');
  const b = await createTestUser('org-test-7');
  const orgA = await orgOf(a);

  // B (étranger) ne peut pas s'inviter lui-même
  const { data: intrusion } = await b.client
    .from("organization_members")
    .insert({ organization_id: orgA.id, user_id: b.id, role: "admin" })
    .select("id");
  assertEquals(intrusion ?? [], []);

  // A (admin) peut ajouter B
  const { data: ajout, error } = await a.client
    .from("organization_members")
    .insert({ organization_id: orgA.id, user_id: b.id, role: "member" })
    .select("id");
  if (error) throw error;
  assertEquals(ajout?.length, 1);
});
