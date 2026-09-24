import { exec } from "node:child_process";
import { promisify } from "node:util";

import { prisma } from "@/lib/prisma";

const execAsync = promisify(exec);

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
    const baseUrl = process.env.DATABASE_URL;
    if (!baseUrl) {
      throw new Error("DATABASE_URL is not set");
    }

    // The `schema` connection parameter only sets `search_path` for the
    // migration run below — it doesn't create the schema, so that has to
    // happen first. schemaName is always our own generateSchemaName()
    // output (`org_` + hex), never user input, so interpolating it here is
    // safe.
    await prisma.$executeRawUnsafe(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`);

    const tenantUrl = new URL(baseUrl);
    tenantUrl.searchParams.set("schema", schemaName);

    await execAsync("npx prisma migrate deploy", {
      env: { ...process.env, DATABASE_URL: tenantUrl.toString() },
    });
  },
};
