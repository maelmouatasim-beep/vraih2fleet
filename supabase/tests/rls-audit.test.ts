// Audit RLS contre Supabase local (item B17) :
// 1. structurel : RLS activée sur TOUTES les tables du schéma public ;
// 2. isolation : un utilisateur A ne lit ni n'écrit les données de B ;
// 3. rôles : un collaborateur "viewer" ne peut pas écrire ;
// 4. politiques durcies par la migration 20260925120000 (subscriptions,
//    api_keys, notifications, pending_invitations, hydrogen_suppliers…).

import { assert, assertEquals } from "jsr:@std/assert@1";
import postgres from "npm:postgres@3.4.5";
import {
  adminClient,
  anonClient,
  createTestUser,
  DB_URL,
  type TestUser,
} from "./helpers.ts";

const sql = postgres(DB_URL, { max: 1 });

Deno.test("RLS est activée sur toutes les tables du schéma public", async () => {
  const rows = await sql`
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r' AND NOT c.relrowsecurity
  `;
  assertEquals(
    rows.map((r) => r.relname),
    [],
    `Tables sans RLS : ${rows.map((r) => r.relname).join(", ")}`,
  );
});

Deno.test("Toute table publique avec RLS refuse l'accès anonyme en lecture (sauf politiques explicites)", async () => {
  // Garde-fou générique : aucune table ne doit être lisible par anon,
  // à l'exception des tables de référence volontairement publiques.
  const PUBLIC_READ_ALLOWED = new Set([
    "incentives_programs",
    "reference_data_ranges",
    "reference_data_conditions",
    "reference_pricing",
    "reference_timelines",
  ]);
  const tables = await sql`
    SELECT c.relname FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r'
  `;
  const anon = anonClient();
  const leaky: string[] = [];
  for (const { relname } of tables) {
    if (PUBLIC_READ_ALLOWED.has(relname)) continue;
    const { data, error } = await anon.from(relname).select("*").limit(1);
    if (!error && (data?.length ?? 0) > 0) leaky.push(relname);
  }
  assertEquals(leaky, [], `Tables lisibles par anon : ${leaky.join(", ")}`);
});

// ─── Scénario A/B/viewer ────────────────────────────────────────────────────

let userA: TestUser;
let userB: TestUser;
let viewer: TestUser;
let projectA: string;
let scenarioA: string;
let roadmapA: string;
let phaseA: string;
let taskA: string;

async function setupOnce() {
  if (userA) return;
  userA = await createTestUser("a");
  userB = await createTestUser("b");
  viewer = await createTestUser("viewer");

  // Projet + données de A
  const { data: project, error: pErr } = await userA.client
    .from("projects")
    .insert({ name: "Projet A", user_id: userA.id })
    .select("id")
    .single();
  if (pErr) throw pErr;
  projectA = project.id;

  const { data: scenario, error: sErr } = await userA.client
    .from("scenarios")
    .insert({
      project_id: projectA,
      name: "Scénario A",
      region: "CA_QC",
      analysis_years: 10,
      discount_rate: 5,
      fleet_composition: { diesel: { count: 1, annualKm: 50000 }, ev: { count: 0, annualKm: 0 }, hydrogen: { count: 0, annualKm: 0 } },
    })
    .select("id")
    .single();
  if (sErr) throw sErr;
  scenarioA = scenario.id;

  const { data: roadmap, error: rErr } = await userA.client
    .from("transition_roadmaps")
    .insert({ project_id: projectA, name: "Roadmap A", start_date: "2026-01-01", end_date: "2030-12-31" })
    .select("id")
    .single();
  if (rErr) throw rErr;
  roadmapA = roadmap.id;

  const { data: phase, error: phErr } = await userA.client
    .from("roadmap_phases")
    .insert({ roadmap_id: roadmapA, name: "Phase 1", order_index: 1, start_date: "2026-01-01", end_date: "2026-12-31" })
    .select("id")
    .single();
  if (phErr) throw phErr;
  phaseA = phase.id;

  const { data: task, error: tErr } = await userA.client
    .from("tasks")
    .insert({ project_id: projectA, title: "Tâche A", created_by: userA.id })
    .select("id")
    .single();
  if (tErr) throw tErr;
  taskA = task.id;

  // viewer est collaborateur en lecture seule du projet de A
  const { error: cErr } = await userA.client
    .from("project_collaborators")
    .insert({ project_id: projectA, user_id: viewer.id, role: "viewer", invited_by: userA.id });
  if (cErr) throw cErr;
}

Deno.test("isolation A/B : B ne lit pas les données de A", async () => {
  await setupOnce();
  const tablesById: Array<[string, string, string]> = [
    ["projects", "id", projectA],
    ["scenarios", "id", scenarioA],
    ["transition_roadmaps", "id", roadmapA],
    ["roadmap_phases", "id", phaseA],
    ["tasks", "id", taskA],
    ["profiles", "id", userA.id],
    ["subscriptions", "user_id", userA.id],
    ["telematics_connections", "user_id", userA.id],
    ["api_keys", "user_id", userA.id],
    ["notifications", "user_id", userA.id],
  ];
  for (const [table, col, value] of tablesById) {
    const { data } = await userB.client.from(table).select("*").eq(col, value);
    assertEquals(data?.length ?? 0, 0, `${table} : B voit une ligne de A`);
  }
});

