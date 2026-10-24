import "server-only";
import { createEicarScanner, type MalwareScanner } from "@leaseplace/integrations/scanner";
import {
  createFileStorage,
  encryptedStorage,
  type ObjectStorage,
} from "@leaseplace/integrations/storage";
import { env } from "./env";

const globalForStorage = globalThis as unknown as {
  lpStorage?: ObjectStorage;
  lpScanner?: MalwareScanner;
};

/** Documents chiffrés au repos (AES-256-GCM), quel que soit le support. */
export function documentStorage(): ObjectStorage {
  globalForStorage.lpStorage ??= encryptedStorage(
    createFileStorage(env().LP_STORAGE_DIR),
    new Uint8Array(Buffer.from(env().LP_STORAGE_KEY, "base64")),
  );
  return globalForStorage.lpStorage;
}

/** Antivirus : scanner de test EICAR tant qu'aucun service réel n'est branché (phase 9). */
export function malwareScanner(): MalwareScanner {
  globalForStorage.lpScanner ??= createEicarScanner();
  return globalForStorage.lpScanner;
}
