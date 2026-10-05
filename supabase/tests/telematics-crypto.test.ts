// Chiffrement des identifiants télématiques (_shared/telematicsCrypto.ts) :
// tests PURS (aucun appel réseau, aucune base).
import { assert, assertEquals, assertNotEquals, assertRejects } from "jsr:@std/assert@1";
import {
  chiffrer,
  cleDepuisBase64,
  dechiffrer,
  DechiffrementError,
  CleAbsenteError,
  estChiffre,
  MARQUEUR_REVOQUE,
  trousseauDepuisEnv,
  type Trousseau,
} from "../functions/_shared/telematicsCrypto.ts";

const b64 = (s: string) => btoa(s);
const CLE_A = b64("cle-active-de-test-32-octets!!!!");
const CLE_B = b64("ancienne-cle-de-test-32-octets!!");
const CTX = { userId: "11111111-1111-1111-1111-111111111111", provider: "samsara" };
const SECRET = { apiToken: "samsara_api_jeton_tres_secret" };

async function trousseau(active = CLE_A, precedente?: string): Promise<Trousseau> {
  return trousseauDepuisEnv((n) => (n === "TELEMATICS_ENCRYPTION_KEY" ? active : n === "TELEMATICS_ENCRYPTION_KEY_PREVIOUS" ? precedente : undefined));
}

Deno.test("aller-retour : le chiffré ne contient pas le secret, le déchiffré est identique", async () => {
  const t = await trousseau();
  const c = await chiffrer(SECRET, CTX, t);
  assert(estChiffre(c), c);
  assert(!c.includes("samsara_api"));
  const d = await dechiffrer(c, CTX, t);
  assertEquals(d.valeur, SECRET);
  assertEquals(d.aRechiffrer, false);
});

Deno.test("IV aléatoire : deux chiffrements du même secret diffèrent", async () => {
  const t = await trousseau();
  assertNotEquals(await chiffrer(SECRET, CTX, t), await chiffrer(SECRET, CTX, t));
});

Deno.test("lié à l'utilisateur et au fournisseur (AAD) : recopié ailleurs, refusé", async () => {
  const t = await trousseau();
  const c = await chiffrer(SECRET, CTX, t);
  await assertRejects(() => dechiffrer(c, { ...CTX, userId: "22222222-2222-2222-2222-222222222222" }, t), DechiffrementError);
  await assertRejects(() => dechiffrer(c, { ...CTX, provider: "geotab" }, t), DechiffrementError);
});

Deno.test("chiffré altéré ou autre clé : refusé", async () => {
  const t = await trousseau();
  const c = await chiffrer(SECRET, CTX, t);
  const parties = c.split(".");
  const altere = [...parties.slice(0, 3), (parties[3][0] === "A" ? "B" : "A") + parties[3].slice(1)].join(".");
  await assertRejects(() => dechiffrer(altere, CTX, t), DechiffrementError);
  const autre = await trousseau(CLE_B);
  await assertRejects(() => dechiffrer(c, CTX, autre), DechiffrementError);
});

Deno.test("rotation : l'ancienne clé déchiffre encore et demande un re-chiffrement", async () => {
  const ancien = await chiffrer(SECRET, CTX, await trousseau(CLE_B));
  const t = await trousseau(CLE_A, CLE_B);
  const d = await dechiffrer(ancien, CTX, t);
  assertEquals(d.valeur, SECRET);
  assertEquals(d.aRechiffrer, true);
  const nouveau = await chiffrer(d.valeur, CTX, t);
  assertEquals(nouveau.split(".")[1], t.active.kid);
});

Deno.test("ancien format base64 : lu une dernière fois, marqué à re-chiffrer", async () => {
  const d = await dechiffrer(btoa(JSON.stringify(SECRET)), CTX, await trousseau());
  assertEquals(d.valeur, SECRET);
  assertEquals(d.aRechiffrer, true);
});

Deno.test("connexion retirée ou vide : erreur claire", async () => {
  const t = await trousseau();
  await assertRejects(() => dechiffrer(MARQUEUR_REVOQUE, CTX, t), DechiffrementError);
  await assertRejects(() => dechiffrer("", CTX, t), DechiffrementError);
  await assertRejects(() => dechiffrer("v1.zzzz.x.y", CTX, t), DechiffrementError);
});

Deno.test("clé : absente → CleAbsenteError ; longueur ≠ 32 octets → refus", async () => {
  await assertRejects(() => trousseauDepuisEnv(() => undefined), CleAbsenteError);
  await assertRejects(() => cleDepuisBase64(b64("trop-courte")), Error, "32 octets");
});

Deno.test("le format produit respecte la contrainte de la base (migration 20261008010000)", async () => {
  const sql = await Deno.readTextFile(new URL("../migrations/20261008010000_telematique_identifiants_chiffres.sql", import.meta.url));
  const motif = /encrypted_credentials ~ '([^']+)'/.exec(sql)![1].replace(/\\\\/g, "\\");
  const c = await chiffrer(SECRET, CTX, await trousseau());
  assert(new RegExp(motif).test(c), `${c} ne respecte pas ${motif}`);
  assert(!new RegExp(motif).test(btoa(JSON.stringify(SECRET))));
});
