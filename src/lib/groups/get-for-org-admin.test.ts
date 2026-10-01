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

import { acceptHostInvitation } from "@/lib/auth/accept-host-invitation";
import type * as TenantModule from "@/lib/db/tenant";
import { resetTestDatabase } from "@/lib/db/testing";
import { createGroup } from "@/lib/groups/create";
import { GroupManagementNotPermittedError, GroupNotFoundError } from "@/lib/groups/errors";
import { getGroupForOrgAdmin } from "@/lib/groups/get-for-org-admin";
import { inviteHost } from "@/lib/groups/invite-host";
import {
  readToken,
  recordingSender,
  seedOrganizations,
  shelbyvilleOrgAdmin,
  springfieldOrgAdmin,
  springfieldHost,
} from "@/lib/groups/test-fixtures";

describe("getGroupForOrgAdmin", () => {
  let groupId: string;

  beforeEach(async () => {
    vi.stubEnv("APP_URL", "https://upresent.example");
    await resetTestDatabase(testDb);
    await seedOrganizations(testDb);
    ({ id: groupId } = await createGroup({
      actor: springfieldOrgAdmin,
      name: "Grade 2 — Room 7",
      sessionCreationMode: "RECURRING",
    }));
  });

  it("returns a new Group with no hosts", async () => {
    await expect(getGroupForOrgAdmin({ actor: springfieldOrgAdmin, groupId })).resolves.toEqual({
      id: groupId,
      name: "Grade 2 — Room 7",
      sessionCreationMode: "RECURRING",
      hosts: [],
    });
  });

  it("lists invited hosts by email, pending until they accept", async () => {
    const lisaInvite = recordingSender();
    await inviteHost(
      { actor: springfieldOrgAdmin, groupId, email: "lisa@springfield.example" },
      lisaInvite,
    );
    await inviteHost(
      { actor: springfieldOrgAdmin, groupId, email: "bart@springfield.example" },
      recordingSender(),
    );
    await acceptHostInvitation({ token: readToken(lisaInvite.sent[0]), password: "saxophone 42" });

    const group = await getGroupForOrgAdmin({ actor: springfieldOrgAdmin, groupId });

    expect(group.hosts).toEqual([
      { id: expect.any(String), email: "bart@springfield.example", hasAcceptedInvitation: false },
      { id: expect.any(String), email: "lisa@springfield.example", hasAcceptedInvitation: true },
    ]);
  });

  it("doesn't find a Group of another Organization", async () => {
    await expect(getGroupForOrgAdmin({ actor: shelbyvilleOrgAdmin, groupId })).rejects.toThrow(
      GroupNotFoundError,
    );
  });

  it("refuses a host", async () => {
    await expect(getGroupForOrgAdmin({ actor: springfieldHost, groupId })).rejects.toThrow(
      GroupManagementNotPermittedError,
    );
  });
});
