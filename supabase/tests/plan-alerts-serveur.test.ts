// Recalcul planifié côté serveur : sync_plan_alerts_serveur est réservée au
// service_role (ni anon ni utilisateur connecté), et applique la même
// logique que sync_plan_alerts (insertion, rafraîchissement, résolution).
import { assert, assertEquals } from "jsr:@std/assert@1";
import { adminClient, createTestUser } from "./helpers.ts";

const ALERTE = { alert_key: "retard:x@2024", kind: "remplacement_retard", severity: "attention", title_fr: "Retard", title_en: "Late", message_fr: "m", message_en: "m" };

Deno.test("sync_plan_alerts_serveur : refusée à un utilisateur, acceptée pour le service_role", async () => {
  const u = await createTestUser("alertes-serveur");
  const { data: projet, error } = await u.client.from("projects").insert({ name: "Alertes serveur", user_id: u.id }).select("id").single();
  assertEquals(error, null, error?.message);

  const refus = await u.client.rpc("sync_plan_alerts_serveur", { _project: projet!.id, _alerts: [ALERTE] });
  assert(refus.error, "un utilisateur ne doit pas pouvoir appeler la variante serveur");

  const admin = adminClient();
  const ok = await admin.rpc("sync_plan_alerts_serveur", { _project: projet!.id, _alerts: [ALERTE] });
  assertEquals(ok.error, null, ok.error?.message);
  assertEquals(ok.data, true);
  const { data: lignes } = await u.client.from("plan_alerts").select("alert_key, resolved_at").eq("project_id", projet!.id);
  assertEquals(lignes?.length, 1);
  assertEquals(lignes?.[0].resolved_at, null);

  // Liste vide : l'alerte est marquée résolue (jamais supprimée).
  await admin.rpc("sync_plan_alerts_serveur", { _project: projet!.id, _alerts: [] });
  const { data: apres } = await u.client.from("plan_alerts").select("resolved_at").eq("project_id", projet!.id);
  assert(apres?.[0].resolved_at, "absente du recalcul → résolue");
});
