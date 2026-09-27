import path from "node:path";
import { asc, eq, sql } from "drizzle-orm";
import { readMigrationFiles } from "drizzle-orm/migrator";
import {
  bigint,
  pgSchema,
  serial,
  text,
  type PgDatabase,
  type PgQueryResultHKT,
} from "drizzle-orm/pg-core";

import { organizations } from "@/lib/db/schema";
import { TENANT_SCHEMA_PLACEHOLDER } from "@/lib/db/tenant-schema";
import { isGeneratedSchemaName } from "@/lib/db/schema-name";

// No `server-only` here: the `db:migrate:tenants` script runs this under
// tsx, outside Next. It takes its database as an argument instead.

// Any Drizzle Postgres database or transaction: node-postgres in the app and
// scripts, PGlite in tests. The table types don't matter to the runner.
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- any schema's database is accepted
export type MigratableDatabase = PgDatabase<PgQueryResultHKT, any>;

// Resolved from the working directory, which is the project root under
// `next dev`/`next start` and npm scripts. On Vercel the folder is copied
// into the function bundle by `outputFileTracingIncludes` in next.config.ts.
export const TENANT_MIGRATIONS_FOLDER = path.join(process.cwd(), "db", "migrations", "tenant");

// Same name and shape as the table Drizzle's own `migrate()` keeps, but in
// each tenant schema, so dropping the schema drops its history too.
function migrationHistoryTable(schemaName: string) {
  return pgSchema(schemaName).table("__drizzle_migrations", {
    id: serial("id").primaryKey(),
    hash: text("hash").notNull(),
    createdAt: bigint("created_at", { mode: "number" }),
  });
}

const PLACEHOLDER_QUALIFIER = `"${TENANT_SCHEMA_PLACEHOLDER}".`;

export type TenantMigrationRunner = (db: MigratableDatabase, schemaName: string) => Promise<void>;

// Applies every pending tenant migration to one Organization's schema, which
// must already exist. Drizzle's `migrate()` can't do this: it runs the
// generated SQL as written, and tenant SQL names the placeholder schema
// `"tenant"` (see tenant-schema.ts), so this runner rewrites that qualifier
// to the real schema first.
//
// All pending migrations apply in one transaction, so a failure leaves the
// schema at its last good version. Passed a transaction, it runs in a
// savepoint of it instead (Drizzle nests transactions that way).
export async function migrateTenantSchema(
  db: MigratableDatabase,
  schemaName: string,
  migrationsFolder: string = TENANT_MIGRATIONS_FOLDER,
): Promise<void> {
  // The name is interpolated into the migration SQL below, so refuse
  // anything that isn't our own generateSchemaName() output.
  if (!isGeneratedSchemaName(schemaName)) {
    throw new Error(`Refusing to migrate invalid schema name ${JSON.stringify(schemaName)}.`);
  }
  const migrations = readMigrationFiles({ migrationsFolder });
  const history = migrationHistoryTable(schemaName);

  await db.transaction(async (tx) => {
    // Serializes runs against the same schema (a deploy's rollout racing
    // another). Transaction-scoped, so it's safe behind a transaction-mode
    // pooler and released on commit, rollback or a dropped connection.
    await tx.execute(
      sql`SELECT pg_advisory_xact_lock(hashtextextended(${`tenant-migrations:${schemaName}`}, 0))`,
    );
    await tx.execute(sql`
      CREATE TABLE IF NOT EXISTS ${history} (
        id SERIAL PRIMARY KEY,
        hash text NOT NULL,
        created_at bigint
      )
    `);
    const applied = await tx.select({ createdAt: history.createdAt }).from(history);
    const appliedTimestamps = new Set(applied.map((row) => row.createdAt));

    for (const migration of migrations) {
      if (appliedTimestamps.has(migration.folderMillis)) {
        continue;
      }
      for (const statement of migration.sql) {
        if (/\bCREATE\s+SCHEMA\b/i.test(statement)) {
          throw new Error(
            "A tenant migration must not create a schema; see src/lib/db/tenant-schema.ts.",
          );
        }
        // sql.raw is safe here: the statements come from our own generated
        // migration files, and the only value spliced in is a schema name
        // validated above.
        await tx.execute(sql.raw(statement.replaceAll(PLACEHOLDER_QUALIFIER, `"${schemaName}".`)));
      }
      await tx.insert(history).values({ hash: migration.hash, createdAt: migration.folderMillis });
    }
  });
}

export type TenantMigrationSummary = {
  migrated: string[];
  failed: { schemaName: string; error: unknown }[];
};

// Rolls pending tenant migrations out to every approved Organization's
// schema, one at a time. A failure doesn't stop the rollout: that schema
// stays on its previous version and is reported, and the caller decides
// what to do (the npm script exits non-zero).
export async function migrateAllTenantSchemas(
  db: MigratableDatabase,
  runMigrations: TenantMigrationRunner = migrateTenantSchema,
): Promise<TenantMigrationSummary> {
  const approved = await db
    .select({ schemaName: organizations.schemaName })
    .from(organizations)
    .where(eq(organizations.status, "APPROVED"))
    .orderBy(asc(organizations.createdAt));

  const summary: TenantMigrationSummary = { migrated: [], failed: [] };
  for (const { schemaName } of approved) {
    try {
      await runMigrations(db, schemaName);
      summary.migrated.push(schemaName);
    } catch (error) {
      summary.failed.push({ schemaName, error });
    }
  }
  return summary;
}
