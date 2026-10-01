import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { sql } from "drizzle-orm";
import { drizzle, type PgliteDatabase } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";

import { migrateTenantSchema } from "@/lib/db/migrate";
import * as schema from "@/lib/db/schema";
import type { createWithTenant, withTenant } from "@/lib/db/tenant";
import { defineTenantTables } from "@/lib/db/tenant-schema";

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

export async function createTestDatabase(): Promise<TestDatabase> {
  const db = drizzle({ client: new PGlite(), schema });
  await migrate(db, { migrationsFolder: SHARED_MIGRATIONS_FOLDER });
  return db;
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

// The app's `withTenant` over PGlite, for domain tests that reach tenant
// tables. Swap it in alongside the client. `createWithTenant` is passed in
// from the real module, because importing `@/lib/db/tenant` here would
// re-enter its own mock:
//
//   vi.mock("@/lib/db/tenant", async (importOriginal) => {
//     const tenant = await importOriginal<typeof TenantModule>();
//     const { createTestWithTenant } = await import("@/lib/db/testing");
//     return { ...tenant, withTenant: createTestWithTenant(testDb, tenant.createWithTenant) };
//   });
export function createTestWithTenant(
  db: TestDatabase,
  create: typeof createWithTenant,
): typeof withTenant {
  // The PGlite database stands in for the app's node-postgres one: both are
  // Drizzle Postgres databases over the same tables, and domain code only
  // uses the API they share. The cast is that trusted, test-only boundary.
  return create(defineTenantTables, (tables) =>
    drizzle({ client: db.$client, schema: tables }),
  ) as unknown as typeof withTenant;
}

// An approved Organization with its tenant schema created and migrated with
// the real tenant migrations, as approval leaves it.
export async function createApprovedTestOrganization(
  db: TestDatabase,
  organization: { id: string; name: string; schemaName: string },
): Promise<void> {
  await db.insert(schema.organizations).values({
    ...organization,
    institutionType: "SCHOOL",
    status: "APPROVED",
    approvedAt: new Date(),
  });
  await db.execute(sql`CREATE SCHEMA ${sql.identifier(organization.schemaName)}`);
  await migrateTenantSchema(db, organization.schemaName);
}

export async function schemaExists(db: TestDatabase, schemaName: string): Promise<boolean> {
  const result = await db.execute<{ exists: boolean }>(
    sql`SELECT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = ${schemaName}) AS "exists"`,
  );
  return result.rows[0]?.exists === true;
}
