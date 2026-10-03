// Notifications de bout en bout côté base : chaque émetteur insère un type
// autorisé avec les paramètres des textes (payload) ; préférences du
// destinataire respectées à la source ; alertes du plan et tâches générées
// versées dans la cloche de l'équipe ; RLS (lecture et mise à jour par le
// destinataire seul, « lu »/« archivé » uniquement) ; publication temps réel.
import { assert, assertEquals, assertNotEquals } from "jsr:@std/assert@1";
import postgres from "npm:postgres@3.4.5";
import { adminClient, createTestUser, DB_URL, type TestUser } from "./helpers.ts";

const sql = postgres(DB_URL, { max: 1 });

async function orgDe(userId: string): Promise<string> {
  const { data } = await adminClient().from("organization_members").select("organization_id").eq("user_id", userId).single();
  return data!.organization_id;
}

async function notificationsDe(u: TestUser, type?: string) {
  let q = u.client.from("notifications").select("*").eq("user_id", u.id).order("created_at");
  if (type) q = q.eq("type", type);
  const { data, error } = await q;
  assertEquals(error, null);
  return data ?? [];
}

async function projetPartage(label: string) {
  const a = await createTestUser(`${label}-a`);
  const b = await createTestUser(`${label}-b`);
  await adminClient().from("profiles").update({ full_name: "Jeanne Tremblay" }).eq("id", a.id);
  const org = await orgDe(a.id);
  const { data: p, error } = await a.client.from("projects").insert({ name: "Ville de Rivière-Claire", user_id: a.id, organization_id: org }).select("id").single();
  assertEquals(error, null);
  const projet = p!.id as string;
  await adminClient().from("project_collaborators").insert({ project_id: projet, user_id: b.id, role: "editor", invited_by: a.id });
  return { a, b, projet };
}

Deno.test("notifications : chaque émetteur insère un type autorisé, avec projet, auteur et sujet", async () => {
  const { a, b, projet } = await projetPartage("notif-emetteurs");

  // invitation (trigger sur project_collaborators)
  const [inv] = await notificationsDe(b, "invitation");
  assertEquals(inv.payload.project, "Ville de Rivière-Claire");
  assertEquals(inv.payload.role, "editor");

  // commentaire du collaborateur → propriétaire
  await adminClient().from("project_comments").insert({ project_id: projet, user_id: b.id, content: "Bonne idée" });
  const [com] = await notificationsDe(a, "comment");
  assertEquals(com.payload.v, 1);
  assertEquals(com.payload.project, "Ville de Rivière-Claire");

  // version enregistrée par le propriétaire d'un projet PARTAGÉ (corrige « NEW.name »)
  const { error: errVersion } = await adminClient()
    .from("project_versions")
    .insert({ project_id: projet, created_by: a.id, version_name: "Plan v2", snapshot: {} });
  assertEquals(errVersion, null);
  const [ver] = await notificationsDe(b, "version");
  assertEquals(ver.payload.subject, "Plan v2");
  assertEquals(ver.payload.actor, "Jeanne Tremblay");
  assertEquals((await notificationsDe(a, "version")).length, 0); // pas l'auteur

  // tâche assignée + mention
  const { data: t } = await a.client.from("tasks").insert({ project_id: projet, title: "Remplacer U-12", assigned_to: [b.id], created_by: a.id }).select("id").single();
  const [tache] = await notificationsDe(b, "task_assigned");
  assertEquals(tache.payload.subject, "Remplacer U-12");
  assertEquals(tache.related_id, t!.id);
  await adminClient().from("task_comments").insert({ task_id: t!.id, user_id: a.id, content: "@b", mentions: [b.id] });
  const [mention] = await notificationsDe(b, "task_mentioned");
  assertEquals(mention.payload.subject, "Remplacer U-12");
  assertEquals(mention.payload.actor, "Jeanne Tremblay");
});

Deno.test("notifications : tâches du plan générées → une notification groupée pour l'équipe", async () => {
  const { a, b, projet } = await projetPartage("notif-generees");
  const lignes = [1, 2, 3].map((i) => ({ project_id: projet, title: `Tâche ${i}`, status: "todo", auto_key: `k${i}`, created_by: a.id }));
  const { error } = await a.client.from("tasks").insert(lignes);
  assertEquals(error, null);
  for (const u of [a, b]) {
    const n = await notificationsDe(u, "tasks_generated");
    assertEquals(n.length, 1);
    assertEquals(n[0].payload.count, 3);
    assertEquals(n[0].actor_id, a.id);
    assertEquals(n[0].project_id, projet);
  }
  // une tâche manuelle (sans auto_key) ne déclenche rien
  await a.client.from("tasks").insert({ project_id: projet, title: "Manuelle", status: "todo", created_by: a.id });
  assertEquals((await notificationsDe(b, "tasks_generated")).length, 1);
});

