import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema/index.ts",
  out: "./migrations",
  schemaFilter: ["identity", "audit", "dev", "marketing", "kyc", "credit", "market"],
  dbCredentials: { url: process.env.DATABASE_URL_ADMIN ?? "" },
});
