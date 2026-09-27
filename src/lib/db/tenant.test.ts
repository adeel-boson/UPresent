import path from "node:path";
import { eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { defineProbeTables } from "@/lib/db/__fixtures__/probe-tenant-schema";
import { migrateTenantSchema } from "@/lib/db/migrate";
import { users } from "@/lib/db/schema";
import { createWithTenant } from "@/lib/db/tenant";
import { createTestDatabase, resetTestDatabase, type TestDatabase } from "@/lib/db/testing";

const PROBE_MIGRATIONS = path.join(
  process.cwd(),
  "src/lib/db/__fixtures__/probe-tenant-migrations",
);
const TENANT_A = { schemaName: "org_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" };
const TENANT_B = { schemaName: "org_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" };

describe("withTenant", () => {
  let db: TestDatabase;
  let withTenant: ReturnType<typeof createProbeWithTenant>;

  // The app's withTenant with the probe tables in place of the (still
  // empty) tenant schema, over PGlite instead of the app's pool.
  function createProbeWithTenant(database: TestDatabase) {
    return createWithTenant(defineProbeTables, (tables) =>
      drizzle({ client: database.$client, schema: tables }),
    );
  }

  beforeAll(async () => {
    db = await createTestDatabase();
  });

  afterAll(async () => {
    await db.$client.close();
  });

  beforeEach(async () => {
    await resetTestDatabase(db);
    for (const { schemaName } of [TENANT_A, TENANT_B]) {
      await db.execute(sql`CREATE SCHEMA ${sql.identifier(schemaName)}`);
      await migrateTenantSchema(db, schemaName, PROBE_MIGRATIONS);
    }
    withTenant = createProbeWithTenant(db);
  });

  async function probeLabelsIn(schemaName: string): Promise<string[]> {
    const result = await db.execute<{ label: string }>(
      sql`SELECT label FROM ${sql.identifier(schemaName)}."Probe" ORDER BY label`,
    );
    return result.rows.map((row) => row.label);
  }

  it("writes only to the organization's own schema", async () => {
    await withTenant(TENANT_A, ({ db: tenantDb, tables }) =>
      tenantDb.insert(tables.probes).values({ id: "p1", kind: "RED", label: "from A" }),
    );

    await expect(probeLabelsIn(TENANT_A.schemaName)).resolves.toEqual(["from A"]);
    await expect(probeLabelsIn(TENANT_B.schemaName)).resolves.toEqual([]);
  });

  it("keeps two organizations' data apart", async () => {
    await withTenant(TENANT_A, ({ db: tenantDb, tables }) =>
      tenantDb.insert(tables.probes).values({ id: "same-id", kind: "RED", label: "A's probe" }),
    );
    await withTenant(TENANT_B, ({ db: tenantDb, tables }) =>
      tenantDb.insert(tables.probes).values({ id: "same-id", kind: "BLUE", label: "B's probe" }),
    );

    const readFrom = (organization: { schemaName: string }) =>
      withTenant(organization, ({ db: tenantDb, tables }) =>
        tenantDb.select({ label: tables.probes.label }).from(tables.probes),
      );
    await expect(readFrom(TENANT_A)).resolves.toEqual([{ label: "A's probe" }]);
    await expect(readFrom(TENANT_B)).resolves.toEqual([{ label: "B's probe" }]);
  });

  it("names the organization's schema in every query, including relational queries", async () => {
    const { select, relational } = await withTenant(TENANT_A, async ({ db: tenantDb, tables }) => ({
      select: tenantDb.select().from(tables.probes).where(eq(tables.probes.id, "p1")).toSQL().sql,
      relational: tenantDb.query.probes.findMany().toSQL().sql,
    }));

    expect(select).toContain(`"${TENANT_A.schemaName}"."Probe"`);
    expect(relational).toContain(`"${TENANT_A.schemaName}"."Probe"`);
  });

  it("runs transactions against the organization's schema, joined to shared tables", async () => {
    await db.insert(users).values({
      id: "host-1",
      email: "host@springfield.example",
      hashedPassword: "not-a-real-hash",
      role: "HOST",
    });

    await withTenant(TENANT_B, ({ db: tenantDb, tables }) =>
      tenantDb.transaction(async (tx) => {
        await tx.insert(tables.probeGroups).values({ id: "g1", name: "Group" });
        await tx
          .insert(tables.probes)
          .values({ id: "p1", kind: "RED", label: "owned", groupId: "g1", ownerId: "host-1" });
      }),
    );

    const owned = await withTenant(TENANT_B, ({ db: tenantDb, tables }) =>
      tenantDb
        .select({ label: tables.probes.label, ownerEmail: users.email })
        .from(tables.probes)
        .innerJoin(users, eq(users.id, tables.probes.ownerId)),
    );
    expect(owned).toEqual([{ label: "owned", ownerEmail: "host@springfield.example" }]);
    await expect(probeLabelsIn(TENANT_A.schemaName)).resolves.toEqual([]);
  });

  it("reuses one table set per organization", async () => {
    const first = await withTenant(TENANT_A, async (tenant) => tenant);
    const second = await withTenant(TENANT_A, async (tenant) => tenant);
    const other = await withTenant(TENANT_B, async (tenant) => tenant);

    expect(second).toBe(first);
    expect(other).not.toBe(first);
  });

  it("refuses a schema name that generateSchemaName could not have produced", async () => {
    await expect(
      withTenant({ schemaName: "public" }, async () => "should not run"),
    ).rejects.toThrow("Refusing to open invalid tenant schema");
  });
});
