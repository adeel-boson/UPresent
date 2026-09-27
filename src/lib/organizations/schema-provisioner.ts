import { sql } from "drizzle-orm";

import {
  migrateTenantSchema,
  type MigratableDatabase,
  type TenantMigrationRunner,
} from "@/lib/db/migrate";
import { isGeneratedSchemaName } from "@/lib/organizations/schema-name";

export interface SchemaProvisioner {
  // `tx` is the approval transaction (see approve.ts), so the schema is
  // created and migrated on the connection that holds the Organization's
  // advisory lock, and commits or rolls back with the status change.
  provision(schemaName: string, tx: MigratableDatabase): Promise<void>;
}

// Provisions a tenant's dedicated Postgres schema: creates it and applies the
// tenant migrations in-process (ADR-0001, ADR-0009). No CLI or child process,
// so it runs the same on a laptop and in a serverless function. The runner is
// injectable so tests can make migrating fail.
export function createSchemaProvisioner(
  runMigrations: TenantMigrationRunner = migrateTenantSchema,
): SchemaProvisioner {
  return {
    async provision(schemaName: string, tx: MigratableDatabase): Promise<void> {
      // The name is interpolated into SQL, so refuse anything that isn't our
      // own generateSchemaName() output (`org_` + 32 hex), even if the stored
      // value was tampered with.
      if (!isGeneratedSchemaName(schemaName)) {
        throw new Error(`Refusing to provision invalid schema name ${JSON.stringify(schemaName)}.`);
      }
      const schema = sql.identifier(schemaName);

      try {
        // A savepoint, so a failure here leaves the approval transaction
        // usable for the cleanup below instead of aborted. IF NOT EXISTS
        // resumes a schema an earlier attempt left behind; the runner only
        // applies what that schema is missing.
        await tx.transaction(async (savepoint) => {
          await savepoint.execute(sql`CREATE SCHEMA IF NOT EXISTS ${schema}`);
          await runMigrations(savepoint, schemaName);
        });
      } catch (error) {
        // Rolling back the savepoint already undoes whatever this attempt
        // created. Dropping as well clears a half-migrated schema left by an
        // earlier attempt, so the next approval starts clean. The caller only
        // provisions a still-PENDING Organization, whose schema holds no
        // tenant data yet, so dropping it loses nothing. The name is a quoted
        // identifier, validated above.
        await tx.execute(sql`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
        throw error;
      }
    },
  };
}

export const schemaProvisioner: SchemaProvisioner = createSchemaProvisioner();