Deno.test("notifications : une catégorie désactivée par le destinataire n'est pas créée", async () => {
  const { a, b, projet } = await projetPartage("notif-preferences");
  const { error } = await b.client.from("profiles").update({ notification_preferences: { tasks: false } }).eq("id", b.id);
  assertEquals(error, null);
  await a.client.from("tasks").insert([{ project_id: projet, title: "T", status: "todo", auto_key: "p1", created_by: a.id }]);
  await a.client.from("tasks").insert({ project_id: projet, title: "Assignée", assigned_to: [b.id], created_by: a.id });
  assertEquals((await notificationsDe(b, "tasks_generated")).length, 0);
  assertEquals((await notificationsDe(b, "task_assigned")).length, 0);
  assertEquals((await notificationsDe(a, "tasks_generated")).length, 1); // a n'a rien désactivé
  // les autres catégories restent actives
  await adminClient().from("project_comments").insert({ project_id: projet, user_id: a.id, content: "?" });
  assertEquals((await notificationsDe(b, "comment")).length, 1);
});

Deno.test("notifications : alertes du plan (critique/attention) versées dans la cloche, textes fr/en, sans doublon", async () => {
  const { a, b, projet } = await projetPartage("notif-alertes");
  const alerte = (cle: string, gravite: string) => ({
    alert_key: cle,
    kind: "echeance_subvention",
    severity: gravite,
    title_fr: "Échéance PAVÉ dans 30 jours",
    title_en: "PAVÉ deadline in 30 days",
    message_fr: "Déposer la demande avant le 2026-11-02.",
    message_en: "Submit the application before 2026-11-02.",
  });
  await a.client.rpc("sync_plan_alerts", { _project: projet, _alerts: [alerte("pave", "attention"), alerte("info", "info")] });
  await a.client.rpc("sync_plan_alerts", { _project: projet, _alerts: [alerte("pave", "attention"), alerte("info", "info")] });
  for (const u of [a, b]) {
    const n = await notificationsDe(u, "plan_alert");
    assertEquals(n.length, 1, "une seule notification malgré deux synchronisations ; « info » exclue");
    assertEquals(n[0].payload.kind, "echeance_subvention");
    assertEquals(n[0].payload.title_en, "PAVÉ deadline in 30 days");
  }
  // résolue puis revenue → nouvelle notification
  await a.client.rpc("sync_plan_alerts", { _project: projet, _alerts: [] });
  await a.client.rpc("sync_plan_alerts", { _project: projet, _alerts: [alerte("pave", "critique")] });
  assertEquals((await notificationsDe(b, "plan_alert")).length, 2);
});

Deno.test("notifications : RLS — lecture et mise à jour par le destinataire, « lu » et « archivé » seulement", async () => {
  const { a, b, projet } = await projetPartage("notif-rls");
  await adminClient().from("project_comments").insert({ project_id: projet, user_id: b.id, content: "x" });
  const [n] = await notificationsDe(a, "comment");

  // b ne voit pas la notification de a, ni ne la modifie
  const { data: vue } = await b.client.from("notifications").select("id").eq("id", n.id);
  assertEquals(vue, []);
  await b.client.from("notifications").update({ is_read: true }).eq("id", n.id);
  const { data: inchangee } = await adminClient().from("notifications").select("is_read").eq("id", n.id).single();
  assertEquals(inchangee!.is_read, false);

  // aucune insertion directe
  const { error: errInsert } = await a.client.from("notifications").insert({ user_id: b.id, type: "comment", title: "faux", message: "faux" });
  assertNotEquals(errInsert, null);

  // a : lu + archivé OK ; texte non modifiable
  const { error: errLu } = await a.client.from("notifications").update({ is_read: true, archived_at: new Date().toISOString() }).eq("id", n.id);
  assertEquals(errLu, null);
  const { error: errTitre } = await a.client.from("notifications").update({ title: "modifié" }).eq("id", n.id);
  assertNotEquals(errTitre, null);

  // compteur exact : non lues ET non archivées
  const { count } = await a.client.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", a.id).eq("is_read", false).is("archived_at", null);
  assertEquals(count, 0);
});

Deno.test("notifications : table dans la publication temps réel, contrainte et émetteurs cohérents", async () => {
  const [pub] = await sql`select count(*)::int as n from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications'`;
  assertEquals(pub.n, 1);
  // tout littéral de type présent dans une fonction émettrice est autorisé par la contrainte
  const [{ def }] = await sql`select pg_get_constraintdef(oid) as def from pg_constraint where conname = 'notifications_type_check'`;
  const autorises = new Set([...def.matchAll(/'([a-z_]+)'::text/g)].map((m: RegExpMatchArray) => m[1]));
  const fonctions = await sql`
    select p.proname, p.prosrc from pg_proc p
     where p.pronamespace = 'public'::regnamespace
       and (p.prosrc ilike '%into notifications%' or p.prosrc ilike '%into public.notifications%')`;
  assert(fonctions.length >= 8);
  for (const f of fonctions) {
    const types = [...String(f.prosrc).matchAll(/'(comment|reply|invitation|version|role_change|task_[a-z]+|tasks_[a-z]+|milestone_[a-z]+|collaboration_[a-z]+|subsidy|plan_alert)'/g)].map((m) => m[1]);
    for (const t of types) assert(autorises.has(t), `${f.proname} insère « ${t} », refusé par la contrainte`);
  }
  await sql.end();
});
