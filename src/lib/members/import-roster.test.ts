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
import { importRoster, RosterCsvUnreadableError } from "@/lib/members/import-roster";
import { listRoster } from "@/lib/members/list-roster";

describe("importRoster", () => {
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

  // The roster by name, then ID (the roster itself breaks name ties by its
  // random Member id).
  async function rosterOf(id: string) {
    const { members } = await listRoster({ actor: springfieldOrgAdmin, groupId: id });
    return members
      .map(({ name, externalId }) => ({ name, externalId }))
      .sort((a, b) => `${a.name}|${a.externalId}`.localeCompare(`${b.name}|${b.externalId}`));
  }

  it("puts every valid row on the Group's roster", async () => {
    const report = await importRoster({
      actor: springfieldOrgAdmin,
      groupId,
      csv: "Name,ID\nBart Simpson,S-1001\nLisa Simpson,S-1002\n",
    });

    expect(report).toEqual({ addedCount: 2, rejectedRows: [] });
    await expect(rosterOf(groupId)).resolves.toEqual([
      { name: "Bart Simpson", externalId: "S-1001" },
      { name: "Lisa Simpson", externalId: "S-1002" },
    ]);
  });

  it("reports invalid rows by line and still adds the valid ones", async () => {
    const report = await importRoster({
      actor: springfieldOrgAdmin,
      groupId,
      csv: [
        "Name,ID",
        "Bart Simpson,S-1001",
        ",S-1002",
        `${"x".repeat(201)},S-1003`,
        `Lisa Simpson,${"9".repeat(101)}`,
        "Milhouse Van Houten,",
      ].join("\n"),
    });

    expect(report).toEqual({
      addedCount: 2,
      rejectedRows: [
        { line: 3, name: "", reason: "MISSING_NAME" },
        { line: 4, name: "x".repeat(201), reason: "NAME_TOO_LONG" },
        { line: 5, name: "Lisa Simpson", reason: "EXTERNAL_ID_TOO_LONG" },
      ],
    });
    await expect(rosterOf(groupId)).resolves.toEqual([
      { name: "Bart Simpson", externalId: "S-1001" },
      { name: "Milhouse Van Houten", externalId: null },
    ]);
  });

  it("skips Members already on the roster: by ID ignoring case, or by name when neither has an ID", async () => {
    await addMember({ actor: springfieldOrgAdmin, groupId, name: "Bart", externalId: "S-1001" });
    await addMember({ actor: springfieldOrgAdmin, groupId, name: "Milhouse" });
    await addMember({ actor: springfieldOrgAdmin, groupId, name: "Nelson", externalId: "S-1003" });

    const report = await importRoster({
      actor: springfieldOrgAdmin,
      groupId,
      csv: "Name,ID\nBartholomew,s-1001\nmilhouse,\nNelson,\nLisa,S-1002\n",
    });

    expect(report).toEqual({
      addedCount: 2,
      rejectedRows: [
        { line: 2, name: "Bartholomew", reason: "ALREADY_ON_ROSTER" },
        { line: 3, name: "milhouse", reason: "ALREADY_ON_ROSTER" },
      ],
    });
    await expect(rosterOf(groupId)).resolves.toEqual([
      { name: "Bart", externalId: "S-1001" },
      { name: "Lisa", externalId: "S-1002" },
      { name: "Milhouse", externalId: null },
      { name: "Nelson", externalId: null },
      { name: "Nelson", externalId: "S-1003" },
    ]);
  });

  it("reads a spreadsheet export: BOM, CRLF, quoted fields, columns in any order", async () => {
    const report = await importRoster({
      actor: springfieldOrgAdmin,
      groupId,
      csv:
        "﻿Homeroom,External ID,NAME\r\n" +
        '4B,S-1001,"Simpson, Bart"\r\n' +
        '4B,,"Lisa ""Lis"" Simpson"\r\n' +
        '4B,S-1003,"Martin\r\n  Prince"\r\n' +
        "4B, S-1004 ,  Ralph Wiggum  \r\n" +
        "\r\n",
    });

    expect(report).toEqual({ addedCount: 4, rejectedRows: [] });
    await expect(rosterOf(groupId)).resolves.toEqual([
      { name: 'Lisa "Lis" Simpson', externalId: null },
      { name: "Martin Prince", externalId: "S-1003" },
      { name: "Ralph Wiggum", externalId: "S-1004" },
      { name: "Simpson, Bart", externalId: "S-1001" },
    ]);
  });

  it("keeps a quote inside an unquoted field as part of it", async () => {
    const report = await importRoster({
      actor: springfieldOrgAdmin,
      groupId,
      csv: 'Name,ID\nShauna O"Neil,S-1001\nBart "B" Simpson,S-1002\n',
    });

    expect(report).toEqual({ addedCount: 2, rejectedRows: [] });
    await expect(rosterOf(groupId)).resolves.toEqual([
      { name: 'Bart "B" Simpson', externalId: "S-1002" },
      { name: 'Shauna O"Neil', externalId: "S-1001" },
    ]);
  });

  it("numbers rows by the line they start on", async () => {
    const report = await importRoster({
      actor: springfieldOrgAdmin,
      groupId,
      csv: 'ID,Name\nS-1001,"Martin\nPrince"\n\nS-1002,\n',
    });

    expect(report.rejectedRows).toEqual([{ line: 5, name: "", reason: "MISSING_NAME" }]);
  });

  it.each([
    { file: "empty", csv: "﻿\r\n\r\n", problem: { kind: "NO_NAME_COLUMN" } },
    {
      file: "without a Name column",
      csv: "Bart Simpson,S-1001\nLisa Simpson,S-1002\n",
      problem: { kind: "NO_NAME_COLUMN" },
    },
    {
      file: "with an unclosed quote",
      csv: 'Name,ID\nBart,S-1001\n"Lisa,S-1002\nMilhouse,S-1003\n',
      problem: { kind: "UNCLOSED_QUOTE", line: 3 },
    },
    {
      file: "of more than 2000 Members",
      csv: ["Name", ...Array.from({ length: 2001 }, (_, i) => `Member ${i}`)].join("\n"),
      problem: { kind: "TOO_MANY_ROWS", maxRows: 2000 },
    },
  ])("refuses a file $file and adds no one", async ({ csv, problem }) => {
    const importing = importRoster({ actor: springfieldOrgAdmin, groupId, csv });

    await expect(importing).rejects.toThrow(RosterCsvUnreadableError);
    await expect(importing).rejects.toMatchObject({ problem });
    await expect(rosterOf(groupId)).resolves.toEqual([]);
  });

  it("doesn't find a Group of another Organization", async () => {
    await expect(
      importRoster({ actor: shelbyvilleOrgAdmin, groupId, csv: "Name\nBart\n" }),
    ).rejects.toThrow(GroupNotFoundError);
    await expect(rosterOf(groupId)).resolves.toEqual([]);
  });

  it("refuses a host", async () => {
    await expect(
      importRoster({ actor: springfieldHost, groupId, csv: "Name\nBart\n" }),
    ).rejects.toThrow(GroupManagementNotPermittedError);
    await expect(rosterOf(groupId)).resolves.toEqual([]);
  });

  it("matches a name on the roster ignoring runs of spaces", async () => {
    await addMember({ actor: springfieldOrgAdmin, groupId, name: "Bart  Simpson" });

    const report = await importRoster({
      actor: springfieldOrgAdmin,
      groupId,
      csv: "Name\nBart Simpson\n",
    });

    expect(report).toEqual({
      addedCount: 0,
      rejectedRows: [{ line: 2, name: "Bart Simpson", reason: "ALREADY_ON_ROSTER" }],
    });
  });

  it("adds a Member repeated in the file only once", async () => {
    const report = await importRoster({
      actor: springfieldOrgAdmin,
      groupId,
      csv: "Name,ID\nBart,S-1001\nBartholomew,s-1001\nMilhouse,\nMILHOUSE,\n",
    });

    expect(report).toEqual({
      addedCount: 2,
      rejectedRows: [
        { line: 3, name: "Bartholomew", reason: "REPEATED_IN_FILE" },
        { line: 5, name: "MILHOUSE", reason: "REPEATED_IN_FILE" },
      ],
    });
    await expect(rosterOf(groupId)).resolves.toEqual([
      { name: "Bart", externalId: "S-1001" },
      { name: "Milhouse", externalId: null },
    ]);
  });
});
