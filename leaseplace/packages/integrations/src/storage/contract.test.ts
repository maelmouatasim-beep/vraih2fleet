import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import {
  createFileStorage,
  createMemoryStorage,
  encryptedStorage,
  InvalidKeyError,
  type ObjectStorage,
} from "./index";

const dirs: string[] = [];
afterAll(async () => {
  for (const d of dirs) await rm(d, { recursive: true, force: true });
});
const tempDir = async () => {
  const d = await mkdtemp(join(tmpdir(), "lp-storage-"));
  dirs.push(d);
  return d;
};
const key32 = new Uint8Array(32).fill(7);

const implementations: [string, () => Promise<ObjectStorage>][] = [
  ["memory", () => Promise.resolve(createMemoryStorage())],
  ["file", async () => createFileStorage(await tempDir())],
  ["encrypted(memory)", () => Promise.resolve(encryptedStorage(createMemoryStorage(), key32))],
  ["encrypted(file)", async () => encryptedStorage(createFileStorage(await tempDir()), key32)],
];

describe.each(implementations)("contrat ObjectStorage — %s", (_name, make) => {
  it("écrit, relit à l'identique, supprime ; absent → null", async () => {
    const s = await make();
    const bytes = new TextEncoder().encode("%PDF-1.7 contenu");
    await s.put("org-1/doc-1", bytes);
    expect(await s.get("org-1/doc-1")).toEqual(bytes);
    await s.delete("org-1/doc-1");
    expect(await s.get("org-1/doc-1")).toBeNull();
    await s.delete("org-1/doc-1");
  });

  it.each(["../etc/passwd", "a//b", "/abs", "a/../b", "é", ""])("refuse la clé %j", async (key) => {
    const s = await make();
    await expect(s.put(key, new Uint8Array([1]))).rejects.toThrow(InvalidKeyError);
  });
});

describe("chiffrement au repos", () => {
  it("le support ne contient jamais le texte clair ; mauvaise clé ou objet déplacé → échec", async () => {
    const dir = await tempDir();
    const raw = createFileStorage(dir);
    const enc = encryptedStorage(raw, key32);
    await enc.put("org/doc", new TextEncoder().encode("CIN AB123456"));
    const onDisk = await readFile(join(dir, "org", "doc"));
    expect(onDisk.toString("latin1")).not.toContain("AB123456");
    await expect(
      encryptedStorage(raw, new Uint8Array(32).fill(9)).get("org/doc"),
    ).rejects.toThrow();
    await raw.put("org/moved", onDisk);
    await expect(enc.get("org/moved")).rejects.toThrow();
  });
  it("refuse une clé de taille invalide et un format inconnu", async () => {
    expect(() => encryptedStorage(createMemoryStorage(), new Uint8Array(16))).toThrow(/32 octets/);
    const mem = createMemoryStorage();
    await mem.put("x", new Uint8Array([9, 9, 9]));
    await expect(encryptedStorage(mem, key32).get("x")).rejects.toThrow(/inconnu/);
  });
  it("erreurs disque autres que « absent » remontées", async () => {
    const dir = await tempDir();
    const s = createFileStorage(dir);
    await s.put("a/b", new Uint8Array([1]));
    await expect(s.get("a")).rejects.toThrow(); // « a » est un répertoire
    expect(createMemoryStorage().size).toBe(0);
  });
});
