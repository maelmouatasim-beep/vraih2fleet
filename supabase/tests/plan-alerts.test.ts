// Phase 5.6 — surveillance du plan : état des alertes (plan_alerts) lisible
// par les membres du projet, synchronisé et « vu » par les éditeurs
// seulement (fonctions SQL), jamais écrit directement ; résumé par
// courriel : secret cron exigé, 503 propre sans SendGrid.
import { assert, assertEquals } from "jsr:@std/assert@1";
import { adminClient, callFunction, createTestUser, TEST_CRON_SECRET } from "./helpers.ts";

async function orgDe(userId: string): Promise<string> {
  const { data } = await adminClient().from("organization_members").select("organization_id").eq("user_id", userId).single();
  return data!.organization_id;
}

const alerte = (cle: string, gravite = "attention") => ({
  alert_key: cle,
  kind: "capacite_garage",
  severity: gravite,
  title_fr: "Capacité électrique dépassée : Garage municipal",
  title_en: "Electrical capacity exceeded: Garage municipal",
  message_fr: "Les bornes prévues demandent 120 kW pour 40 kW disponibles.",
  message_en: "Planned chargers need 120 kW for 40 kW available.",
});

Deno.test("surveillance : synchronisation par les éditeurs, lecture par les membres, « vue » tracée", async () => {
  const a = await createTestUser("alertes-a");
  const org = await orgDe(a.id);
  const { data: p } = await a.client.from("projects").insert({ name: "Surveillance", user_id: a.id, organization_id: org }).select("id").single();
  const projet = p!.id as string;

  const { data: ok, error } = await a.client.rpc("sync_plan_alerts", { _project: projet, _alerts: [alerte("garage:gm:120/40"), alerte("retard:x@2025")] });
  assertEquals(error, null);
  assertEquals(ok, true);
  const { data: lignes } = await a.client.from("plan_alerts").select("id, alert_key, resolved_at").eq("project_id", projet).order("alert_key");
  assertEquals(lignes?.map((l) => l.alert_key), ["garage:gm:120/40", "retard:x@2025"]);

  // une clé disparue est résolue ; elle redevient active si elle revient
  await a.client.rpc("sync_plan_alerts", { _project: projet, _alerts: [alerte("garage:gm:120/40")] });
  const { data: apres } = await a.client.from("plan_alerts").select("alert_key, resolved_at").eq("project_id", projet).order("alert_key");
  assert(apres?.[0].resolved_at === null && apres?.[1].resolved_at !== null);
  await a.client.rpc("sync_plan_alerts", { _project: projet, _alerts: [alerte("garage:gm:120/40"), alerte("retard:x@2025")] });
  const { data: reactivee } = await a.client.from("plan_alerts").select("resolved_at").eq("alert_key", "retard:x@2025").single();
  assertEquals(reactivee?.resolved_at, null);

  // lecteur de l'organisation : lit, ne synchronise pas, ne marque pas vue
  const lecteur = await createTestUser("alertes-lecteur");
  await adminClient().from("organization_members").insert({ organization_id: org, user_id: lecteur.id, role: "reader" });
  const { data: vuLecteur } = await lecteur.client.from("plan_alerts").select("id").eq("project_id", projet);
  assertEquals(vuLecteur?.length, 2);
  const { data: okLecteur } = await lecteur.client.rpc("sync_plan_alerts", { _project: projet, _alerts: [] });
  assertEquals(okLecteur, false);
  const { count } = await adminClient().from("plan_alerts").select("id", { count: "exact", head: true }).eq("project_id", projet).is("resolved_at", null);
  assertEquals(count, 2, "un lecteur ne résout rien");
  const { error: errVue } = await lecteur.client.rpc("dismiss_plan_alert", { _alert: lignes![0].id });
  assert(errVue, "un lecteur ne marque pas vue");

  // étranger : rien à lire, aucune écriture directe
  const b = await createTestUser("alertes-b");
  const { data: vuB } = await b.client.from("plan_alerts").select("id").eq("project_id", projet);
  assertEquals(vuB, []);
  const { error: errInsert } = await a.client.from("plan_alerts").insert({ project_id: projet, ...alerte("forge") });
  assert(errInsert, "aucune insertion directe, même par l'éditeur");

  // l'éditeur marque vue : qui et quand
  const { error: errA } = await a.client.rpc("dismiss_plan_alert", { _alert: lignes![0].id });
  assertEquals(errA, null);
  const { data: vue } = await a.client.from("plan_alerts").select("dismissed_at, dismissed_by").eq("id", lignes![0].id).single();
  assertEquals(vue?.dismissed_by, a.id);
  assert(vue?.dismissed_at);
});

Deno.test("surveillance : liste invalide refusée", async () => {
  const a = await createTestUser("alertes-c");
  const org = await orgDe(a.id);
  const { data: p } = await a.client.from("projects").insert({ name: "S2", user_id: a.id, organization_id: org }).select("id").single();
  const { error } = await a.client.rpc("sync_plan_alerts", { _project: p!.id, _alerts: { pas: "une liste" } });
  assert(error);
  const { error: errKind } = await a.client.rpc("sync_plan_alerts", { _project: p!.id, _alerts: [{ ...alerte("k"), kind: "inventé" }] });
  assert(errKind, "type d'alerte hors liste refusé");
});

Deno.test("plan-alerts-digest : secret cron exigé ; sans SendGrid → 503 service_non_configure", async () => {
  const sans = await callFunction("plan-alerts-digest", {});
  assertEquals(sans.status, 401);
  await sans.body?.cancel();
  const avec = await callFunction("plan-alerts-digest", {}, { "x-cron-secret": TEST_CRON_SECRET });
  assertEquals(avec.status, 503);
  assertEquals((await avec.json()).error, "service_non_configure");
});
