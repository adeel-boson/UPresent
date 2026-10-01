import { drizzle } from "drizzle-orm/node-postgres";
import { pgSchema, type PgSchema } from "drizzle-orm/pg-core";

import { pool } from "@/lib/db/client";
import { defineTenantTables } from "@/lib/db/tenant-schema";
import type { Organization } from "@/lib/db/schema";
import { isGeneratedSchemaName } from "@/lib/db/schema-name";

// Tenant enum values and types for domain modules, which can't import the
// tenant schema module itself (lint, ADR-0009).
export { SESSION_CREATION_MODES, type SessionCreationMode } from "@/lib/db/tenant-schema";

// How many Organizations' table sets one server instance keeps built. Each
// is a few plain objects over the shared pool, so this only bounds memory.
const MAX_CACHED_TENANTS = 100;

export type TenantScope<TTables, TDatabase> = {
  // A Drizzle database over the shared pool whose tenant tables (in
  // `tables`, and in `db.query.*`) name this Organization's schema.
  db: TDatabase;
  tables: TTables;
};

export type WithTenant<TTables, TDatabase> = <T>(
  organization: Pick<Organization, "schemaName">,
  fn: (tenant: TenantScope<TTables, TDatabase>) => Promise<T>,
) => Promise<T>;

// Builds a `withTenant` over a table definition and a connection, so tests
// can run it against PGlite with their own tables. The app uses the
// `withTenant` exported below.
//
// Isolation comes from the table objects, not from connection state: every
// tenant table is built for exactly one schema, so every query names that
// schema explicitly (`"org_…"."Group"`). Nothing like `search_path` can leak
// between requests through the pool or a transaction-mode pooler (ADR-0009).
export function createWithTenant<TTables extends Record<string, unknown>, TDatabase>(
  defineTables: (schema: PgSchema) => TTables,
  connect: (tables: TTables) => TDatabase,
): WithTenant<TTables, TDatabase> {
  const scopes = new Map<string, TenantScope<TTables, TDatabase>>();

  function scopeFor(schemaName: string): TenantScope<TTables, TDatabase> {
    const cached = scopes.get(schemaName);
    if (cached) {
      return cached;
    }
    const tables = defineTables(pgSchema(schemaName));
    const scope = { tables, db: connect(tables) };
    // Maps iterate in insertion order, so the first key is the oldest.
    if (scopes.size >= MAX_CACHED_TENANTS) {
      const oldest = scopes.keys().next();
      if (!oldest.done) {
        scopes.delete(oldest.value);
      }
    }
    scopes.set(schemaName, scope);
    return scope;
  }

  return async (organization, fn) => {
    // Tenant scope comes from the signed-in user's Organization record, never
    // from the request (CODING_STANDARDS §4). This refuses anything that
    // isn't a schema name we generated, even if the stored value was
    // tampered with.
    if (!isGeneratedSchemaName(organization.schemaName)) {
      throw new Error(
        `Refusing to open invalid tenant schema ${JSON.stringify(organization.schemaName)}.`,
      );
    }
    return fn(scopeFor(organization.schemaName));
  };
}

// Runs `fn` against one Organization's tenant tables. The only way domain
// modules reach tenant data:
//
//   await withTenant(organization, ({ db, tables }) =>
//     db.select().from(tables.groups));
export const withTenant = createWithTenant(defineTenantTables, (tables) =>
  drizzle({ client: pool, schema: tables }),
);
