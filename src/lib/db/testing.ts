import { openAsBlob } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { sql } from "drizzle-orm";
import { drizzle, type PgliteDatabase } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { inject } from "vitest";

import * as schema from "@/lib/db/schema";

// Test-only helpers: an in-process Postgres (PGlite) with the real shared
// migrations applied, so domain tests exercise real SQL semantics (unique
// indexes, transactions, advisory locks) instead of a mocked query builder.
// Tests swap it in for the app's client:
//
//   vi.mock("@/lib/db/client", async () => {
//     const { createTestDatabase } = await import("@/lib/db/testing");
//     return { db: await createTestDatabase() };
//   });

export type TestDatabase = PgliteDatabase<typeof schema> & { $client: PGlite };

export const SHARED_MIGRATIONS_FOLDER = path.join(process.cwd(), "db", "migrations", "shared");

declare module "vitest" {
  export interface ProvidedContext {
    // Path to a dump of a migrated PGlite data directory, written once per
    // run by testing-global-setup.ts.
    testDatabaseTemplate: string;
  }
}

// Starts from the migrated template instead of running initdb and the
// migrations again: about 5x cheaper per test file, which keeps setup well
// inside the hook timeout when every test file boots a database in parallel.
export async function createTestDatabase(): Promise<TestDatabase> {
  const template = await openAsBlob(inject("testDatabaseTemplate"));
  return drizzle({ client: new PGlite({ loadDataDir: template }), schema });
}

// Builds the template that createTestDatabase starts from, as a data
// directory tarball.
export async function dumpMigratedTestDatabase(): Promise<Blob> {
  const db = drizzle({ client: new PGlite(), schema });
  try {
    await migrate(db, { migrationsFolder: SHARED_MIGRATIONS_FOLDER });
    return await db.$client.dumpDataDir("none");
  } finally {
    await db.$client.close();
  }
}

// Empties the shared tables and drops every tenant schema between tests.
export async function resetTestDatabase(db: TestDatabase): Promise<void> {
  await db.execute(sql`TRUNCATE "User", "Organization" CASCADE`);
  const tenantSchemas = await db.execute<{ nspname: string }>(
    sql`SELECT nspname FROM pg_namespace WHERE nspname LIKE 'org\\_%'`,
  );
  for (const { nspname } of tenantSchemas.rows) {
    await db.execute(sql`DROP SCHEMA ${sql.identifier(nspname)} CASCADE`);
  }
}

export async function schemaExists(db: TestDatabase, schemaName: string): Promise<boolean> {
  const result = await db.execute<{ exists: boolean }>(
    sql`SELECT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = ${schemaName}) AS "exists"`,
  );
  return result.rows[0]?.exists === true;
}
