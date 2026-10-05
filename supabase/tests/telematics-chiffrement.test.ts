// Identifiants télématiques chiffrés de bout en bout (base + fonctions) :
// - la base refuse toute nouvelle écriture en clair (contrainte NOT VALID) ;
// - fetch-telematics-vehicles lit la connexion de l'APPELANT (RLS) et la
//   déchiffre côté serveur : aucune donnée d'identification dans la requête,
//   un chiffré d'un autre utilisateur est refusé (AAD) sans appel externe ;
// - authenticate-telematics valide son corps et ne renvoie jamais de
//   chiffré.
import { assert, assertEquals } from "jsr:@std/assert@1";
import { adminClient, createTestUser, SUPABASE_URL, ANON_KEY, TEST_TELEMATICS_KEY } from "./helpers.ts";
import { chiffrer, trousseauDepuisEnv } from "../functions/_shared/telematicsCrypto.ts";

const trousseau = () => trousseauDepuisEnv((n) => (n === "TELEMATICS_ENCRYPTION_KEY" ? TEST_TELEMATICS_KEY : undefined));

async function appeler(fn: string, token: string, corps: unknown) {
  const r = await fetch(`${SUPABASE_URL}/functions/v1/${fn}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, apikey: ANON_KEY, "Content-Type": "application/json", Origin: "http://localhost:8080" },
    body: JSON.stringify(corps),
  });
  return { status: r.status, json: await r.json().catch(() => ({})) };
}

Deno.test("base : écriture en clair (base64) refusée, chiffré v1 accepté, « revoque » accepté", async () => {
  const a = await createTestUser("telem-chif-1");
  const clair = await a.client.from("telematics_connections")
    .insert({ user_id: a.id, provider: "samsara", username: "x", encrypted_credentials: btoa('{"apiToken":"t"}') });
  assert(clair.error, "un base64 en clair doit être refusé");
  const ok = await a.client.from("telematics_connections")
    .insert({ user_id: a.id, provider: "samsara", username: "x", encrypted_credentials: await chiffrer({ apiToken: "t" }, { userId: a.id, provider: "samsara" }, await trousseau()) })
    .select("id").single();
  assertEquals(ok.error, null, ok.error?.message);
  const revoque = await a.client.from("telematics_connections")
    .update({ status: "disconnected", encrypted_credentials: "revoque" }).eq("id", ok.data!.id);
  assertEquals(revoque.error, null, revoque.error?.message);
});

Deno.test("fetch-telematics-vehicles : identifiants lus côté serveur, chiffré d'un autre utilisateur refusé", async () => {
  const a = await createTestUser("telem-chif-2");
  const b = await createTestUser("telem-chif-3");
  // Sans connexion : 404 (rien n'est lu d'autre que la connexion de l'appelant).
  const sans = await appeler("fetch-telematics-vehicles", b.token, { provider: "samsara" });
  assertEquals(sans.status, 404);
  // Chiffré lié à A recopié sur la connexion de B (par l'admin) : refusé (AAD).
  const chiffreA = await chiffrer({ apiToken: "jeton-de-a" }, { userId: a.id, provider: "samsara" }, await trousseau());
  const { error } = await adminClient().from("telematics_connections")
    .insert({ user_id: b.id, provider: "samsara", username: "b", encrypted_credentials: chiffreA, status: "connected" });
  assertEquals(error, null, error?.message);
  const vole = await appeler("fetch-telematics-vehicles", b.token, { provider: "samsara", encryptedCredentials: "ignoré" });
  assertEquals(vole.status, 401);
  assertEquals(vole.json.requiresReauth, true);
  // Fournisseur hors liste : 400.
  assertEquals((await appeler("fetch-telematics-vehicles", b.token, { provider: "inconnu" })).status, 400);
});

Deno.test("authenticate-telematics : corps invalide refusé, jamais de chiffré renvoyé", async () => {
  const a = await createTestUser("telem-chif-4");
  const r = await appeler("authenticate-telematics", a.token, { provider: "samsara" });
  assertEquals(r.status, 400);
  assert(!("credentials" in r.json));
  const autre = await appeler("authenticate-telematics", a.token, { provider: "inconnu", username: "u", password: "p" });
  assertEquals(autre.status, 400);
});