Deno.test("isolation A/B : B n'écrit pas dans les données de A", async () => {
  await setupOnce();
  // UPDATE du projet de A : aucune ligne touchée
  const { data: upd } = await userB.client
    .from("projects")
    .update({ name: "piraté" })
    .eq("id", projectA)
    .select("id");
  assertEquals(upd?.length ?? 0, 0);

  // INSERT d'un scénario dans le projet de A : refusé
  const { error: insErr } = await userB.client.from("scenarios").insert({
    project_id: projectA,
    name: "intrusion",
    region: "CA_QC",
    analysis_years: 10,
    discount_rate: 5,
    fleet_composition: {},
  });
  assert(insErr !== null, "B a pu créer un scénario dans le projet de A");

  // DELETE de la tâche de A : aucune ligne touchée
  const { data: del } = await userB.client
    .from("tasks")
    .delete()
    .eq("id", taskA)
    .select("id");
  assertEquals(del?.length ?? 0, 0);
});

Deno.test("viewer : lit la roadmap mais ne peut pas écrire (B13)", async () => {
  await setupOnce();
  // lecture OK
  const { data: phases } = await viewer.client
    .from("roadmap_phases")
    .select("id")
    .eq("roadmap_id", roadmapA);
  assertEquals(phases?.length, 1, "le viewer doit voir les phases");

  // écritures refusées
  const { error: insErr } = await viewer.client
    .from("roadmap_phases")
    .insert({ roadmap_id: roadmapA, name: "Phase pirate", order_index: 99, start_date: "2026-01-01", end_date: "2026-12-31" });
  assert(insErr !== null, "viewer a pu créer une phase");
  assertEquals(insErr!.code, "42501", `échec attendu par RLS, reçu : ${insErr!.code} ${insErr!.message}`);

  const { data: upd } = await viewer.client
    .from("roadmap_phases")
    .update({ name: "modifié" })
    .eq("id", phaseA)
    .select("id");
  assertEquals(upd?.length ?? 0, 0, "viewer a pu modifier une phase");

  const { error: msErr } = await viewer.client
    .from("roadmap_milestones")
    .insert({ phase_id: phaseA, title: "jalon pirate", type: "delivery", due_date: "2026-06-01" });
  assert(msErr !== null, "viewer a pu créer un jalon");
  assertEquals(msErr!.code, "42501", `échec attendu par RLS, reçu : ${msErr!.code} ${msErr!.message}`);

  const { error: cfErr } = await viewer.client
    .from("roadmap_cash_flow")
    .insert({ roadmap_id: roadmapA, date: "2026-06-01", type: "capex", amount: 1 });
  assert(cfErr !== null, "viewer a pu créer un flux de trésorerie");
  assertEquals(cfErr!.code, "42501", `échec attendu par RLS, reçu : ${cfErr!.code} ${cfErr!.message}`);

  const { error: taskErr } = await viewer.client
    .from("tasks")
    .insert({ project_id: projectA, title: "tâche pirate", created_by: viewer.id });
  assert(taskErr !== null, "viewer a pu créer une tâche");
});

Deno.test("B10 subscriptions : l'utilisateur ne modifie pas son tier/status", async () => {
  await setupOnce();
  const { data: before } = await userA.client
    .from("subscriptions")
    .select("tier")
    .eq("user_id", userA.id)
    .maybeSingle();
  const { data: upd } = await userA.client
    .from("subscriptions")
    .update({ tier: "large", status: "active" })
    .eq("user_id", userA.id)
    .select("id");
  assertEquals(upd?.length ?? 0, 0, "l'utilisateur a pu modifier sa subscription");
  const { data: after } = await userA.client
    .from("subscriptions")
    .select("tier")
    .eq("user_id", userA.id)
    .maybeSingle();
  assertEquals(after?.tier, before?.tier);
});

Deno.test("B11 api_keys : UPDATE limité à key_name/is_active", async () => {
  await setupOnce();
  const { data: key, error } = await userA.client
    .from("api_keys")
    .insert({
      user_id: userA.id,
      key_name: "clé test",
      key_hash: crypto.randomUUID().replaceAll("-", ""),
      key_prefix: "h2f_test0000",
    })
    .select("id, rate_limit_per_hour")
    .single();
  if (error) throw error;

  // renommage/désactivation : autorisé
  const { error: renameErr } = await userA.client
    .from("api_keys")
    .update({ key_name: "renommée", is_active: false })
    .eq("id", key.id);
  assertEquals(renameErr, null);

  // élévation de privilèges : bloquée par le trigger
  const { error: escErr } = await userA.client
    .from("api_keys")
    .update({ rate_limit_per_hour: 1_000_000 })
    .eq("id", key.id);
  assert(escErr !== null, "l'utilisateur a pu changer rate_limit_per_hour");

  const { error: scopesErr } = await userA.client
    .from("api_keys")
    .update({ scopes: ["*"] })
    .eq("id", key.id);
  assert(scopesErr !== null, "l'utilisateur a pu changer scopes");
});

