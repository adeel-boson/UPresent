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

import { organizations, users } from "@/lib/db/schema";
import type * as TenantModule from "@/lib/db/tenant";
import { resetTestDatabase } from "@/lib/db/testing";
import { createGroup } from "@/lib/groups/create";
import { inviteHost } from "@/lib/groups/invite-host";
import { listGroupsForUser } from "@/lib/groups/list";
import {
  recordingSender,
  seedOrganizations,
  shelbyvilleOrgAdmin,
  springfieldHost,
  springfieldOrgAdmin,
} from "@/lib/groups/test-fixtures";

describe("listGroupsForUser", () => {
  let choirId: string;

  beforeEach(async () => {
    vi.stubEnv("APP_URL", "https://upresent.example");
    await resetTestDatabase(testDb);
    await seedOrganizations(testDb);
    ({ id: choirId } = await createGroup({
      actor: springfieldOrgAdmin,
      name: "Choir",
      sessionCreationMode: "MANUAL",
    }));
    await createGroup({
      actor: springfieldOrgAdmin,
      name: "Band",
      sessionCreationMode: "RECURRING",
    });
    await createGroup({
      actor: shelbyvilleOrgAdmin,
      name: "Shelbyville Choir",
      sessionCreationMode: "MANUAL",
    });
  });

  it("lists every Group of the org-admin's Organization, by name", async () => {
    const groups = await listGroupsForUser(springfieldOrgAdmin);

    expect(groups.map((group) => group.name)).toEqual(["Band", "Choir"]);
  });

  it("lists only the Groups a host hosts, not the rest of their Organization's", async () => {
    await inviteHost(
      { actor: springfieldOrgAdmin, groupId: choirId, email: springfieldHost.email },
      recordingSender(),
    );

    await expect(listGroupsForUser(springfieldHost)).resolves.toEqual([
      { id: choirId, name: "Choir", sessionCreationMode: "MANUAL" },
    ]);
  });

  it("lists nothing for a host not yet added to a Group", async () => {
    await expect(listGroupsForUser(springfieldHost)).resolves.toEqual([]);
  });

  it("lists nothing for a user whose Organization isn't approved", async () => {
    await testDb.insert(organizations).values({
      id: "pending",
      name: "Capital City High",
      institutionType: "SCHOOL",
      schemaName: "org_cccccccccccccccccccccccccccccccc",
    });
    await testDb.insert(users).values({
      id: "pending-org-admin",
      email: "admin@capitalcity.example",
      hashedPassword: "not-a-real-hash",
      role: "ORG_ADMIN",
      organizationId: "pending",
    });

    await expect(listGroupsForUser({ id: "pending-org-admin" })).resolves.toEqual([]);
  });

  it("lists nothing for a super-admin, who belongs to no Organization", async () => {
    await testDb.insert(users).values({
      id: "super-admin",
      email: "operator@upresent.example",
      hashedPassword: "not-a-real-hash",
      role: "SUPER_ADMIN",
    });

    await expect(listGroupsForUser({ id: "super-admin" })).resolves.toEqual([]);
  });
});
