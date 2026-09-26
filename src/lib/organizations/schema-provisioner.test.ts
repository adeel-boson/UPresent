import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createPrismaSchemaProvisioner } from "@/lib/organizations/schema-provisioner";

const SCHEMA_NAME = "org_0123456789abcdef0123456789abcdef";

describe("createPrismaSchemaProvisioner", () => {
  let runMigrations: ReturnType<typeof vi.fn<(databaseUrl: string) => Promise<void>>>;
  let db: { $executeRawUnsafe: ReturnType<typeof vi.fn<(query: string) => Promise<number>>> };

  beforeEach(() => {
    vi.stubEnv("DATABASE_URL", "postgresql://user:secret@localhost:5433/upresent");
    runMigrations = vi.fn<(databaseUrl: string) => Promise<void>>().mockResolvedValue(undefined);
    db = { $executeRawUnsafe: vi.fn<(query: string) => Promise<number>>().mockResolvedValue(0) };
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("migrates the tenant schema and leaves it in place", async () => {
    const provisioner = createPrismaSchemaProvisioner(runMigrations);

    await provisioner.provision(SCHEMA_NAME, db);

    expect(runMigrations).toHaveBeenCalledWith(
      "postgresql://user:secret@localhost:5433/upresent?schema=org_0123456789abcdef0123456789abcdef",
    );
    expect(db.$executeRawUnsafe).not.toHaveBeenCalled();
  });

  it("drops the half-migrated schema and rethrows when migrating fails", async () => {
    const migrateError = new Error("migrate deploy failed");
    runMigrations.mockRejectedValue(migrateError);
    const provisioner = createPrismaSchemaProvisioner(runMigrations);

    await expect(provisioner.provision(SCHEMA_NAME, db)).rejects.toBe(migrateError);
    expect(db.$executeRawUnsafe).toHaveBeenCalledExactlyOnceWith(
      'DROP SCHEMA IF EXISTS "org_0123456789abcdef0123456789abcdef" CASCADE',
    );
  });

  it("refuses a schema name that generateSchemaName could not have produced", async () => {
    const provisioner = createPrismaSchemaProvisioner(runMigrations);

    await expect(provisioner.provision('org_x"; DROP SCHEMA public; --', db)).rejects.toThrow(
      "Refusing to provision invalid schema name",
    );
    expect(runMigrations).not.toHaveBeenCalled();
    expect(db.$executeRawUnsafe).not.toHaveBeenCalled();
  });
});