Deno.test("B12 notifications : INSERT client refusé, types des triggers acceptés", async () => {
  await setupOnce();
  const { error } = await userA.client.from("notifications").insert({
    user_id: userB.id,
    type: "invitation",
    title: "spam",
    message: "spam",
  });
  assert(error !== null, "un client a pu insérer une notification");

  // la contrainte CHECK accepte les types utilisés par les triggers
  const admin = adminClient();
  for (const type of ["task_assigned", "task_mentioned", "milestone_assigned", "collaboration_accepted", "subsidy"]) {
    const { error: insErr } = await admin.from("notifications").insert({
      user_id: userA.id,
      type,
      title: "t",
      message: "m",
    });
    assertEquals(insErr, null, `type ${type} refusé par la contrainte CHECK`);
  }
});

Deno.test("B14 tasks : created_by ne peut pas être usurpé", async () => {
  await setupOnce();
  const { error } = await userA.client.from("tasks").insert({
    project_id: projectA,
    title: "usurpation",
    created_by: userB.id,
  });
  assert(error !== null, "created_by usurpé accepté");
});

Deno.test("B14 commentaires : project_id/task_id non modifiables", async () => {
  await setupOnce();
  const { data: comment, error } = await userA.client
    .from("project_comments")
    .insert({ project_id: projectA, user_id: userA.id, content: "test" })
    .select("id")
    .single();
  if (error) throw error;

  // second projet de A pour tenter le déplacement
  const { data: p2 } = await userA.client
    .from("projects")
    .insert({ name: "Projet A2", user_id: userA.id })
    .select("id")
    .single();
  const { error: moveErr } = await userA.client
    .from("project_comments")
    .update({ project_id: p2!.id })
    .eq("id", comment.id);
  assert(moveErr !== null, "project_id d'un commentaire modifiable");
});

Deno.test("B15 pending_invitations : SELECT par email du JWT fonctionne", async () => {
  await setupOnce();
  const { error: invErr } = await userA.client.from("pending_invitations").insert({
    email: userB.email,
    project_id: projectA,
    role: "viewer",
    invited_by: userA.id,
  });
  assertEquals(invErr, null);

  // B voit l'invitation qui vise son email (sans erreur "permission denied
  // for table users")
  const { data, error } = await userB.client
    .from("pending_invitations")
    .select("id, project_id")
    .eq("project_id", projectA);
  assertEquals(error, null);
  assertEquals(data?.length, 1);

  // le viewer, lui, ne la voit pas
  const { data: other } = await viewer.client
    .from("pending_invitations")
    .select("id")
    .eq("project_id", projectA);
  assertEquals(other?.length ?? 0, 0);
});

Deno.test("B16 hydrogen_suppliers : contacts réservés aux admins", async () => {
  await setupOnce();
  const admin = adminClient();
  const { error: seedErr } = await admin.from("hydrogen_suppliers").insert({
    company_name: "Fournisseur Test",
    supplier_type: "fuel_provider",
    country: "Canada",
    contact_email: "secret@fournisseur.example",
    contact_phone: "+1 555 0000",
  });
  assertEquals(seedErr, null, `seed fournisseur : ${seedErr?.message}`);

  // table de base : illisible pour un utilisateur normal
  const { data: baseRows } = await userA.client
    .from("hydrogen_suppliers")
    .select("*")
    .eq("company_name", "Fournisseur Test");
  assertEquals(baseRows?.length ?? 0, 0, "non-admin lit la table de base");

  // vue annuaire : lisible, sans colonnes de contact
  const { data: dirRows, error: dirErr } = await userA.client
    .from("hydrogen_suppliers_directory")
    .select("*")
    .eq("company_name", "Fournisseur Test");
  assertEquals(dirErr, null);
  assertEquals(dirRows?.length, 1, "la vue annuaire doit rester lisible");
  assert(!("contact_email" in dirRows![0]), "contact_email exposé par la vue");
  assert(!("contact_phone" in dirRows![0]), "contact_phone exposé par la vue");

  // anon : rien
  const { data: anonRows } = await anonClient()
    .from("hydrogen_suppliers_directory")
    .select("*")
    .limit(1);
  assertEquals(anonRows?.length ?? 0, 0);
});

Deno.test("email_leads : insert public OK, lecture refusée aux non-admins", async () => {
  await setupOnce();
  const { error: insErr } = await anonClient().from("email_leads").insert({
    email: "lead@example.com",
    source: "test",
  });
  assertEquals(insErr, null);
  const { data } = await userA.client.from("email_leads").select("*").limit(1);
  assertEquals(data?.length ?? 0, 0, "non-admin lit email_leads");
});

Deno.test({
  name: "fermeture de la connexion SQL",
  fn: async () => {
    await sql.end();
  },
  sanitizeResources: false,
  sanitizeOps: false,
});
