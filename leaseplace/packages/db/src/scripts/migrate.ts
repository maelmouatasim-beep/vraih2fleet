/** Applique les migrations (rôle propriétaire : DATABASE_URL_ADMIN). */
import { fileURLToPath } from "node:url";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { createDatabase } from "../client";

const url = process.env.DATABASE_URL_ADMIN;
if (!url) {
  console.error("DATABASE_URL_ADMIN manquant");
  process.exit(1);
}
const { db, close } = createDatabase(url, { max: 1 });
try {
  await migrate(db, {
    migrationsFolder: fileURLToPath(new URL("../../migrations", import.meta.url)),
    migrationsSchema: "drizzle",
  });
  console.warn("Migrations appliquées.");
} finally {
  await close();
}
