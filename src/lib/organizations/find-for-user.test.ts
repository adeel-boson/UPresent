import { beforeEach, describe, expect, it, vi } from "vitest";

const { testDb } = await vi.hoisted(async () => {
  const { createTestDatabase } = await import("@/lib/db/testing");
  return { testDb: await createTestDatabase() };
});

vi.mock("@/lib/db/client", () => ({ db: testDb }));

import { organizations, users } from "@/lib/db/schema";
import { resetTestDatabase } from "@/lib/db/testing";
import { findOrganizationOfUser } from "@/lib/organizations/find-for-user";

describe("findOrganizationOfUser", () => {
  beforeEach(async () => {
    await resetTestDatabase(testDb);
  });

  it("returns the name of the organization an org-admin belongs to", async () => {
    await testDb.insert(organizations).values({
      id: "org-1",
      name: "Springfield Elementary",
      institutionType: "SCHOOL",
      status: "APPROVED",
      schemaName: "org_0123456789abcdef0123456789abcdef",
    });
    await testDb.insert(users).values({
      id: "user-1",
      email: "admin@springfield.example",
      hashedPassword: "unused",
      role: "ORG_ADMIN",
      organizationId: "org-1",
    });

    await expect(findOrganizationOfUser("user-1")).resolves.toEqual({
      name: "Springfield Elementary",
    });
  });

  it("returns null for a super-admin, who belongs to no organization", async () => {
    await testDb.insert(users).values({
      id: "user-1",
      email: "operator@upresent.example",
      hashedPassword: "unused",
      role: "SUPER_ADMIN",
    });

    await expect(findOrganizationOfUser("user-1")).resolves.toBeNull();
  });
});
