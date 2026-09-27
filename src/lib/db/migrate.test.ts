import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { sql } from "drizzle-orm";
import { readMigrationFiles } from "drizzle-orm/migrator";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import {
  migrateAllTenantSchemas,
  migrateTenantSchema,
  TENANT_MIGRATIONS_FOLDER,
  type TenantMigrationRunner,
} from "@/lib/db/migrate";
import { organizations } from "@/lib/db/schema";
import { createTestDatabase, resetTestDatabase, type TestDatabase } from "@/lib/db/testing";

const PROBE_MIGRATIONS = path.join(
  process.cwd(),
  "src/lib/db/__fixtures__/probe-tenant-migrations",
);
const TENANT_A = "org_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const TENANT_B = "org_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

describe("migrateTenantSchema", () => {
  let db: TestDatabase;
  let scratchDir: string;

  beforeAll(async () => {
    db = await createTestDatabase();
    scratchDir = mkdtempSync(path.join(tmpdir(), "tenant-migrations-"));
  });

  afterAll(async () => {
    await db.$client.close();
    rmSync(scratchDir, { recursive: true, force: true });
  });

  beforeEach(async () => {
    await resetTestDatabase(db);
    await db.execute(sql`CREATE SCHEMA ${sql.identifier(TENANT_A)}`);
  });

  async function tablesIn(schemaName: string): Promise<string[]> {
    const result = await db.execute<{ table_name: string }>(sql`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = ${schemaName} ORDER BY table_name
    `);
    return result.rows.map((row) => row.table_name);
  }

  async function appliedMigrationCount(schemaName: string): Promise<number> {
    const result = await db.execute<{ count: number }>(
      sql`SELECT count(*)::int AS "count" FROM ${sql.identifier(schemaName)}."__drizzle_migrations"`,
    );
    return result.rows[0]?.count ?? -1;
  }

  // A copy of the probe migrations holding only the first `count` of them.
  function probeMigrationsUpTo(count: number): string {
    const folder = path.join(scratchDir, `upto-${count}`);
    cpSync(PROBE_MIGRATIONS, folder, { recursive: true });
    const journalPath = path.join(folder, "meta", "_journal.json");
    const journal = JSON.parse(readFileSync(journalPath, "utf8"));
    journal.entries = journal.entries.slice(0, count);
    writeFileSync(journalPath, JSON.stringify(journal));
    return folder;
  }

  it("creates the tenant's tables, enums and history in its own schema, and nothing in public", async () => {
    await migrateTenantSchema(db, TENANT_A, PROBE_MIGRATIONS);

    await expect(tablesIn(TENANT_A)).resolves.toEqual([
      "Probe",
      "ProbeGroup",
      "__drizzle_migrations",
    ]);
    await expect(tablesIn("public")).resolves.toEqual(["Organization", "User"]);
    const enums = await db.execute<{ schema: string }>(sql`
      SELECT n.nspname AS "schema" FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
      WHERE t.typname = 'ProbeKind'
    `);
    expect(enums.rows).toEqual([{ schema: TENANT_A }]);
    await expect(appliedMigrationCount(TENANT_A)).resolves.toBe(2);
  });

  it("points tenant foreign keys at the tenant's own tables and shared ones at public", async () => {
    await migrateTenantSchema(db, TENANT_A, PROBE_MIGRATIONS);

    const foreignKeys = await db.execute<{ name: string; target: string }>(sql`
      SELECT conname AS "name", confrelid::regclass::text AS "target" FROM pg_constraint
      WHERE contype = 'f' AND connamespace = ${TENANT_A}::regnamespace ORDER BY conname
    `);
    expect(foreignKeys.rows).toEqual([
      { name: "Probe_groupId_ProbeGroup_id_fk", target: `${TENANT_A}."ProbeGroup"` },
      { name: "Probe_ownerId_User_id_fk", target: `"User"` },
    ]);
  });

  it("applies only the migrations the schema is missing", async () => {
    await migrateTenantSchema(db, TENANT_A, probeMigrationsUpTo(1));
    await expect(appliedMigrationCount(TENANT_A)).resolves.toBe(1);

    await migrateTenantSchema(db, TENANT_A, PROBE_MIGRATIONS);
    await migrateTenantSchema(db, TENANT_A, PROBE_MIGRATIONS);

    await expect(appliedMigrationCount(TENANT_A)).resolves.toBe(2);
    const noteColumn = await db.execute(sql`
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = ${TENANT_A} AND table_name = 'Probe' AND column_name = 'note'
    `);
    expect(noteColumn.rows).toHaveLength(1);
  });

  it("leaves the schema at its last good version when a migration fails", async () => {
    await migrateTenantSchema(db, TENANT_A, probeMigrationsUpTo(1));
    const broken = probeMigrationsUpTo(2);
    writeFileSync(
      path.join(broken, "0001_add_probe_note.sql"),
      'ALTER TABLE "tenant"."Nope" ADD COLUMN "x" text;',
    );

    await expect(migrateTenantSchema(db, TENANT_A, broken)).rejects.toThrow();

    await expect(appliedMigrationCount(TENANT_A)).resolves.toBe(1);
  });

  it("refuses a migration that creates a schema", async () => {
    const folder = probeMigrationsUpTo(1);
    writeFileSync(path.join(folder, "0000_create_probes.sql"), 'CREATE SCHEMA "tenant";');

    await expect(migrateTenantSchema(db, TENANT_A, folder)).rejects.toThrow(
      "A tenant migration must not create a schema",
    );
  });

  it("refuses a schema name that generateSchemaName could not have produced", async () => {
    await expect(migrateTenantSchema(db, "public", PROBE_MIGRATIONS)).rejects.toThrow(
      "Refusing to migrate invalid schema name",
    );
    await expect(tablesIn("public")).resolves.toEqual(["Organization", "User"]);
  });

  it("applies the app's real tenant migrations, leaving only the history table", async () => {
    await migrateTenantSchema(db, TENANT_A, TENANT_MIGRATIONS_FOLDER);

    await expect(tablesIn(TENANT_A)).resolves.toEqual(["__drizzle_migrations"]);
  });
});

