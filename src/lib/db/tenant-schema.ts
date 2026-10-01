import { createId } from "@paralleldrive/cuid2";
import { sql } from "drizzle-orm";
import { pgSchema, primaryKey, text, timestamp, type PgSchema } from "drizzle-orm/pg-core";

import { users } from "@/lib/db/schema";

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
// When adding a table:
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
export function defineTenantTables(schema: PgSchema) {
  // How a Group's Sessions come into being (CONTEXT.md: session creation
  // mode). Only the choice is stored for now; the recurring schedule arrives
  // with recurring Session generation (#9).
  const sessionCreationMode = schema.enum("SessionCreationMode", ["MANUAL", "RECURRING"]);

  const groups = schema.table("Group", {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    name: text("name").notNull(),
    sessionCreationMode: sessionCreationMode("sessionCreationMode").notNull(),
    createdAt: timestamp("createdAt", { precision: 3, mode: "date" })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  });

  // A Group's hosts: invited hosts, and org-admins who assigned themselves.
  // A host sees only the Groups they are listed here for.
  const groupHosts = schema.table(
    "GroupHost",
    {
      groupId: text("groupId")
        .notNull()
        .references(() => groups.id, { onDelete: "cascade", onUpdate: "cascade" }),
      // A cross-schema FK to `public."User"` (ADR-0009). Cascades, so deleting
      // a User takes their assignments with them.
      hostId: text("hostId")
        .notNull()
        .references(() => users.id, { onDelete: "cascade", onUpdate: "cascade" }),
    },
    (table) => [primaryKey({ name: "GroupHost_pkey", columns: [table.groupId, table.hostId] })],
  );

  return { sessionCreationMode, groups, groupHosts };
}

export type TenantTables = ReturnType<typeof defineTenantTables>;

export const TENANT_SCHEMA_PLACEHOLDER = "tenant";

// Never query these: they point at the placeholder schema, which doesn't
// exist. Reach tenant tables through `withTenant` instead (lint enforces
// this outside src/lib/db/). The schema object itself stays unexported:
// exporting it makes drizzle-kit emit `CREATE SCHEMA "tenant"`.
export const placeholderTenantTables = defineTenantTables(pgSchema(TENANT_SCHEMA_PLACEHOLDER));

export const sessionCreationMode = placeholderTenantTables.sessionCreationMode;
export const groups = placeholderTenantTables.groups;
export const groupHosts = placeholderTenantTables.groupHosts;

export const SESSION_CREATION_MODES = sessionCreationMode.enumValues;
export type SessionCreationMode = (typeof SESSION_CREATION_MODES)[number];
