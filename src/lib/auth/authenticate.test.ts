import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const { testDb } = await vi.hoisted(async () => {
  const { createTestDatabase } = await import("@/lib/db/testing");
  return { testDb: await createTestDatabase() };
});

vi.mock("@/lib/db/client", () => ({ db: testDb }));

import { authenticateUser } from "@/lib/auth/authenticate";
import { hashPassword } from "@/lib/auth/password";
import { organizations, users, type OrganizationStatus } from "@/lib/db/schema";
import { resetTestDatabase } from "@/lib/db/testing";

const PASSWORD = "correct horse battery staple";
const EMAIL = "admin@springfield.example";

describe("authenticateUser", () => {
  let hashedPassword: string;

  beforeAll(async () => {
    hashedPassword = await hashPassword(PASSWORD);
  });

  beforeEach(async () => {
    await resetTestDatabase(testDb);
  });

  async function createSuperAdmin() {
    await testDb
      .insert(users)
      .values({ id: "user-1", email: EMAIL, hashedPassword, role: "SUPER_ADMIN" });
  }

  async function createOrgAdmin(status: OrganizationStatus) {
    await testDb.insert(organizations).values({
      id: "org-1",
      name: "Springfield Elementary",
      institutionType: "SCHOOL",
      status,
      schemaName: "org_0123456789abcdef0123456789abcdef",
    });
    await testDb.insert(users).values({
      id: "user-1",
      email: EMAIL,
      hashedPassword,
      role: "ORG_ADMIN",
      organizationId: "org-1",
    });
  }

  it("signs in a super-admin, who belongs to no organization", async () => {
    await createSuperAdmin();

    await expect(authenticateUser({ email: EMAIL, password: PASSWORD })).resolves.toEqual({
      id: "user-1",
      email: EMAIL,
      role: "SUPER_ADMIN",
    });
  });

  it("signs in an org-admin whose organization is approved", async () => {
    await createOrgAdmin("APPROVED");

    await expect(authenticateUser({ email: EMAIL, password: PASSWORD })).resolves.toMatchObject({
      role: "ORG_ADMIN",
    });
  });

  it("rejects an org-admin whose organization is still pending", async () => {
    await createOrgAdmin("PENDING");

    await expect(authenticateUser({ email: EMAIL, password: PASSWORD })).resolves.toBeNull();
  });

  it("rejects a wrong password", async () => {
    await createSuperAdmin();

    await expect(
      authenticateUser({ email: EMAIL, password: "wrong password" }),
    ).resolves.toBeNull();
  });

  it("rejects an unknown email", async () => {
    await createSuperAdmin();

    await expect(
      authenticateUser({ email: "nobody@springfield.example", password: PASSWORD }),
    ).resolves.toBeNull();
  });

  it("looks the email up case-insensitively", async () => {
    await createSuperAdmin();

    await expect(
      authenticateUser({ email: "  Admin@Springfield.Example ", password: PASSWORD }),
    ).resolves.toMatchObject({ id: "user-1", email: EMAIL });
  });
});