describe("tenant migration files", () => {
  // A table, type or sequence created unqualified, or in `public`, would
  // land in the shared schema instead of each Organization's: that's what
  // defining it with pgTable/pgEnum instead of the tenant schema does.
  const CREATE_OUTSIDE_TENANT =
    /CREATE\s+(TABLE|TYPE|SEQUENCE|VIEW)\s+(IF NOT EXISTS\s+)?(?!"tenant"\.)/i;

  function statementsIn(migrationsFolder: string): string[] {
    return readMigrationFiles({ migrationsFolder }).flatMap((migration) => migration.sql);
  }

  it.each([
    ["the app's", TENANT_MIGRATIONS_FOLDER],
    ["the probe fixture's", PROBE_MIGRATIONS],
  ])("%s create objects only in the placeholder tenant schema", (_name, folder) => {
    expect(
      statementsIn(folder).filter((statement) => CREATE_OUTSIDE_TENANT.test(statement)),
    ).toEqual([]);
  });

  it("catches an object created in the shared schema", () => {
    expect(CREATE_OUTSIDE_TENANT.test('CREATE TYPE "public"."Kind" AS ENUM(\'A\');')).toBe(true);
    expect(CREATE_OUTSIDE_TENANT.test('CREATE TABLE "Group" ("id" text);')).toBe(true);
  });
});

describe("migrateAllTenantSchemas", () => {
  let db: TestDatabase;

  beforeAll(async () => {
    db = await createTestDatabase();
  });

  afterAll(async () => {
    await db.$client.close();
  });

  beforeEach(async () => {
    await resetTestDatabase(db);
    await db.insert(organizations).values([
      {
        name: "A",
        institutionType: "SCHOOL",
        schemaName: TENANT_A,
        status: "APPROVED",
        createdAt: new Date("2026-09-01T00:00:00Z"),
      },
      {
        name: "B",
        institutionType: "SCHOOL",
        schemaName: TENANT_B,
        status: "APPROVED",
        createdAt: new Date("2026-09-02T00:00:00Z"),
      },
      {
        name: "Pending",
        institutionType: "SCHOOL",
        schemaName: "org_cccccccccccccccccccccccccccccccc",
      },
    ]);
    for (const schemaName of [TENANT_A, TENANT_B]) {
      await db.execute(sql`CREATE SCHEMA ${sql.identifier(schemaName)}`);
    }
  });

  it("migrates every approved organization's schema, and no pending one's", async () => {
    const runMigrations = vi.fn<TenantMigrationRunner>((tx, schemaName) =>
      migrateTenantSchema(tx, schemaName, PROBE_MIGRATIONS),
    );

    const summary = await migrateAllTenantSchemas(db, runMigrations);

    expect(summary).toEqual({ migrated: [TENANT_A, TENANT_B], failed: [] });
    expect(runMigrations).toHaveBeenCalledTimes(2);
    expect(runMigrations).not.toHaveBeenCalledWith(
      expect.anything(),
      "org_cccccccccccccccccccccccccccccccc",
    );
  });

  it("keeps going past a failing schema and reports it", async () => {
    const failure = new Error("tenant migration failed");
    const runMigrations = vi.fn<TenantMigrationRunner>(async (tx, schemaName) => {
      if (schemaName === TENANT_A) {
        throw failure;
      }
      await migrateTenantSchema(tx, schemaName, PROBE_MIGRATIONS);
    });

    const summary = await migrateAllTenantSchemas(db, runMigrations);

    expect(summary).toEqual({
      migrated: [TENANT_B],
      failed: [{ schemaName: TENANT_A, error: failure }],
    });
  });
});
