// Chiffrement RÉEL des identifiants télématiques (jeton de session Geotab,
// jeton d'API Samsara) — AES-256-GCM via WebCrypto, côté serveur seulement.
//
// - Clé : secret Supabase TELEMATICS_ENCRYPTION_KEY (32 octets, base64 —
//   `openssl rand -base64 32`). Jamais dans le navigateur ni dans le dépôt.
// - Rotation : l'ancienne clé passe dans TELEMATICS_ENCRYPTION_KEY_PREVIOUS
//   (déchiffrement seulement) ; tout chiffré lu avec elle est re-chiffré
//   avec la clé active à la première utilisation (et par la synchro cron).
// - Format stocké : « v1.<kid>.<iv>.<chiffré> » (kid = 8 premiers hex du
//   SHA-256 de la clé ; iv 12 octets aléatoires ; base64url).
// - Données associées (AAD) = « <user_id>:<provider> » : un chiffré recopié
//   sur la connexion d'un autre utilisateur ou fournisseur ne se déchiffre
//   pas.
// - Ancien format (simple base64, avant octobre 2026) : encore LU, marqué
//   « à re-chiffrer » ; la base refuse toute nouvelle écriture en clair
//   (contrainte telematics_credentials_chiffrees).

export const PREFIXE = "v1";
/** Identifiants retirés par l'utilisateur (déconnexion). */
export const MARQUEUR_REVOQUE = "revoque";

export class CleAbsenteError extends Error {
  constructor() {
    super("TELEMATICS_ENCRYPTION_KEY non configurée");
  }
}

export class DechiffrementError extends Error {}

export interface Cle {
  kid: string;
  key: CryptoKey;
}

export interface Trousseau {
  active: Cle;
  precedentes: Cle[];
}

export interface Contexte {
  userId: string;
  provider: string;
}

const enc = new TextEncoder();
const dec = new TextDecoder();

function b64url(octets: Uint8Array): string {
  let s = "";
  for (const o of octets) s += String.fromCharCode(o);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function deB64(texte: string): Uint8Array<ArrayBuffer> {
  const b64 = texte.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
  const octets = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) octets[i] = bin.charCodeAt(i);
  return octets;
}

/** Clé AES-256 depuis sa forme base64 (32 octets exigés). */
export async function cleDepuisBase64(b64: string): Promise<Cle> {
  let brut: Uint8Array<ArrayBuffer>;
  try {
    brut = deB64(b64.trim());
  } catch {
    throw new Error("TELEMATICS_ENCRYPTION_KEY : base64 invalide");
  }
  if (brut.length !== 32) throw new Error(`TELEMATICS_ENCRYPTION_KEY : 32 octets attendus, ${brut.length} reçus`);
  const empreinte = new Uint8Array(await crypto.subtle.digest("SHA-256", brut));
  const kid = Array.from(empreinte.slice(0, 4), (o) => o.toString(16).padStart(2, "0")).join("");
  const key = await crypto.subtle.importKey("raw", brut, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
  return { kid, key };
}

/** Trousseau depuis l'environnement ; CleAbsenteError si la clé manque. */
export async function trousseauDepuisEnv(lire: (n: string) => string | undefined = (n) => Deno.env.get(n)): Promise<Trousseau> {
  const active = lire("TELEMATICS_ENCRYPTION_KEY");
  if (!active) throw new CleAbsenteError();
  const precedente = lire("TELEMATICS_ENCRYPTION_KEY_PREVIOUS");
  return {
    active: await cleDepuisBase64(active),
    precedentes: precedente ? [await cleDepuisBase64(precedente)] : [],
  };
}

const aad = (c: Contexte) => enc.encode(`${c.userId}:${c.provider}`);

export async function chiffrer(valeur: unknown, contexte: Contexte, t: Trousseau): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const chiffre = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: aad(contexte) }, t.active.key, enc.encode(JSON.stringify(valeur))),
  );
  return `${PREFIXE}.${t.active.kid}.${b64url(iv)}.${b64url(chiffre)}`;
}

export function estChiffre(texte: string | null | undefined): boolean {
  return typeof texte === "string" && /^v1\.[0-9a-f]{8}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(texte);
}

export interface Dechiffre<T> {
  valeur: T;
  /** Ancien format ou ancienne clé : à ré-écrire avec chiffrer(). */
  aRechiffrer: boolean;
}

export async function dechiffrer<T = Record<string, unknown>>(
  texte: string | null | undefined,
  contexte: Contexte,
  t: Trousseau,
): Promise<Dechiffre<T>> {
  if (!texte || texte === MARQUEUR_REVOQUE) throw new DechiffrementError("identifiants absents (connexion retirée)");
  if (!texte.startsWith(`${PREFIXE}.`)) {
    // Ancien format : base64 d'un JSON (lu une dernière fois, puis re-chiffré).
    try {
      return { valeur: JSON.parse(dec.decode(deB64(texte))) as T, aRechiffrer: true };
    } catch {
      throw new DechiffrementError("identifiants illisibles");
    }
  }
  if (!estChiffre(texte)) throw new DechiffrementError("format chiffré invalide");
  const [, kid, iv, chiffre] = texte.split(".");
  const cle = [t.active, ...t.precedentes].find((c) => c.kid === kid);
  if (!cle) throw new DechiffrementError("clé de chiffrement inconnue (rotation incomplète ?)");
  try {
    const clair = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: deB64(iv), additionalData: aad(contexte) },
      cle.key,
      deB64(chiffre),
    );
    return { valeur: JSON.parse(dec.decode(clair)) as T, aRechiffrer: cle.kid !== t.active.kid };
  } catch {
    throw new DechiffrementError("déchiffrement refusé (clé, utilisateur ou fournisseur différent)");
  }
}
