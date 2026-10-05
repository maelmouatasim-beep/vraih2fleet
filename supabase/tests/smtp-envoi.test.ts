// Envoi RÉEL par SMTP (TLS implicite, comme le port 465 d'IONOS) contre le
// FAUX serveur local scripts/mock-smtp.mjs — aucun courriel ne quitte la
// machine. Fonctions servies avec supabase/tests/functions-e2e.env.
// Exécuté par l'étape e2e de la CI (MOCK_SMTP_HTTP défini) ; ignoré dans la
// passe d'intégration standard (functions.env, sans SMTP → 503 testés
// dans courriels-invitations.test.ts).
import { assert, assertEquals, assertStringIncludes } from "jsr:@std/assert@1";
import { adminClient, ANON_KEY, callFunction, createTestUser, functionUrl, type TestUser } from "./helpers.ts";

const MOCK = Deno.env.get("MOCK_SMTP_HTTP"); // ex. http://127.0.0.1:2466
const ignore = !MOCK;

interface Recu {
  from: string;
  to: string[];
  auth: string | null;
  subject: string;
  data: string;
}
const recus = async (): Promise<Recu[]> => (await fetch(`${MOCK}/messages`)).json();
const vider = async () => void (await (await fetch(`${MOCK}/messages`, { method: "DELETE" })).body?.cancel());

async function adminH2Fleet(label: string): Promise<TestUser> {
  const u = await createTestUser(label);
  const { error } = await adminClient().from("user_roles").insert({ user_id: u.id, role: "admin" });
  if (error) throw error;
  return u;
}

Deno.test({ name: "smtp : statut d'envoi { active: true } dès que SMTP_PASSWORD existe", ignore, fn: async () => {
  const u = await createTestUser("smtp-statut");
  const r = await fetch(functionUrl("send-email"), { headers: { apikey: ANON_KEY, Authorization: `Bearer ${u.token}` } });
  assertEquals(r.status, 200);
  assertEquals(await r.json(), { active: true });
} });

Deno.test({ name: "smtp : courriel de test refusé à un utilisateur ordinaire (403), rien n'est envoyé", ignore, fn: async () => {
  await vider();
  const u = await createTestUser("smtp-non-admin");
  const r = await callFunction("send-email", { templateType: "test_email", data: { to: "quelquun@example.com" } }, {
    Authorization: `Bearer ${u.token}`,
  });
  await r.body?.cancel();
  assertEquals(r.status, 403);
  assertEquals((await recus()).length, 0);
} });

Deno.test({ name: "smtp : courriel de test d'un administrateur H2Fleet → reçu, expéditeur noreply, identifiant de la boîte", ignore, fn: async () => {
  await vider();
  const a = await adminH2Fleet("smtp-admin");
  const dest = `verif-${Date.now()}@example.com`;
  const r = await callFunction("send-email", { templateType: "test_email", data: { to: dest } }, { Authorization: `Bearer ${a.token}` });
  assertEquals(r.status, 200, await r.clone().text());
  assertEquals((await r.json()).success, true);
  const m = await recus();
  assertEquals(m.length, 1);
  assertEquals(m[0].to, [dest]);
  assertEquals(m[0].from, "noreply@h2fleet.ca");
  assertEquals(m[0].auth, "noreply@h2fleet.test");
  assertStringIncludes(m[0].subject, "courriel de test");
  assertStringIncludes(m[0].data, "H2Fleet");
} });

Deno.test({ name: "smtp : invitation d'organisation envoyée au destinataire lu en base", ignore, fn: async () => {
  await vider();
  const admin = await createTestUser("smtp-invite");
  const { data: org } = await admin.client.from("organization_members").select("organization_id").eq("user_id", admin.id).limit(1).single();
  const invite = `invite-smtp-${Date.now()}@example.com`;
  const { data: inv, error } = await admin.client
    .from("organization_invitations")
    .insert({ organization_id: org!.organization_id, email: invite, role: "member", invited_by: admin.id })
    .select("id")
    .single();
  if (error) throw error;
  const r = await callFunction("send-email", { templateType: "organization_invite", data: { invitationId: inv.id, lang: "fr" } }, {
    Authorization: `Bearer ${admin.token}`,
  });
  assertEquals(r.status, 200, await r.clone().text());
  await r.body?.cancel();
  const m = await recus();
  assertEquals(m.length, 1);
  assertEquals(m[0].to, [invite]);
  assert(m[0].subject.length > 0);
} });

Deno.test({ name: "smtp : mot de passe refusé par le serveur → 502 smtp_auth (message clair dans Paramètres)", ignore, fn: async () => {
  await vider();
  const a = await adminH2Fleet("smtp-auth");
  await (await fetch(`${MOCK}/refuser-auth?actif=1`, { method: "POST" })).body?.cancel();
  try {
    const r = await callFunction("send-email", { templateType: "test_email", data: { to: "verif-auth@example.com" } }, {
      Authorization: `Bearer ${a.token}`,
    });
    assertEquals(r.status, 502);
    assertEquals(await r.json(), { error: "smtp_auth" });
    assertEquals((await recus()).length, 0);
  } finally {
    await (await fetch(`${MOCK}/refuser-auth?actif=0`, { method: "POST" })).body?.cancel();
  }
} });
