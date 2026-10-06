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
import { createGroup } from "@/lib/groups/create";
import { GroupManagementNotPermittedError } from "@/lib/groups/errors";
import {
  seedOrganizations,
  shelbyvilleOrgAdmin,
  springfieldHost,
  springfieldOrgAdmin,
} from "@/lib/groups/test-fixtures";
import { addMember } from "@/lib/members/add";
import { listRoster } from "@/lib/members/list-roster";
import { MemberNotFoundError, removeMember } from "@/lib/members/remove";

describe("removeMember", () => {
  let groupId: string;
  let bartId: string;

  beforeEach(async () => {
    await resetTestDatabase(testDb);
    await seedOrganizations(testDb);
    ({ id: groupId } = await createGroup({
      actor: springfieldOrgAdmin,
      name: "Grade 4 — Room 2",
      sessionCreationMode: "MANUAL",
    }));
    ({ id: bartId } = await addMember({ actor: springfieldOrgAdmin, groupId, name: "Bart" }));
    await addMember({ actor: springfieldOrgAdmin, groupId, name: "Lisa" });
  });

  it("takes the Member off the Group's roster", async () => {
    await removeMember({ actor: springfieldOrgAdmin, groupId, memberId: bartId });

    const { members } = await listRoster({ actor: springfieldOrgAdmin, groupId });
    expect(members.map((member) => member.name)).toEqual(["Lisa"]);
  });

  it("throws when the Member is already removed", async () => {
    await removeMember({ actor: springfieldOrgAdmin, groupId, memberId: bartId });

    await expect(
      removeMember({ actor: springfieldOrgAdmin, groupId, memberId: bartId }),
    ).rejects.toThrow(MemberNotFoundError);
  });

  it("doesn't remove a Member through another Group", async () => {
    const { id: otherGroupId } = await createGroup({
      actor: springfieldOrgAdmin,
      name: "Band",
      sessionCreationMode: "MANUAL",
    });

    await expect(
      removeMember({ actor: springfieldOrgAdmin, groupId: otherGroupId, memberId: bartId }),
    ).rejects.toThrow(MemberNotFoundError);
    const { members } = await listRoster({ actor: springfieldOrgAdmin, groupId });
    expect(members).toHaveLength(2);
  });

  it("doesn't find a Member of another Organization", async () => {
    await expect(
      removeMember({ actor: shelbyvilleOrgAdmin, groupId, memberId: bartId }),
    ).rejects.toThrow(MemberNotFoundError);
    const { members } = await listRoster({ actor: springfieldOrgAdmin, groupId });
    expect(members).toHaveLength(2);
  });

  it("refuses a host", async () => {
    await expect(
      removeMember({ actor: springfieldHost, groupId, memberId: bartId }),
    ).rejects.toThrow(GroupManagementNotPermittedError);
    const { members } = await listRoster({ actor: springfieldOrgAdmin, groupId });
    expect(members).toHaveLength(2);
  });
});
