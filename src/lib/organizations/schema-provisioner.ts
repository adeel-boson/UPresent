import { exec } from "node:child_process";
import { promisify } from "node:util";

import { isGeneratedSchemaName } from "@/lib/organizations/schema-name";

const execAsync = promisify(exec);

// Long enough for the full migration history on a cold database, short
// enough that a hung migration fails the approval instead of holding the
// request open indefinitely.
export const MIGRATE_TIMEOUT_MS = 120_000;

// Applies the app's migrations to the database/schema the URL points at.
export type MigrationRunner = (databaseUrl: string) => Promise<void>;

// The SQL the provisioner runs itself. Approval passes its transaction
// client here so the cleanup runs on the connection that holds the
// Organization's advisory lock (see approve.ts). Kept structural so
// Prisma.TransactionClient satisfies it and tests can pass a plain fake.
export interface ProvisioningDatabase {
  $executeRawUnsafe(query: string): Promise<number>;
}

export interface SchemaProvisioner {
  provision(schemaName: string, db: ProvisioningDatabase): Promise<void>;
}

// --no-install: run the project's pinned Prisma CLI, never download
// whatever version is latest on npm at request time.
export const runPrismaMigrateDeploy: MigrationRunner = async (databaseUrl) => {
  await execAsync("npx --no-install prisma migrate deploy", {
    env: { ...process.env, DATABASE_URL: databaseUrl },
    timeout: MIGRATE_TIMEOUT_MS,
  });
};

// Provisions a tenant's dedicated Postgres schema by re-running the app's
// existing Prisma migrations against it (see ADR-0001, ADR-0003). Postgres'
// `schema` connection parameter points a `migrate deploy` run at that schema
// instead of the default one, so this reuses the same migration history the
// shared schema is built from rather than inventing a second migration
// format for tenant-only tables.
export function createPrismaSchemaProvisioner(
  runMigrations: MigrationRunner = runPrismaMigrateDeploy,
): SchemaProvisioner {
  return {
    async provision(schemaName: string, db: ProvisioningDatabase): Promise<void> {
      // The name is interpolated into SQL and a connection string, so refuse
      // anything that isn't our own generateSchemaName() output (`org_` + 32
      // hex), even if the stored value was tampered with.
      if (!isGeneratedSchemaName(schemaName)) {
        throw new Error(`Refusing to provision invalid schema name ${JSON.stringify(schemaName)}.`);
      }

      const baseUrl = process.env.DATABASE_URL;
      if (!baseUrl) {
        throw new Error("DATABASE_URL is not set");
      }

      // `migrate deploy` creates the schema itself when it doesn't exist yet.
      const tenantUrl = new URL(baseUrl);
      tenantUrl.searchParams.set("schema", schemaName);

      try {
        await runMigrations(tenantUrl.toString());
      } catch (error) {
        // A migration that fails partway is recorded as failed in the
        // schema's `_prisma_migrations`, and every later `migrate deploy`
        // then refuses to run (P3009), so a retry could never succeed. The
        // caller only provisions a still-PENDING Organization, whose schema
        // holds no tenant data yet, so dropping it loses nothing and lets the
        // next attempt start clean. Interpolation is safe: the name was
        // validated above.
        await db.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
        throw error;
      }
    },
  };
}

export const prismaSchemaProvisioner: SchemaProvisioner = createPrismaSchemaProvisioner();
