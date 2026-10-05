// Point 5 — courriels prêts à activer : invitation d'ORGANISATION
// (gabarit organization_invite) et statut d'envoi (GET send-email).
// Environnement de test SANS SMTP (functions.env) : après les contrôles
// d'accès, la fonction répond 503 « service_non_configure » (l'interface le
// dit) ; dès que SMTP_PASSWORD existe, le même appel envoie le courriel
// (vérifié contre un faux serveur : smtp-envoi.test.ts).
import { assertEquals } from "jsr:@std/assert@1";
import { ANON_KEY, callFunction, createTestUser, functionUrl, type TestUser } from "./helpers.ts";

async function orgOf(user: TestUser): Promise<string> {
  const { data } = await user.client.from("organization_members").select("organization_id").eq("user_id", user.id).limit(1).single();
  return data!.organization_id;
}

async function inviter(user: TestUser, email: string): Promise<string> {
  const { data, error } = await user.client
    .from("organization_invitations")
    .insert({ organization_id: await orgOf(user), email, role: "member", invited_by: user.id })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

const envoyer = (user: TestUser | null, invitationId: string) =>
  callFunction(
    "send-email",
    { templateType: "organization_invite", data: { invitationId, lang: "fr" } },
    user ? { Authorization: `Bearer ${user.token}` } : {},
  );

Deno.test("statut d'envoi : 401 pour la clé anon seule, { active: false } sans SMTP", async () => {
  const anon = await fetch(functionUrl("send-email"), { headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` } });
  await anon.body?.cancel();
  assertEquals(anon.status, 401);
  const u = await createTestUser("courriel-statut");
  const r = await fetch(functionUrl("send-email"), { headers: { apikey: ANON_KEY, Authorization: `Bearer ${u.token}` } });
  assertEquals(r.status, 200);
  assertEquals(await r.json(), { active: false });
});

Deno.test("organization_invite : l'auteur admin passe les contrôles → 503 tant que l'envoi n'est pas branché", async () => {
  const admin = await createTestUser("courriel-admin");
  const id = await inviter(admin, `invite-${Date.now()}@example.com`);
  const r = await envoyer(admin, id);
  assertEquals(r.status, 503);
  assertEquals((await r.json()).error, "service_non_configure");
});

Deno.test("organization_invite : invitation d'autrui → 404 ; clé anon seule → 401", async () => {
  const admin = await createTestUser("courriel-admin2");
  const tiers = await createTestUser("courriel-tiers");
  const id = await inviter(admin, `invite2-${Date.now()}@example.com`);
  const r = await envoyer(tiers, id);
  await r.body?.cancel();
  assertEquals(r.status, 404);
  const anon = await envoyer(null, id);
  await anon.body?.cancel();
  assertEquals(anon.status, 401);
});
