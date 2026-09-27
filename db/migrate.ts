import path from "node:path";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";

import { loadEnv } from "./load-env";

// `npm run db:migrate`: applies pending shared-schema migrations
// (db/migrations/shared/) with Drizzle's own migrator, which records them in
// `drizzle.__drizzle_migrations`. Tenant schemas are migrated separately by
// `npm run db:migrate:tenants` (ADR-0009). Run both on every deploy, shared
// first, with a direct (non-pooled) connection.

loadEnv();

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not set (see .env.example).");
  }
  const db = drizzle({ connection: databaseUrl });
  try {
    await migrate(db, { migrationsFolder: path.join(process.cwd(), "db", "migrations", "shared") });
    console.log("Shared schema is up to date.");
  } finally {
    await db.$client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
