/**
 * Stockage des documents derrière une interface. Implémentations : mémoire
 * (tests), disque local (développement, démonstration). Toutes passent la
 * même suite de contrat ; le chiffrement au repos s'ajoute par
 * `encryptedStorage`, quel que soit le support. Supabase Storage / S3 :
 * même interface, branchée au premier déploiement.
 */
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";

export interface ObjectStorage {
  readonly name: string;
  put(key: string, bytes: Uint8Array): Promise<void>;
  get(key: string): Promise<Uint8Array | null>;
  delete(key: string): Promise<void>;
}

export class InvalidKeyError extends Error {
  constructor(key: string) {
    super(`Clé de stockage invalide : ${key}`);
    this.name = "InvalidKeyError";
  }
}

/** Clés « segment/segment » en caractères sûrs : aucune traversée de répertoire possible. */
export function assertKey(key: string): void {
  if (!/^[A-Za-z0-9_-]+(\/[A-Za-z0-9_-]+)*$/.test(key) || key.length > 300)
    throw new InvalidKeyError(key);
}

export function createMemoryStorage(): ObjectStorage & { readonly size: number } {
  const objects = new Map<string, Uint8Array>();
  return {
    name: "memory",
    get size() {
      return objects.size;
    },
    async put(key, bytes) {
      await Promise.resolve();
      assertKey(key);
      objects.set(key, new Uint8Array(bytes));
    },
    async get(key) {
      await Promise.resolve();
      assertKey(key);
      return objects.get(key) ?? null;
    },
    async delete(key) {
      await Promise.resolve();
      assertKey(key);
      objects.delete(key);
    },
  };
}

export function createFileStorage(rootDir: string): ObjectStorage {
  const root = resolve(rootDir);
  const pathOf = (key: string) => {
    assertKey(key);
    const p = resolve(join(root, key));
    if (!p.startsWith(root + sep)) throw new InvalidKeyError(key);
    return p;
  };
  return {
    name: "file",
    async put(key, bytes) {
      const p = pathOf(key);
      await mkdir(dirname(p), { recursive: true, mode: 0o700 });
      await writeFile(p, bytes, { mode: 0o600 });
    },
    async get(key) {
      try {
        return new Uint8Array(await readFile(pathOf(key)));
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
        throw e;
      }
    },
    async delete(key) {
      await rm(pathOf(key), { force: true });
    },
  };
}

const VERSION = 1;
const IV_BYTES = 12;
const TAG_BYTES = 16;

/**
 * Chiffrement au repos AES-256-GCM, une IV aléatoire par objet, la clé de
 * l'objet en données authentifiées (un fichier déplacé sous une autre clé ne
 * se déchiffre pas). Format : version (1 octet) | IV | tag | chiffré.
 */
export function encryptedStorage(inner: ObjectStorage, key: Uint8Array): ObjectStorage {
  if (key.length !== 32) throw new Error("Clé de chiffrement : 32 octets requis");
  return {
    name: `encrypted(${inner.name})`,
    async put(objectKey, bytes) {
      const iv = randomBytes(IV_BYTES);
      const cipher = createCipheriv("aes-256-gcm", key, iv);
      cipher.setAAD(Buffer.from(objectKey));
      const body = Buffer.concat([cipher.update(bytes), cipher.final()]);
      await inner.put(
        objectKey,
        Buffer.concat([Buffer.from([VERSION]), iv, cipher.getAuthTag(), body]),
      );
    },
    async get(objectKey) {
      const blob = await inner.get(objectKey);
      if (blob === null) return null;
      if (blob[0] !== VERSION) throw new Error("Format de chiffrement inconnu");
      const iv = blob.subarray(1, 1 + IV_BYTES);
      const tag = blob.subarray(1 + IV_BYTES, 1 + IV_BYTES + TAG_BYTES);
      const decipher = createDecipheriv("aes-256-gcm", key, iv);
      decipher.setAAD(Buffer.from(objectKey));
      decipher.setAuthTag(tag);
      return new Uint8Array(
        Buffer.concat([decipher.update(blob.subarray(1 + IV_BYTES + TAG_BYTES)), decipher.final()]),
      );
    },
    delete: (objectKey) => inner.delete(objectKey),
  };
}
