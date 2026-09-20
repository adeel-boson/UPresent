import { exec } from "node:child_process";
import { promisify } from "node:util";

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

    const tenantUrl = new URL(baseUrl);
    tenantUrl.searchParams.set("schema", schemaName);

    await execAsync("npx prisma migrate deploy", {
      env: { ...process.env, DATABASE_URL: tenantUrl.toString() },
    });
  },
};
