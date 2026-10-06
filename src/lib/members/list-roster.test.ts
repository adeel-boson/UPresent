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
import { addMember } from "@/lib/members/add";
import { listRoster, ROSTER_PAGE_SIZE } from "@/lib/members/list-roster";

describe("listRoster", () => {
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

  it("is empty for a new Group", async () => {
    await expect(listRoster({ actor: springfieldOrgAdmin, groupId })).resolves.toEqual({
      members: [],
      page: 1,
      pageCount: 1,
    });
  });

  it("lists only the Group's own Members, by name", async () => {
    const { id: otherGroupId } = await createGroup({
      actor: springfieldOrgAdmin,
      name: "Band",
      sessionCreationMode: "MANUAL",
    });
    await addMember({ actor: springfieldOrgAdmin, groupId, name: "Nelson" });
    await addMember({ actor: springfieldOrgAdmin, groupId: otherGroupId, name: "Lisa" });
    await addMember({ actor: springfieldOrgAdmin, groupId, name: "Bart" });

    const { members } = await listRoster({ actor: springfieldOrgAdmin, groupId });
    expect(members.map((member) => member.name)).toEqual(["Bart", "Nelson"]);
  });

  it("pages a long roster", async () => {
    expect(ROSTER_PAGE_SIZE).toBe(50);
    for (let n = 1; n <= 51; n++) {
      await addMember({
        actor: springfieldOrgAdmin,
        groupId,
        name: `Member ${String(n).padStart(2, "0")}`,
      });
    }

    const first = await listRoster({ actor: springfieldOrgAdmin, groupId });
    expect(first.members).toHaveLength(50);
    expect(first.members[0]?.name).toBe("Member 01");
    expect(first.members[49]?.name).toBe("Member 50");
    expect(first.page).toBe(1);
    expect(first.pageCount).toBe(2);

    const second = await listRoster({ actor: springfieldOrgAdmin, groupId, page: 2 });
    expect(second.members.map((member) => member.name)).toEqual(["Member 51"]);
    expect(second.page).toBe(2);
    expect(second.pageCount).toBe(2);
  });

  it("shows the last page when asked for a page past the end", async () => {
    for (let n = 1; n <= 51; n++) {
      await addMember({
        actor: springfieldOrgAdmin,
        groupId,
        name: `Member ${String(n).padStart(2, "0")}`,
      });
    }

    const roster = await listRoster({ actor: springfieldOrgAdmin, groupId, page: 999 });
    expect(roster.members.map((member) => member.name)).toEqual(["Member 51"]);
    expect(roster.page).toBe(2);
    expect(roster.pageCount).toBe(2);
  });

  it("shows the only page of an empty roster when asked for a later one", async () => {
    await expect(listRoster({ actor: springfieldOrgAdmin, groupId, page: 2 })).resolves.toEqual({
      members: [],
      page: 1,
      pageCount: 1,
    });
  });

  it("doesn't find a Group of another Organization", async () => {
    await addMember({ actor: springfieldOrgAdmin, groupId, name: "Bart" });

    await expect(listRoster({ actor: shelbyvilleOrgAdmin, groupId })).rejects.toThrow(
      GroupNotFoundError,
    );
  });

  it("refuses a host", async () => {
    await expect(listRoster({ actor: springfieldHost, groupId })).rejects.toThrow(
      GroupManagementNotPermittedError,
    );
  });
});
