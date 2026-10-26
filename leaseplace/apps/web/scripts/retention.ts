/**
 * Purge de conservation (tâche planifiée, quotidienne) : applique les
 * durées réglées dans l'administration (privacy.apply_retention), supprime
 * les fichiers chiffrés des pièces échues puis marque leur purge. Connexion
 * propriétaire (DATABASE_URL_ADMIN) ; à lancer par le planificateur de
 * l'hébergeur : `pnpm retention:run`.
 */
import { sql } from "drizzle-orm";
import { createDatabase } from "@leaseplace/db";
import { createFileStorage, encryptedStorage } from "@leaseplace/integrations/storage";

const url = process.env.DATABASE_URL_ADMIN;
const storageKey = process.env.LP_STORAGE_KEY;
if (!url || !storageKey) {
  console.error("DATABASE_URL_ADMIN et LP_STORAGE_KEY sont requis.");
  process.exit(1);
}

const { db, close } = createDatabase(url, { max: 1 });
const storage = encryptedStorage(
  createFileStorage(process.env.LP_STORAGE_DIR ?? ".storage"),
  new Uint8Array(Buffer.from(storageKey, "base64")),
);

try {
  const [row] = await db.execute<{
    r: Record<string, number> & { storage: { id: string; key: string }[] };
  }>(sql`select privacy.apply_retention() as r`);
  const { storage: files = [], ...counts } = row?.r ?? { storage: [] };
  const purged: string[] = [];
  for (const f of files) {
    try {
      await storage.delete(f.key);
      purged.push(f.id);
    } catch (error) {
      console.error(`Fichier non supprimé (repris à la prochaine purge) : ${f.id}`, error);
    }
  }
  if (purged.length > 0)
    await db.execute(
      sql`select privacy.mark_purged_core(array[${sql.join(
        purged.map((id) => sql`${id}`),
        sql`, `,
      )}]::uuid[])`,
    );
  console.warn(`Purge de conservation : ${JSON.stringify({ ...counts, purged: purged.length })}`);
} finally {
  await close();
}
