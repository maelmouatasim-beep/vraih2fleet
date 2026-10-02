// Phase 5.1 — journal des actions (plan_change_log) : immuable, lu par
// l'organisation, écrit seulement pour soi par qui peut modifier le
// projet ; stratégie « optimisee » et contraintes de l'optimiseur.
import { assert, assertEquals } from "jsr:@std/assert@1";
import { adminClient, createTestUser, type TestUser } from "./helpers.ts";

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
    .insert({ name: "Projet journal", user_id: user.id, organization_id: org })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

Deno.test("journal : un membre ajoute une action ; organisation et auteur posés par la base", async () => {
  const a = await createTestUser("journal-1");
  const org = await orgDe(a);
  const p = await projet(a, org);
  const autreOrg = await orgDe(await createTestUser("journal-1b"));
  const { data, error } = await a.client
    .from("plan_change_log")
    .insert({
      organization_id: autreOrg, // ignoré : remplacé par l'organisation du projet
      project_id: p,
      source: "optimiseur",
      action: "appliquer_strategie:optimisee",
      details: { changements: [{ cible: "C-01", champ: "replacement_year", avant: 2027, apres: 2029 }] },
    })
    .select()
    .single();
  if (error) throw error;
  assertEquals(data.organization_id, org);
  assertEquals(data.user_id, a.id);
});

Deno.test("journal : immuable (ni modification ni suppression) et invisible hors organisation", async () => {
  const a = await createTestUser("journal-2");
  const b = await createTestUser("journal-2b");
  const org = await orgDe(a);
  const p = await projet(a, org);
  const { data: ligne } = await a.client
    .from("plan_change_log")
    .insert({ organization_id: org, project_id: p, source: "strategie", action: "appliquer_strategie:plan_actuel" })
    .select("id")
    .single();
  const { data: maj } = await a.client.from("plan_change_log").update({ action: "falsifié" }).eq("id", ligne!.id).select();
  assertEquals(maj ?? [], []);
  await a.client.from("plan_change_log").delete().eq("id", ligne!.id);
  const { data: toujours } = await a.client.from("plan_change_log").select("action").eq("id", ligne!.id).single();
  assertEquals(toujours!.action, "appliquer_strategie:plan_actuel");
  const { data: vus } = await b.client.from("plan_change_log").select("id").eq("id", ligne!.id);
  assertEquals(vus ?? [], []);
});

Deno.test("journal : un reader lit mais n'écrit pas ; on n'écrit jamais au nom d'un autre", async () => {
  const a = await createTestUser("journal-3");
  const lecteur = await createTestUser("journal-3b");
  const org = await orgDe(a);
  await adminClient().from("organization_members").insert({ organization_id: org, user_id: lecteur.id, role: "reader" });
  const p = await projet(a, org);
  await a.client.from("plan_change_log").insert({ organization_id: org, project_id: p, source: "manuel", action: "test" });
  const { data: vus } = await lecteur.client.from("plan_change_log").select("id").eq("project_id", p);
  assertEquals(vus?.length, 1);
  const { error: eLecteur } = await lecteur.client
    .from("plan_change_log")
    .insert({ organization_id: org, project_id: p, source: "manuel", action: "lecteur" });
  assert(eLecteur, "un reader n'écrit pas dans le journal");
  const { error: eUsurpation } = await a.client
    .from("plan_change_log")
    .insert({ organization_id: org, project_id: p, source: "manuel", action: "usurpation", user_id: lecteur.id });
  assert(eUsurpation, "user_id doit être celui de l'appelant");
});

Deno.test("projet : stratégie « optimisee », contraintes et assignation enregistrées", async () => {
  const a = await createTestUser("journal-4");
  const org = await orgDe(a);
  const p = await projet(a, org);
  const { error } = await a.client
    .from("projects")
    .update({
      selected_strategy: "optimisee",
      optimizer_constraints: { objectif: "economies", budgetInvestissementAnnuel: 500000 },
      optimized_assignment: { calculeLe: "2026-10-03", vehicules: {} },
    })
    .eq("id", p);
  if (error) throw error;
  const { error: eInconnue } = await a.client.from("projects").update({ selected_strategy: "magique" }).eq("id", p);
  assert(eInconnue, "stratégie inconnue refusée");
  const { error: eSnap } = await a.client.from("report_snapshots").insert({
    project_id: p,
    strategy_key: "optimisee",
    report_kind: "pdf_fr",
    created_by: a.id,
    engine_version: "2.3.0",
    fingerprint: "x",
    parameters: {},
    van: 1,
    tco_alt: 1,
    tco_ref: 1,
  });
  if (eSnap) throw eSnap;
});
