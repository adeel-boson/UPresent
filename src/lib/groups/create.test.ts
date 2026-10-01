import { beforeEach, describe, expect, it, vi } from "vitest";

const { testDb } = await vi.hoisted(async () => {
  const { createTestDatabase } = await import("@/lib/db/testing");
  return { testDb: await createTestDatabase() };
});

vi.mock("@/lib/db/client", () => ({ db: testDb }));
vi.mock("@/lib/db/tenant", async (importOriginal) => {
  const tenant = await importOriginal<typeof TenantModule>();
  const { createTestWithTenant } = await import("@/lib/db/testing");
  return { ...tenant, withTenant: createTestWithTenant(testDb, tenant.createWithTenant) };
});

import { users } from "@/lib/db/schema";
import type * as TenantModule from "@/lib/db/tenant";
import { resetTestDatabase } from "@/lib/db/testing";
import { createGroup } from "@/lib/groups/create";
import { GroupManagementNotPermittedError } from "@/lib/groups/errors";
import { listGroupsForUser } from "@/lib/groups/list";
import {
  seedOrganizations,
  shelbyvilleOrgAdmin,
  springfieldOrgAdmin,
  springfieldHost,
} from "@/lib/groups/test-fixtures";

describe("createGroup", () => {
  beforeEach(async () => {
    await resetTestDatabase(testDb);
    await seedOrganizations(testDb);
  });

  it("creates a Group that the org-admin then sees in their list", async () => {
    const { id } = await createGroup({
      actor: springfieldOrgAdmin,
      name: "Grade 4 — Room 2",
      sessionCreationMode: "RECURRING",
    });

    await expect(listGroupsForUser(springfieldOrgAdmin)).resolves.toEqual([
      { id, name: "Grade 4 — Room 2", sessionCreationMode: "RECURRING" },
    ]);
  });

  it("keeps the Group inside the org-admin's own Organization", async () => {
    await createGroup({
      actor: springfieldOrgAdmin,
      name: "Grade 4 — Room 2",
      sessionCreationMode: "MANUAL",
    });

    await expect(listGroupsForUser(shelbyvilleOrgAdmin)).resolves.toEqual([]);
  });

  it("refuses a host", async () => {
    await expect(
      createGroup({ actor: springfieldHost, name: "Detention", sessionCreationMode: "MANUAL" }),
    ).rejects.toThrow(GroupManagementNotPermittedError);
  });

  it("refuses a user with no Organization", async () => {
    await testDb.insert(users).values({
      id: "super-admin",
      email: "operator@upresent.example",
      hashedPassword: "not-a-real-hash",
      role: "SUPER_ADMIN",
    });

    await expect(
      createGroup({ actor: { id: "super-admin" }, name: "Ops", sessionCreationMode: "MANUAL" }),
    ).rejects.toThrow(GroupManagementNotPermittedError);
  });
});
