// Revue C5 : suivi des demandes de subvention — RLS alignée sur le
// projet (viewers lisent, editors écrivent, un tiers ne voit rien).
import { assert, assertEquals } from "jsr:@std/assert@1";
import { createTestUser } from "./helpers.ts";

Deno.test("C5 : le propriétaire du projet gère ses demandes, un tiers ne les voit pas", async () => {
  const a = await createTestUser("demandes-1");
  const b = await createTestUser("demandes-2");
  const { data: projet } = await a.client
    .from("projects")
    .insert({ name: "Projet demandes", user_id: a.id })
    .select("id")
    .single();

  const { data: creee, error: eInsert } = await a.client
    .from("subsidy_applications")
    .insert({
      project_id: projet!.id,
      program_id: "pave",
      status: "a_preparer",
      amount_requested: 5000,
    })
    .select("id, status")
    .single();
  assertEquals(eInsert, null, `insertion refusée : ${eInsert?.message}`);
  assertEquals(creee!.status, "a_preparer");

  // transition de statut + montant accordé
  const { error: eMaj } = await a.client
    .from("subsidy_applications")
    .update({ status: "accordee", amount_awarded: 4500, decision_date: "2026-05-01" })
    .eq("id", creee!.id);
  assertEquals(eMaj, null);

  // statut hors liste refusé par la contrainte CHECK
  const { error: eStatut } = await a.client
    .from("subsidy_applications")
    .update({ status: "en_reflexion" })
    .eq("id", creee!.id);
  assert(eStatut, "un statut hors liste doit être refusé");

  // un tiers ne voit rien et ne modifie rien
  const { data: vues } = await b.client.from("subsidy_applications").select("id").eq("id", creee!.id);
  assertEquals(vues ?? [], []);
  const { data: majTiers } = await b.client
    .from("subsidy_applications")
    .update({ amount_awarded: 999999 })
    .eq("id", creee!.id)
    .select();
  assertEquals(majTiers ?? [], []);
});
