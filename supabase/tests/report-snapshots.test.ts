// Règle A1 : snapshots de rapports — insertion par un éditeur du
// projet, isolation, et IMMUABILITÉ (aucune politique UPDATE/DELETE).
import { assert, assertEquals } from "jsr:@std/assert@1";
import { createTestUser } from "./helpers.ts";

async function creerProjet(user: Awaited<ReturnType<typeof createTestUser>>): Promise<string> {
  const { data, error } = await user.client
    .from("projects")
    .insert({ name: "Projet snapshot", user_id: user.id })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

const SNAPSHOT = {
  strategy_key: "plan_actuel",
  report_kind: "pdf_fr",
  engine_version: "2.1.0",
  fingerprint: "abcdef0123456789",
  parameters: { parametres: { horizonAns: 10 } },
  van: 12345.67,
};

Deno.test("le propriétaire du projet fige un rapport et le relit", async () => {
  const a = await createTestUser("snapshot-1");
  const projet = await creerProjet(a);
  const { error } = await a.client
    .from("report_snapshots")
    .insert({ ...SNAPSHOT, project_id: projet, created_by: a.id });
  if (error) throw error;
  const { data } = await a.client.from("report_snapshots").select("van").eq("project_id", projet);
  assertEquals(data?.length, 1);
});

Deno.test("un tiers ne lit pas les snapshots d'un projet qui n'est pas le sien", async () => {
  const a = await createTestUser("snapshot-2");
  const b = await createTestUser("snapshot-3");
  const projet = await creerProjet(a);
  await a.client.from("report_snapshots").insert({ ...SNAPSHOT, project_id: projet, created_by: a.id });
  const { data } = await b.client.from("report_snapshots").select("id").eq("project_id", projet);
  assertEquals(data ?? [], []);
});

Deno.test("un snapshot émis est IMMUABLE : ni mise à jour ni suppression, même par son auteur", async () => {
  const a = await createTestUser("snapshot-4");
  const projet = await creerProjet(a);
  const { data: ligne, error } = await a.client
    .from("report_snapshots")
    .insert({ ...SNAPSHOT, project_id: projet, created_by: a.id })
    .select("id")
    .single();
  if (error) throw error;

  const { data: maj } = await a.client
    .from("report_snapshots")
    .update({ van: 0 })
    .eq("id", ligne.id)
    .select();
  assertEquals(maj ?? [], [], "la mise à jour d'un snapshot doit être refusée");

  await a.client.from("report_snapshots").delete().eq("id", ligne.id);
  const { data: encore } = await a.client.from("report_snapshots").select("id").eq("id", ligne.id);
  assertEquals(encore?.length, 1, "la suppression d'un snapshot doit être refusée");
});
