import { beforeEach, describe, expect, it, vi } from "vitest";

const { testDb } = await vi.hoisted(async () => {
  const { createTestDatabase } = await import("@/lib/db/testing");
  return { testDb: await createTestDatabase() };
});

vi.mock("@/lib/db/client", () => ({ db: testDb }));

import { organizations, users } from "@/lib/db/schema";
import { resetTestDatabase } from "@/lib/db/testing";
import { listPendingOrganizations } from "@/lib/organizations/list-pending";

async function createOrganization(
  id: string,
  fields: Partial<typeof organizations.$inferInsert> = {},
): Promise<void> {
  await testDb.insert(organizations).values({
    id,
    name: `Organization ${id}`,
    institutionType: "SCHOOL",
    schemaName: `org_${id.padStart(32, "0")}`,
    ...fields,
  });
}

async function createUser(
  email: string,
  fields: Partial<typeof users.$inferInsert> = {},
): Promise<void> {
  await testDb
    .insert(users)
    .values({ email, hashedPassword: "not-a-real-hash", role: "ORG_ADMIN", ...fields });
}

describe("listPendingOrganizations", () => {
  beforeEach(async () => {
    await resetTestDatabase(testDb);
  });

  it("queries pending organizations oldest first, selecting only the org-admin's email", async () => {
    await createOrganization("2", { createdAt: new Date("2026-09-02T00:00:00Z") });
    await createOrganization("1", { createdAt: new Date("2026-09-01T00:00:00Z") });
    await createOrganization("3", { status: "APPROVED" });
    await createUser("host@one.example", { role: "HOST", organizationId: "1" });
    await createUser("admin@one.example", { organizationId: "1" });

    const pending = await listPendingOrganizations();

    expect(pending.map((organization) => organization.id)).toEqual(["1", "2"]);
    // Exactly the DTO's fields: never hashedPassword or other User columns.
    expect(pending[0]).toEqual({
      id: "1",
      name: "Organization 1",
      institutionType: "SCHOOL",
      orgAdminEmail: "admin@one.example",
    });
  });

  it("flattens the org-admin's email onto each organization", async () => {
    await createOrganization("1", {
      name: "Springfield Elementary",
      createdAt: new Date("2026-09-01T00:00:00Z"),
    });
    await createOrganization("2", {
      name: "Shelbyville College",
      institutionType: "COLLEGE",
      createdAt: new Date("2026-09-02T00:00:00Z"),
    });
    await createUser("admin@springfield.example", { organizationId: "1" });

    await expect(listPendingOrganizations()).resolves.toEqual([
      {
        id: "1",
        name: "Springfield Elementary",
        institutionType: "SCHOOL",
        orgAdminEmail: "admin@springfield.example",
      },
      { id: "2", name: "Shelbyville College", institutionType: "COLLEGE", orgAdminEmail: null },
    ]);
  });
});
