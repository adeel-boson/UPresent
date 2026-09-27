import { defineConfig } from "drizzle-kit";

// The tenant schema: tables every Organization gets a copy of in its own
// `org_<hex>` schema (ADR-0009). `npm run db:generate` writes its migrations
// to db/migrations/tenant/. They are never applied to `public`: the app's
// tenant migration runner applies them to each Organization's schema, on
// approval and through `npm run db:migrate:tenants`.
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/lib/db/tenant-schema.ts",
  out: "./db/migrations/tenant",
});
