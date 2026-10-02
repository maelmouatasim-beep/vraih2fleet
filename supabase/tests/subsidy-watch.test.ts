// Phase 5.5 — veille des subventions : file de validation réservée aux
// administrateurs H2Fleet, validation atomique (événement visible par
// tous), rejet, aucune écriture directe, jamais deux fois la même détection.
import { assert, assertEquals } from "jsr:@std/assert@1";
import { adminClient, createTestUser } from "./helpers.ts";

async function deposer(cle: string) {
  const { data, error } = await adminClient()
    .from("subsidy_watch_changes")
    .insert({
      program_id: "pave",
      source_url: "https://tc.canada.ca/en/road-transportation/innovative-technologies/electric-vehicles/electric-vehicle-affordability-program",
      change_kind: "montant",
      facts_added: [{ type: "montant", valeur: "4000", extrait: "Incitatif maximal : 4 000 $." }],
      facts_removed: [{ type: "montant", valeur: "5000", extrait: "Incitatif maximal : 5 000 $." }],
      excerpt_before: "Incitatif maximal : 5 000 $.",
      excerpt_after: "Incitatif maximal : 4 000 $.",
      archive_path: "data/veille/2026-10-05/pave.txt",
      dedupe_key: cle,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

Deno.test("veille : file réservée aux administrateurs H2Fleet ; validation → événement visible par tous", async () => {
  const cle = `pave:montant:${crypto.randomUUID()}`;
  const id = await deposer(cle);
  // même détection redéposée : refusée (clé unique)
  const { error: errDouble } = await adminClient().from("subsidy_watch_changes").insert({
    program_id: "pave", source_url: "https://x.ca", change_kind: "montant", dedupe_key: cle,
  });
  assert(errDouble, "clé de dédoublonnage unique");

  const membre = await createTestUser("veille-1");
  const { data: vuParMembre } = await membre.client.from("subsidy_watch_changes").select("id").eq("id", id);
  assertEquals(vuParMembre, []);
  const { error: errMembre } = await membre.client.rpc("validate_subsidy_change", { _change: id, _summary_fr: "PAVÉ : plafond 4 000 $", _summary_en: "EVAP: cap $4,000" });
  assert(errMembre, "un utilisateur ordinaire ne valide pas");
  const { error: errInsert } = await membre.client.from("subsidy_watch_changes").insert({
    program_id: "pave", source_url: "https://x.ca", change_kind: "statut", dedupe_key: `x:${crypto.randomUUID()}`,
  });
  assert(errInsert, "aucun dépôt direct");

  const admin = await createTestUser("veille-admin");
  await adminClient().from("user_roles").insert({ user_id: admin.id, role: "admin" });
  const { data: vuParAdmin } = await admin.client.from("subsidy_watch_changes").select("id, status").eq("id", id);
  assertEquals(vuParAdmin?.[0]?.status, "pending");
  const { data: evenement, error } = await admin.client.rpc("validate_subsidy_change", {
    _change: id,
    _summary_fr: "PAVÉ : l'incitatif maximal passe de 5 000 $ à 4 000 $.",
    _summary_en: "EVAP: the maximum incentive drops from $5,000 to $4,000.",
    _note: "lu sur la page officielle",
  });
  assertEquals(error, null);
  const { data: lu } = await membre.client.from("subsidy_program_events").select("program_id, summary_fr, validated_by").eq("id", evenement);
  assertEquals(lu?.[0]?.program_id, "pave");
  assertEquals(lu?.[0]?.validated_by, admin.id);
  // déjà traité : ni revalidé ni rejeté
  const { error: errRevalide } = await admin.client.rpc("validate_subsidy_change", { _change: id, _summary_fr: "encore", _summary_en: "again" });
  assert(errRevalide);
  const { error: errRejet } = await admin.client.rpc("reject_subsidy_change", { _change: id });
  assert(errRejet);
  // un événement ne s'écrit jamais directement
  const { error: errEvt } = await admin.client.from("subsidy_program_events").insert({
    change_id: id, program_id: "pave", change_kind: "montant", summary_fr: "xxxxx", summary_en: "xxxxx", source_url: "https://x.ca",
  });
  assert(errEvt, "aucune insertion directe d'événement");
});

Deno.test("veille : rejet par un administrateur, sans événement", async () => {
  const id = await deposer(`pave:montant:${crypto.randomUUID()}`);
  const admin = await createTestUser("veille-admin-2");
  await adminClient().from("user_roles").insert({ user_id: admin.id, role: "admin" });
  const { error } = await admin.client.rpc("reject_subsidy_change", { _change: id, _note: "faux positif : bandeau promotionnel" });
  assertEquals(error, null);
  const { data } = await admin.client.from("subsidy_watch_changes").select("status, review_note, reviewed_by").eq("id", id).single();
  assertEquals(data?.status, "rejected");
  assertEquals(data?.reviewed_by, admin.id);
  const { data: evts } = await admin.client.from("subsidy_program_events").select("id").eq("change_id", id);
  assertEquals(evts, []);
});
