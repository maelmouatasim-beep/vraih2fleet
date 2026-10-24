import { createHmac, hkdfSync, timingSafeEqual } from "node:crypto";

/**
 * Liens de téléchargement à durée courte (5 minutes), liés au document ET à
 * l'utilisateur : un lien transmis à un tiers ne sert à rien (la session et
 * la RLS sont vérifiées en plus de la signature).
 */
export const DOCUMENT_URL_TTL_SECONDS = 5 * 60;

export function signingKey(secret: string): Buffer {
  return Buffer.from(hkdfSync("sha256", secret, "leaseplace", "document-url-v1", 32));
}

function mac(key: Buffer, documentId: string, userId: string, expires: number): string {
  return createHmac("sha256", key)
    .update(`${documentId}|${userId}|${String(expires)}`)
    .digest("base64url");
}

export function signDocumentUrl(
  key: Buffer,
  documentId: string,
  userId: string,
  now = Date.now(),
): string {
  const expires = Math.floor(now / 1000) + DOCUMENT_URL_TTL_SECONDS;
  return `/api/documents/${documentId}?e=${String(expires)}&s=${mac(key, documentId, userId, expires)}`;
}

export function verifyDocumentUrl(
  key: Buffer,
  documentId: string,
  userId: string,
  expires: string | null,
  signature: string | null,
  now = Date.now(),
): boolean {
  if (!expires || !signature || !/^\d+$/.test(expires)) return false;
  const exp = Number(expires);
  if (exp < Math.floor(now / 1000)) return false;
  const expected = Buffer.from(mac(key, documentId, userId, exp));
  const given = Buffer.from(signature);
  return expected.length === given.length && timingSafeEqual(expected, given);
}
