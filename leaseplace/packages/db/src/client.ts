import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export type Schema = typeof schema;
export type Database = PostgresJsDatabase<Schema>;
export type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

export interface DatabaseHandle {
  db: Database;
  close: () => Promise<void>;
}

/**
 * Ouvre une connexion. `prepare: false` : compatible avec le pooler en mode
 * transaction (Supabase / PgBouncer), où le contexte posé par SET LOCAL ne
 * vit que le temps de la transaction.
 */
export function createDatabase(url: string, options: { max?: number } = {}): DatabaseHandle {
  if (!url) throw new Error("URL de base de données manquante");
  const client = postgres(url, { prepare: false, max: options.max ?? 10 });
  return {
    db: drizzle(client, { schema }),
    close: () => client.end({ timeout: 5 }),
  };
}
