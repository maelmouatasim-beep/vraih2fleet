// Revue E4 : les tâches générées par l'étape Suivi n'envoyaient pas
// created_by → 403 (policy INSERT created_by = auth.uid(), colonne sans
// défaut). Défaut auth.uid() ajouté ; usurpation toujours refusée.
import { assert, assertEquals } from "jsr:@std/assert@1";
import { createTestUser } from "./helpers.ts";

Deno.test("E4 : tâche insérée sans created_by → créée au nom de l'appelant", async () => {
  const a = await createTestUser("taches-1");
  const { data: projet, error: eProjet } = await a.client
    .from("projects")
    .insert({ name: "Projet tâches", user_id: a.id })
    .select("id")
    .single();
  assertEquals(eProjet, null);

  const { data: tache, error } = await a.client
    .from("tasks")
    .insert({ project_id: projet!.id, title: "Remplacer U-101", status: "todo", auto_key: "remplacement:u101" })
    .select("created_by")
    .single();
  assertEquals(error, null);
  assertEquals(tache!.created_by, a.id);
});

Deno.test("E4 : created_by d'un autre utilisateur toujours refusé", async () => {
  const a = await createTestUser("taches-2");
  const b = await createTestUser("taches-3");
  const { data: projet } = await a.client
    .from("projects")
    .insert({ name: "Projet usurpation", user_id: a.id })
    .select("id")
    .single();
  const { error } = await a.client
    .from("tasks")
    .insert({ project_id: projet!.id, title: "Tâche usurpée", status: "todo", created_by: b.id });
  assert(error, "une tâche au nom d'un autre utilisateur doit être refusée");
});
