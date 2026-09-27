import { drizzle } from "drizzle-orm/node-postgres";

import { migrateAllTenantSchemas } from "@/lib/db/migrate";
import * as schema from "@/lib/db/schema";

import { loadEnv } from "./load-env";

// `npm run db:migrate:tenants`: applies pending tenant migrations
// (db/migrations/tenant/) to every approved Organization's schema, one
// schema at a time (ADR-0009). Exits non-zero if any schema failed; those
// stay on their previous version and can be retried by running this again.

loadEnv();

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not set (see .env.example).");
  }
  const db = drizzle({ connection: databaseUrl, schema });
  try {
    const { migrated, failed } = await migrateAllTenantSchemas(db);
    console.log(`Tenant schemas up to date: ${migrated.length}. Failed: ${failed.length}.`);
    for (const { schemaName, error } of failed) {
      console.error(`${schemaName}:`, error);
    }
    if (failed.length > 0) {
      process.exitCode = 1;
    }
  } finally {
    await db.$client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
