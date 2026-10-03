// Phase 5.7 — note au conseil : table council_notes (lecture par les
// membres du projet, écriture par ses éditeurs, aucune suppression ;
// auteur et dates signés par la base ; snapshot du même projet seulement)
// et fonction `council-note` : 401 / 404 / 403 / 503 propre sans clé.
import { assert, assertEquals } from "jsr:@std/assert@1";
import { adminClient, callFunction, createTestUser, type TestUser } from "./helpers.ts";

async function orgDe(user: TestUser): Promise<string> {
  const { data } = await user.client.from("organization_members").select("organization_id").eq("user_id", user.id).limit(1).single();
  return data!.organization_id;
}

const SECTIONS = {
  recommandation: "Il est recommandé d'adopter le plan.",
  contexte: "Contexte.",
  couts: "Coûts.",
  financement: "Financement.",
  risques: "Risques.",
  hiver: "Hiver.",
  prochaines_etapes: "- Étape.",
};
const FAITS = [{ id: "van_centrale", valeur: 26563, rendu: { fr: "26 563 $", en: "$26,563" } }];

async function snapshot(client: TestUser["client"], projet: string, userId: string) {
  const { data, error } = await client
    .from("report_snapshots")
    .insert({
      project_id: projet,
      strategy_key: "plan_actuel",
      report_kind: "note_pdf",
      engine_version: "2.3.0",
      fingerprint: "abc",
      parameters: {},
      van: 1,
      tco_alt: 1,
      tco_ref: 2,
      created_by: userId,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

Deno.test("note au conseil : éditeurs écrivent, lecteurs lisent, étrangers rien ; auteur signé ; snapshot du même projet", async () => {
  const a = await createTestUser("note-a");
  const org = await orgDe(a);
  const { data: p } = await a.client.from("projects").insert({ name: "Note", user_id: a.id, organization_id: org }).select("id").single();
  const projet = p!.id as string;
  const snap = await snapshot(a.client, projet, a.id);

  const { data: note, error } = await a.client
    .from("council_notes")
    .insert({ project_id: projet, language: "fr", sections: SECTIONS, facts: FAITS, source: "ia", engine_version: "2.3.0", fingerprint: "abc", report_snapshot_id: snap, created_by: a.id })
    .select("id, updated_by, created_by")
    .single();
  assertEquals(error, null);
  assertEquals(note?.updated_by, a.id);

  const lecteur = await createTestUser("note-lecteur");
  await adminClient().from("organization_members").insert({ organization_id: org, user_id: lecteur.id, role: "reader" });
  const { data: lu } = await lecteur.client.from("council_notes").select("id").eq("project_id", projet);
  assertEquals(lu?.length, 1);
  const { data: modifie } = await lecteur.client.from("council_notes").update({ sections: { ...SECTIONS, couts: "x" } }).eq("id", note!.id).select("id");
  assertEquals(modifie, [], "un lecteur ne modifie pas");

  const b = await createTestUser("note-b");
  const { data: vuB } = await b.client.from("council_notes").select("id").eq("project_id", projet);
  assertEquals(vuB, []);
  const { error: errB } = await b.client
    .from("council_notes")
    .insert({ project_id: projet, language: "fr", sections: SECTIONS, facts: FAITS, source: "ia", engine_version: "2.3.0", fingerprint: "abc", created_by: b.id });
  assert(errB, "un étranger n'écrit pas");

  // Auteur et projet verrouillés à la modification
  const bOrg = await orgDe(b);
  const { data: pb } = await b.client.from("projects").insert({ name: "Autre", user_id: b.id, organization_id: bOrg }).select("id").single();
  await a.client.from("council_notes").update({ created_by: b.id, project_id: pb!.id }).eq("id", note!.id);
  const { data: apres } = await adminClient().from("council_notes").select("project_id, created_by").eq("id", note!.id).single();
  assertEquals(apres, { project_id: projet, created_by: a.id });

  // Snapshot d'un autre projet refusé
  const snapB = await snapshot(b.client, pb!.id, b.id);
  const { error: errSnap } = await a.client.from("council_notes").update({ report_snapshot_id: snapB }).eq("id", note!.id);
  assert(errSnap, "snapshot d'un autre projet refusé");

  // Aucune suppression
  await a.client.from("council_notes").delete().eq("id", note!.id);
  const { count } = await adminClient().from("council_notes").select("id", { count: "exact", head: true }).eq("id", note!.id);
  assertEquals(count, 1);
});

Deno.test("fonction council-note : 401 sans jeton, 404 projet d'autrui, 403 si désactivée, 503 propre sans clé", async () => {
  const a = await createTestUser("note-fn-a");
  const org = await orgDe(a);
  const { data: p } = await a.client.from("projects").insert({ name: "Note fn", user_id: a.id, organization_id: org }).select("id").single();
  const corps = { projectId: p!.id, langue: "fr", faits: [{ id: "van_centrale", libelle: "Économie", valeur: "26 563 $" }] };

  const sansJeton = await callFunction("council-note", corps);
  assertEquals(sansJeton.status, 401);
  await sansJeton.body?.cancel();

  const b = await createTestUser("note-fn-b");
  const croise = await callFunction("council-note", corps, { Authorization: `Bearer ${b.token}` });
  assertEquals(croise.status, 404);
  await croise.body?.cancel();

  const desactivee = await callFunction("council-note", corps, { Authorization: `Bearer ${a.token}` });
  assertEquals(desactivee.status, 403);
  assertEquals((await desactivee.json()).error, "fonction_desactivee");

  await a.client.from("organization_ai_settings").insert({ organization_id: org, council_note_enabled: true });
  const sansCle = await callFunction("council-note", corps, { Authorization: `Bearer ${a.token}` });
  assertEquals(sansCle.status, 503);
  assertEquals((await sansCle.json()).error, "service_non_configure");

  const invalide = await callFunction("council-note", { ...corps, faits: [{ id: "Pas Valide!", libelle: "x", valeur: "y" }] }, { Authorization: `Bearer ${a.token}` });
  assertEquals(invalide.status, 400);
  await invalide.body?.cancel();
});
