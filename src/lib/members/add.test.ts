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
import { GroupManagementNotPermittedError, GroupNotFoundError } from "@/lib/groups/errors";
import {
  seedOrganizations,
  shelbyvilleOrgAdmin,
  springfieldHost,
  springfieldOrgAdmin,
} from "@/lib/groups/test-fixtures";
import { addMember, MemberExternalIdTakenError } from "@/lib/members/add";
import { listRoster } from "@/lib/members/list-roster";

describe("addMember", () => {
  let groupId: string;

  beforeEach(async () => {
    await resetTestDatabase(testDb);
    await seedOrganizations(testDb);
    ({ id: groupId } = await createGroup({
      actor: springfieldOrgAdmin,
      name: "Grade 4 — Room 2",
      sessionCreationMode: "MANUAL",
    }));
  });

  it("puts the Member on the Group's roster", async () => {
    const { id } = await addMember({
      actor: springfieldOrgAdmin,
      groupId,
      name: "Bart Simpson",
      externalId: "S-1001",
    });

    await expect(listRoster({ actor: springfieldOrgAdmin, groupId })).resolves.toEqual({
      members: [{ id, name: "Bart Simpson", externalId: "S-1001" }],
      page: 1,
      pageCount: 1,
    });
  });

  it("adds a Member with no external ID", async () => {
    const { id } = await addMember({ actor: springfieldOrgAdmin, groupId, name: "Milhouse" });

    const { members } = await listRoster({ actor: springfieldOrgAdmin, groupId });
    expect(members).toEqual([{ id, name: "Milhouse", externalId: null }]);
  });

  it("allows several Members without an external ID", async () => {
    await addMember({ actor: springfieldOrgAdmin, groupId, name: "Milhouse" });
    await addMember({ actor: springfieldOrgAdmin, groupId, name: "Nelson" });

    const { members } = await listRoster({ actor: springfieldOrgAdmin, groupId });
    expect(members.map((member) => member.name)).toEqual(["Milhouse", "Nelson"]);
  });

  it("refuses an external ID already on the Group's roster", async () => {
    await addMember({ actor: springfieldOrgAdmin, groupId, name: "Bart", externalId: "S-1001" });

    await expect(
      addMember({ actor: springfieldOrgAdmin, groupId, name: "Lisa", externalId: "S-1001" }),
    ).rejects.toThrow(MemberExternalIdTakenError);
    const { members } = await listRoster({ actor: springfieldOrgAdmin, groupId });
    expect(members.map((member) => member.name)).toEqual(["Bart"]);
  });

  it("refuses an external ID that differs from one on the roster only in case", async () => {
    await addMember({ actor: springfieldOrgAdmin, groupId, name: "Bart", externalId: "S-1001" });

    await expect(
      addMember({ actor: springfieldOrgAdmin, groupId, name: "Lisa", externalId: "s-1001" }),
    ).rejects.toThrow(MemberExternalIdTakenError);
  });

  it("allows the same external ID on another Group's roster", async () => {
    const { id: otherGroupId } = await createGroup({
      actor: springfieldOrgAdmin,
      name: "Band",
      sessionCreationMode: "MANUAL",
    });
    await addMember({ actor: springfieldOrgAdmin, groupId, name: "Bart", externalId: "S-1001" });

    await addMember({
      actor: springfieldOrgAdmin,
      groupId: otherGroupId,
      name: "Bart",
      externalId: "S-1001",
    });

    const { members } = await listRoster({ actor: springfieldOrgAdmin, groupId: otherGroupId });
    expect(members).toHaveLength(1);
  });

  it("doesn't find a Group of another Organization", async () => {
    await expect(addMember({ actor: shelbyvilleOrgAdmin, groupId, name: "Bart" })).rejects.toThrow(
      GroupNotFoundError,
    );
    const { members } = await listRoster({ actor: springfieldOrgAdmin, groupId });
    expect(members).toEqual([]);
  });

  it("refuses a host", async () => {
    await expect(addMember({ actor: springfieldHost, groupId, name: "Bart" })).rejects.toThrow(
      GroupManagementNotPermittedError,
    );
  });
});
