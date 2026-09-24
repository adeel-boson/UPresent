import { exec } from "node:child_process";
import { promisify } from "node:util";

import { prisma } from "@/lib/prisma";
import { isGeneratedSchemaName } from "@/lib/organizations/schema-name";

const execAsync = promisify(exec);

// Long enough for the full migration history on a cold database, short
// enough that a hung migration fails the approval instead of holding the
// request open indefinitely.
const MIGRATE_TIMEOUT_MS = 120_000;

export interface SchemaProvisioner {
  provision(schemaName: string): Promise<void>;
}

// Provisions a tenant's dedicated Postgres schema by re-running the app's
// existing Prisma migrations against it (see ADR-0001, ADR-0003). Postgres'
// `schema` connection parameter points a `migrate deploy` run at that schema
// instead of the default one, so this reuses the same migration history the
// shared schema is built from rather than inventing a second migration
// format for tenant-only tables.
export const prismaSchemaProvisioner: SchemaProvisioner = {
  async provision(schemaName: string): Promise<void> {
    // The name is interpolated into SQL below, so refuse anything that isn't
    // our own generateSchemaName() output (`org_` + 32 hex), even if the
    // stored value was tampered with.
    if (!isGeneratedSchemaName(schemaName)) {
      throw new Error(`Refusing to provision invalid schema name ${JSON.stringify(schemaName)}.`);
    }

    const baseUrl = process.env.DATABASE_URL;
    if (!baseUrl) {
      throw new Error("DATABASE_URL is not set");
    }

    // The `schema` connection parameter only sets `search_path` for the
    // migration run below — it doesn't create the schema, so that has to
    // happen first. Interpolation is safe: the name was validated above.
    await prisma.$executeRawUnsafe(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`);

    const tenantUrl = new URL(baseUrl);
    tenantUrl.searchParams.set("schema", schemaName);

    // --no-install: run the project's pinned Prisma CLI, never download
    // whatever version is latest on npm at request time.
    await execAsync("npx --no-install prisma migrate deploy", {
      env: { ...process.env, DATABASE_URL: tenantUrl.toString() },
      timeout: MIGRATE_TIMEOUT_MS,
    });
  },
};
