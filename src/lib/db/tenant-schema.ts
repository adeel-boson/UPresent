import { pgSchema, type PgSchema } from "drizzle-orm/pg-core";

// The tenant schema: tables that exist once per Organization, inside its own
// `org_<hex>` Postgres schema (ADR-0001, ADR-0009).
//
// Tables are defined once, in `defineTenantTables`, against whichever schema
// they are given:
// - at runtime, `withTenant` (src/lib/db/tenant.ts) calls it with the
//   Organization's own schema, so every query names that schema explicitly;
// - for drizzle-kit, `placeholderTenantTables` calls it with the placeholder
//   schema `"tenant"`, and the tenant migration runner
//   (src/lib/db/migrate.ts) rewrites `"tenant".` to the Organization's schema
//   when it applies the generated SQL.
//
// Empty until the first tenant-data issue adds Groups, Sessions, Members and
// AttendanceRecords. When adding one:
// - define it (and any enum) with `schema.table(…)` / `schema.enum(…)`,
//   never `pgTable`/`pgEnum`: those belong to `public`, and drizzle-kit
//   would create them there;
// - also export it at the bottom (`export const groups =
//   placeholderTenantTables.groups;`), since drizzle-kit only reads
//   top-level table exports;
// - reference a shared table (e.g. a host's User) with `.references(() =>
//   users.id)` from `@/lib/db/schema`; drizzle-kit writes that FK against
//   `"public"."User"`, which the runner leaves alone.
//
// The return type is inferred on purpose: it is the tenant tables' type.
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- unused until the first tenant table
export function defineTenantTables(schema: PgSchema) {
  return {};
}

export type TenantTables = ReturnType<typeof defineTenantTables>;

export const TENANT_SCHEMA_PLACEHOLDER = "tenant";

// Never query these: they point at the placeholder schema, which doesn't
// exist. Reach tenant tables through `withTenant` instead (lint enforces
// this outside src/lib/db/). The schema object itself stays unexported:
// exporting it makes drizzle-kit emit `CREATE SCHEMA "tenant"`.
export const placeholderTenantTables = defineTenantTables(pgSchema(TENANT_SCHEMA_PLACEHOLDER));
