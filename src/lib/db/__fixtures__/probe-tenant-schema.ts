import { pgSchema, text, type PgSchema } from "drizzle-orm/pg-core";

import { users } from "@/lib/db/schema";

// A stand-in tenant schema for tests of the tenant migration runner and
// `withTenant`, shaped like tenant-schema.ts: an enum, a table with a FK to
// another tenant table and one to the shared User table. Its migrations in
// ./probe-tenant-migrations/ were generated from this file by drizzle-kit:
//
//   npx drizzle-kit generate --dialect postgresql \
//     --schema src/lib/db/__fixtures__/probe-tenant-schema.ts \
//     --out src/lib/db/__fixtures__/probe-tenant-migrations
export function defineProbeTables(schema: PgSchema) {
  const probeKind = schema.enum("ProbeKind", ["RED", "BLUE"]);
  const probeGroups = schema.table("ProbeGroup", {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
  });
  const probes = schema.table("Probe", {
    id: text("id").primaryKey(),
    kind: probeKind("kind").notNull(),
    label: text("label").notNull(),
    note: text("note"),
    groupId: text("groupId").references(() => probeGroups.id),
    ownerId: text("ownerId").references(() => users.id),
  });
  return { probeKind, probeGroups, probes };
}

const placeholder = defineProbeTables(pgSchema("tenant"));
export const probeKind = placeholder.probeKind;
export const probeGroups = placeholder.probeGroups;
export const probes = placeholder.probes;
