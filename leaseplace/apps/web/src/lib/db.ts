import "server-only";
import { createDatabase, type DatabaseHandle } from "@leaseplace/db";
import { env } from "./env";

const globalForDb = globalThis as unknown as { lpApp?: DatabaseHandle; lpAuth?: DatabaseHandle };

/** Connexion applicative (lp_app, sous RLS) : toujours via withActor(). */
export function appDb() {
  globalForDb.lpApp ??= createDatabase(env().DATABASE_URL);
  return globalForDb.lpApp.db;
}

/** Connexion réservée à Better-Auth (lp_auth). */
export function authDb() {
  globalForDb.lpAuth ??= createDatabase(env().DATABASE_URL_AUTH, { max: 5 });
  return globalForDb.lpAuth.db;
}
