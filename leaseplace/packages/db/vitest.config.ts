import { defineConfig } from "vitest/config";

// Tests d'intégration contre un vrai Postgres (DATABASE_URL_TEST, rôle
// propriétaire d'une base de TEST migrée) : `pnpm db:local` en local, service
// postgres en CI.
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    fileParallelism: false,
    testTimeout: 20_000,
  },
});
