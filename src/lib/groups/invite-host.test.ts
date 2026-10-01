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
import { GroupManagementNotPermittedError, GroupNotFoundError } from "@/lib/groups/errors";
import { getGroupForOrgAdmin } from "@/lib/groups/get-for-org-admin";
import { HostEmailNotInvitableError, inviteHost } from "@/lib/groups/invite-host";
import { listGroupsForUser } from "@/lib/groups/list";
import {
  readToken,
  recordingSender,
  seedOrganizations,
  shelbyvilleAdmin,
  springfieldAdmin,
  springfieldHost,
} from "@/lib/groups/test-fixtures";

const INVITEE = "lisa.teacher@springfield.example";

describe("inviteHost", () => {
  let groupId: string;

  beforeEach(async () => {
    vi.stubEnv("APP_URL", "https://upresent.example");
    await resetTestDatabase(testDb);
    await seedOrganizations(testDb);
    ({ id: groupId } = await createGroup({
      actor: springfieldAdmin,
      name: "Grade 2 — Room 7",
      sessionCreationMode: "MANUAL",
    }));
  });

  it("emails the invitee a link to set their password", async () => {
    const sender = recordingSender();

    await inviteHost({ actor: springfieldAdmin, groupId, email: INVITEE }, sender);

    expect(sender.sent).toHaveLength(1);
    expect(sender.sent[0]?.to).toBe(INVITEE);
    expect(sender.sent[0]?.text).toContain("Grade 2 — Room 7");
    expect(sender.sent[0]?.text).toContain("Springfield Elementary");
    expect(sender.sent[0]?.text).toMatch(
      /https:\/\/upresent\.example\/accept-invitation\?token=\S+/,
    );
  });

  it("sends a fresh link when re-inviting a host who hasn't accepted, listing them once", async () => {
    const first = recordingSender();
    const second = recordingSender();
    await inviteHost({ actor: springfieldAdmin, groupId, email: INVITEE }, first);

    await inviteHost({ actor: springfieldAdmin, groupId, email: INVITEE.toUpperCase() }, second);

    expect(readToken(second.sent[0])).not.toBe(readToken(first.sent[0]));
    const { hosts } = await getGroupForOrgAdmin({ actor: springfieldAdmin, groupId });
    expect(hosts).toEqual([
      { id: expect.any(String), email: INVITEE, hasAcceptedInvitation: false },
    ]);
  });

  it("adds a host who already has a password to another Group, telling them without a link", async () => {
    const otherGroup = await createGroup({
      actor: springfieldAdmin,
      name: "Choir",
      sessionCreationMode: "MANUAL",
    });
    const sender = recordingSender();

    await inviteHost(
      { actor: springfieldAdmin, groupId: otherGroup.id, email: springfieldHost.email },
      sender,
    );

    expect(sender.sent).toHaveLength(1);
    expect(sender.sent[0]?.to).toBe(springfieldHost.email);
    expect(sender.sent[0]?.text).toContain("Choir");
    expect(sender.sent[0]?.text).not.toContain("token=");
    await expect(listGroupsForUser(springfieldHost)).resolves.toEqual([
      { id: otherGroup.id, name: "Choir", sessionCreationMode: "MANUAL" },
    ]);
  });

  it("refuses an email whose account isn't one of the Organization's hosts", async () => {
    await testDb.insert(users).values({
      email: "operator@upresent.example",
      hashedPassword: "not-a-real-hash",
      role: "SUPER_ADMIN",
    });
    const sender = recordingSender();

    for (const email of [
      shelbyvilleAdmin.email,
      springfieldAdmin.email,
      "operator@upresent.example",
    ]) {
      await expect(inviteHost({ actor: springfieldAdmin, groupId, email }, sender)).rejects.toThrow(
        HostEmailNotInvitableError,
      );
    }
    expect(sender.sent).toEqual([]);
    const { hosts } = await getGroupForOrgAdmin({ actor: springfieldAdmin, groupId });
    expect(hosts).toEqual([]);
  });

  it("doesn't find a Group of another Organization", async () => {
    const sender = recordingSender();

    await expect(
      inviteHost({ actor: shelbyvilleAdmin, groupId, email: INVITEE }, sender),
    ).rejects.toThrow(GroupNotFoundError);
    expect(sender.sent).toEqual([]);
  });

  it("refuses a host", async () => {
    await expect(
      inviteHost({ actor: springfieldHost, groupId, email: INVITEE }, recordingSender()),
    ).rejects.toThrow(GroupManagementNotPermittedError);
  });

  it("invites nobody when the email can't be sent", async () => {
    const failingSender = {
      send: async () => {
        throw new Error("Resend is down");
      },
    };

    await expect(
      inviteHost({ actor: springfieldAdmin, groupId, email: INVITEE }, failingSender),
    ).rejects.toThrow("Resend is down");
    const { hosts } = await getGroupForOrgAdmin({ actor: springfieldAdmin, groupId });
    expect(hosts).toEqual([]);
  });
});
