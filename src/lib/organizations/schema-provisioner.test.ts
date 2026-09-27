import { sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { TenantMigrationRunner } from "@/lib/db/migrate";
import {
  createTestDatabase,
  resetTestDatabase,
  schemaExists,
  type TestDatabase,
} from "@/lib/db/testing";
import { createSchemaProvisioner } from "@/lib/organizations/schema-provisioner";

const SCHEMA_NAME = "org_0123456789abcdef0123456789abcdef";

describe("createSchemaProvisioner", () => {
  let db: TestDatabase;
  let runMigrations: ReturnType<typeof vi.fn<TenantMigrationRunner>>;

  beforeAll(async () => {
    db = await createTestDatabase();
  });

  afterAll(async () => {
    await db.$client.close();
  });

  beforeEach(async () => {
    await resetTestDatabase(db);
    runMigrations = vi.fn<TenantMigrationRunner>().mockResolvedValue(undefined);
  });

  it("migrates the tenant schema and leaves it in place", async () => {
    const provisioner = createSchemaProvisioner(runMigrations);

    await db.transaction((tx) => provisioner.provision(SCHEMA_NAME, tx));

    expect(runMigrations).toHaveBeenCalledExactlyOnceWith(expect.anything(), SCHEMA_NAME);
    await expect(schemaExists(db, SCHEMA_NAME)).resolves.toBe(true);
  });

  it("drops the half-migrated schema and rethrows when migrating fails", async () => {
    const migrateError = new Error("tenant migration failed");
    runMigrations.mockImplementation(async (tx, schemaName) => {
      await tx.execute(sql`CREATE TABLE ${sql.identifier(schemaName)}."HalfMigrated" (id int)`);
      throw migrateError;
    });
    const provisioner = createSchemaProvisioner(runMigrations);

    // The transaction commits, as approval's does: the cleanup must not
    // depend on a rollback.
    const error = await db.transaction(async (tx) =>
      provisioner.provision(SCHEMA_NAME, tx).then(
        () => null,
        (provisionError: unknown) => provisionError,
      ),
    );

    expect(error).toBe(migrateError);
    await expect(schemaExists(db, SCHEMA_NAME)).resolves.toBe(false);
  });

  it("drops a half-migrated schema left by an earlier attempt when migrating fails again", async () => {
    await db.execute(sql`CREATE SCHEMA ${sql.identifier(SCHEMA_NAME)}`);
    await db.execute(sql`CREATE TABLE ${sql.identifier(SCHEMA_NAME)}."Leftover" (id int)`);
    runMigrations.mockRejectedValue(new Error("tenant migration failed"));
    const provisioner = createSchemaProvisioner(runMigrations);

    await db.transaction(async (tx) => {
      await expect(provisioner.provision(SCHEMA_NAME, tx)).rejects.toThrow(
        "tenant migration failed",
      );
    });

    await expect(schemaExists(db, SCHEMA_NAME)).resolves.toBe(false);
  });

  it("refuses a schema name that generateSchemaName could not have produced", async () => {
    const provisioner = createSchemaProvisioner(runMigrations);

    await db.transaction(async (tx) => {
      await expect(provisioner.provision('org_x"; DROP SCHEMA public; --', tx)).rejects.toThrow(
        "Refusing to provision invalid schema name",
      );
    });
    expect(runMigrations).not.toHaveBeenCalled();
    await expect(schemaExists(db, "public")).resolves.toBe(true);
  });
});
