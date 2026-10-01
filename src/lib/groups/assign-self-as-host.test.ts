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

import type * as TenantModule from "@/lib/db/tenant";
import { resetTestDatabase } from "@/lib/db/testing";
import { assignSelfAsHost } from "@/lib/groups/assign-self-as-host";
import { createGroup } from "@/lib/groups/create";
import { GroupManagementNotPermittedError, GroupNotFoundError } from "@/lib/groups/errors";
import { getGroupForOrgAdmin } from "@/lib/groups/get-for-org-admin";
import {
  seedOrganizations,
  shelbyvilleOrgAdmin,
  springfieldOrgAdmin,
  springfieldHost,
} from "@/lib/groups/test-fixtures";

describe("assignSelfAsHost", () => {
  let groupId: string;

  beforeEach(async () => {
    await resetTestDatabase(testDb);
    await seedOrganizations(testDb);
    ({ id: groupId } = await createGroup({
      actor: springfieldOrgAdmin,
      name: "Grade 6 — Room 1",
      sessionCreationMode: "MANUAL",
    }));
  });

  it("makes the org-admin one of the Group's hosts", async () => {
    await assignSelfAsHost({ actor: springfieldOrgAdmin, groupId });

    const { hosts } = await getGroupForOrgAdmin({ actor: springfieldOrgAdmin, groupId });
    expect(hosts).toEqual([
      { id: springfieldOrgAdmin.id, email: springfieldOrgAdmin.email, hasAcceptedInvitation: true },
    ]);
  });

  it("does nothing more when the org-admin is already a host", async () => {
    await assignSelfAsHost({ actor: springfieldOrgAdmin, groupId });
    await assignSelfAsHost({ actor: springfieldOrgAdmin, groupId });

    const { hosts } = await getGroupForOrgAdmin({ actor: springfieldOrgAdmin, groupId });
    expect(hosts).toHaveLength(1);
  });

  it("doesn't find a Group of another Organization", async () => {
    await expect(assignSelfAsHost({ actor: shelbyvilleOrgAdmin, groupId })).rejects.toThrow(
      GroupNotFoundError,
    );
  });

  it("refuses a host", async () => {
    await expect(assignSelfAsHost({ actor: springfieldHost, groupId })).rejects.toThrow(
      GroupManagementNotPermittedError,
    );
  });
});
