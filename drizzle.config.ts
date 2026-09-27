import { defineConfig } from "drizzle-kit";

import { loadEnv } from "./db/load-env";

loadEnv();

// The shared schema (tables in `public`). `npm run db:generate` writes its
// migrations to db/migrations/shared/; `npm run db:migrate` applies them.
// Tenant tables have their own config: drizzle.tenant.config.ts (ADR-0009).
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/lib/db/schema.ts",
  out: "./db/migrations/shared",
  // Only `public` belongs to this config. Without the filter, `drizzle-kit
  // studio`/`push` would treat every `org_<hex>` tenant schema as its own.
  schemaFilter: ["public"],
  dbCredentials: {
    // Only needed by `db:studio`; generating migrations is offline.
    url: process.env.DATABASE_URL ?? "",
  },
});
