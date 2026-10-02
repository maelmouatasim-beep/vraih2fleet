// Phase 5.2 — IA : réglages par organisation (désactivés par défaut,
// modifiables par un admin seulement), usage écrit par le serveur seul,
// historique du copilote visible par l'équipe du projet, fonction
// `copilot` et `fleet-import` : 403 si désactivées, 503 propre sans clé
// Anthropic.
import { assert, assertEquals } from "jsr:@std/assert@1";
import { adminClient, callFunction, createTestUser, type TestUser } from "./helpers.ts";

async function orgDe(user: TestUser): Promise<string> {
  const { data } = await user.client
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", user.id)
    .limit(1)
    .single();
  return data!.organization_id;
}

async function projet(user: TestUser, org: string): Promise<string> {
  const { data, error } = await user.client
    .from("projects")
    .insert({ name: "Projet copilote", user_id: user.id, organization_id: org })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

const corps = (org: string, proj: string) => ({
  organizationId: org,
  projectId: proj,
  question: "Quelle est l'économie du plan ?",
  contexte: { projet: "Projet copilote" },
});

Deno.test("réglages IA : désactivés par défaut ; un membre non admin ne peut pas les activer", async () => {
  const admin = await createTestUser("ia-1");
  const membre = await createTestUser("ia-1b");
  const org = await orgDe(admin);
  await adminClient().from("organization_members").insert({ organization_id: org, user_id: membre.id, role: "member" });
  const { data: rien } = await admin.client.from("organization_ai_settings").select("*").eq("organization_id", org);
  assertEquals(rien ?? [], []);
  const { error: eMembre } = await membre.client
    .from("organization_ai_settings")
    .insert({ organization_id: org, copilot_enabled: true });
  assert(eMembre, "un membre non admin n'active pas l'IA");
  const { error } = await admin.client.from("organization_ai_settings").insert({ organization_id: org, copilot_enabled: true });
  if (error) throw error;
  const { data: lu } = await membre.client.from("organization_ai_settings").select("copilot_enabled, updated_by").eq("organization_id", org).single();
  assertEquals(lu!.copilot_enabled, true);
  assertEquals(lu!.updated_by, admin.id);
});

Deno.test("usage IA : jamais écrit par un utilisateur ; résumé lisible par les membres seulement", async () => {
  const a = await createTestUser("ia-2");
  const b = await createTestUser("ia-2b");
  const org = await orgDe(a);
  const { error } = await a.client
    .from("ai_usage_events")
    .insert({ organization_id: org, feature: "copilote", model: "x", input_tokens: 1 });
  assert(error, "insertion client refusée");
  await adminClient()
    .from("ai_usage_events")
    .insert({ organization_id: org, user_id: a.id, feature: "copilote", model: "claude-opus-5-5", input_tokens: 1000, output_tokens: 200 });
  const { data } = await a.client.rpc("ai_usage_summary", { _org: org });
  assertEquals(Number(data[0].month_input_tokens), 1000);
  const { data: autre } = await b.client.rpc("ai_usage_summary", { _org: org });
  assertEquals(Number(autre[0].month_requests), 0, "un non-membre ne voit rien");
});

Deno.test("historique du copilote : visible par l'équipe du projet, pas au-delà", async () => {
  const a = await createTestUser("ia-3");
  const b = await createTestUser("ia-3b");
  const org = await orgDe(a);
  const p = await projet(a, org);
  const { error } = await a.client.from("copilot_messages").insert({ project_id: p, role: "user", content: "Question" });
  if (error) throw error;
  const { data: vus } = await b.client.from("copilot_messages").select("id").eq("project_id", p);
  assertEquals(vus ?? [], []);
  const { error: eIntrus } = await b.client.from("copilot_messages").insert({ project_id: p, role: "user", content: "Intrus" });
  assert(eIntrus);
});

Deno.test("fonction copilot : 401 sans jeton, 403 si désactivée, 503 propre sans clé Anthropic", async () => {
  const a = await createTestUser("ia-4");
  const org = await orgDe(a);
  const p = await projet(a, org);
  const sansJeton = await callFunction("copilot", corps(org, p));
  assertEquals(sansJeton.status, 401);
  await sansJeton.body?.cancel();
  const desactivee = await callFunction("copilot", corps(org, p), { Authorization: `Bearer ${a.token}` });
  assertEquals(desactivee.status, 403);
  assertEquals((await desactivee.json()).error, "fonction_desactivee");
  await a.client.from("organization_ai_settings").insert({ organization_id: org, copilot_enabled: true });
  const sansCle = await callFunction("copilot", corps(org, p), { Authorization: `Bearer ${a.token}` });
  assertEquals(sansCle.status, 503);
  assertEquals((await sansCle.json()).error, "service_non_configure");
  // Projet d'une autre organisation : refusé
  const b = await createTestUser("ia-4b");
  const autre = await projet(b, await orgDe(b));
  const intrus = await callFunction("copilot", corps(org, autre), { Authorization: `Bearer ${a.token}` });
  assertEquals(intrus.status, 404);
  await intrus.body?.cancel();
});

Deno.test("fonction fleet-import : 401 sans jeton, 403 si désactivée ou autre organisation, 503 propre sans clé", async () => {
  const a = await createTestUser("ia-5");
  const org = await orgDe(a);
  const corpsImport = (o: string) => ({
    organizationId: o,
    colonnes: [{ entete: "Asset #", exemples: ["T-12"], valeursDistinctes: null, nbValeurs: 1 }],
  });
  const sansJeton = await callFunction("fleet-import", corpsImport(org));
  assertEquals(sansJeton.status, 401);
  await sansJeton.body?.cancel();
  const desactivee = await callFunction("fleet-import", corpsImport(org), { Authorization: `Bearer ${a.token}` });
  assertEquals(desactivee.status, 403);
  assertEquals((await desactivee.json()).error, "fonction_desactivee");
  // copilote activé seul : l'import intelligent reste désactivé (fonction par fonction)
  await a.client.from("organization_ai_settings").insert({ organization_id: org, copilot_enabled: true });
  const autreFonction = await callFunction("fleet-import", corpsImport(org), { Authorization: `Bearer ${a.token}` });
  assertEquals(autreFonction.status, 403);
  await autreFonction.body?.cancel();
  await a.client.from("organization_ai_settings").update({ smart_import_enabled: true }).eq("organization_id", org);
  const sansCle = await callFunction("fleet-import", corpsImport(org), { Authorization: `Bearer ${a.token}` });
  assertEquals(sansCle.status, 503);
  assertEquals((await sansCle.json()).error, "service_non_configure");
  // organisation d'autrui : réglages illisibles (RLS) ⇒ refusé
  const b = await createTestUser("ia-5b");
  const intrus = await callFunction("fleet-import", corpsImport(await orgDe(b)), { Authorization: `Bearer ${b.token}` });
  assertEquals(intrus.status, 403);
  await intrus.body?.cancel();
  const croise = await callFunction("fleet-import", corpsImport(org), { Authorization: `Bearer ${b.token}` });
  assertEquals(croise.status, 403);
  await croise.body?.cancel();
});
