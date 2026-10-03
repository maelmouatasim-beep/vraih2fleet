// scripts/admin-heberge.mjs — SQL d'administration du projet hébergé
// (rôle admin H2Fleet + activation des fonctions IA), testé contre la base
// LOCALE : effet attendu, idempotence, quotas existants préservés (sauf 0),
// aucune injection par l'adresse.
import { assert, assertEquals } from "jsr:@std/assert@1";
import postgres from "npm:postgres@3.4.5";
import { adminClient, createTestUser, DB_URL } from "./helpers.ts";
import { QUOTAS_TEST, requeteAdmin } from "../../scripts/admin-heberge.mjs";

const sql = postgres(DB_URL, { max: 1 });

async function orgDe(userId: string): Promise<string> {
  const { data } = await adminClient().from("organization_members").select("organization_id").eq("user_id", userId).single();
  return data!.organization_id;
}

Deno.test("admin-heberge : rôle admin H2Fleet + 4 fonctions IA activées, idempotent", async () => {
  const u = await createTestUser("admin-heberge");
  const org = await orgDe(u.id);

  const [r1] = await sql.unsafe(requeteAdmin(u.email.toUpperCase()));
  assertEquals(r1.compte_trouve, 1);
  assertEquals(r1.role_ajoute, 1);
  assertEquals(r1.organisations_activees, 1);
  const [s] = await sql`select * from public.organization_ai_settings where organization_id = ${org}`;
  assert(s.copilot_enabled && s.smart_import_enabled && s.document_reading_enabled && s.council_note_enabled);
  assertEquals([s.monthly_token_limit, s.daily_request_limit], [QUOTAS_TEST.jetonsParMois, QUOTAS_TEST.requetesParJour]);

  // rejoué : rien de plus
  const [r2] = await sql.unsafe(requeteAdmin(u.email));
  assertEquals([r2.role_admin, r2.role_ajoute, r2.organisations_activees], [1, 0, 1]);
  const [{ n }] = await sql`select count(*)::int as n from public.user_roles where user_id = ${u.id} and role = 'admin'`;
  assertEquals(n, 1);
});

Deno.test("admin-heberge : quotas choisis conservés, quota à 0 remplacé, fonction désactivée réactivée", async () => {
  const u = await createTestUser("admin-heberge-quotas");
  const org = await orgDe(u.id);
  await adminClient().from("organization_ai_settings").insert({
    organization_id: org,
    copilot_enabled: false,
    monthly_token_limit: 500000,
    daily_request_limit: 0,
  });
  await sql.unsafe(requeteAdmin(u.email));
  const [s] = await sql`select * from public.organization_ai_settings where organization_id = ${org}`;
  assertEquals(s.copilot_enabled, true);
  assertEquals(s.monthly_token_limit, 500000);
  assertEquals(s.daily_request_limit, QUOTAS_TEST.requetesParJour);
});

Deno.test("admin-heberge : adresse inconnue ou malveillante → aucun effet, aucune injection", async () => {
  const avant = await sql`select count(*)::int as n from public.user_roles`;
  const [r] = await sql.unsafe(requeteAdmin("x'$$; drop table public.user_roles; --@example.com"));
  assertEquals(r.compte_trouve, 0);
  const apres = await sql`select count(*)::int as n from public.user_roles`;
  assertEquals(apres[0].n, avant[0].n);
});
