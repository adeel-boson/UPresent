import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { testDb } = await vi.hoisted(async () => {
  const { createTestDatabase } = await import("@/lib/db/testing");
  return { testDb: await createTestDatabase() };
});

vi.mock("@/lib/db/client", () => ({ db: testDb }));

import { verifyPassword } from "@/lib/auth/password";
import { organizations, users } from "@/lib/db/schema";
import { resetTestDatabase } from "@/lib/db/testing";
import {
  EmailAlreadyInUseError,
  signUpOrganization,
  type SignUpOrganizationInput,
} from "@/lib/organizations/signup";

const signupInput: SignUpOrganizationInput = {
  organizationName: "Springfield Elementary",
  institutionType: "SCHOOL",
  orgAdminEmail: "admin@springfield.example",
  orgAdminPassword: "correct horse battery staple",
};

describe("signUpOrganization", () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    await resetTestDatabase(testDb);
  });

  it("creates a pending organization with a hashed-password org-admin user", async () => {
    await signUpOrganization(signupInput);

    const [organization, ...otherOrganizations] = await testDb.select().from(organizations);
    expect(otherOrganizations).toHaveLength(0);
    expect(organization).toMatchObject({
      name: "Springfield Elementary",
      institutionType: "SCHOOL",
      status: "PENDING",
      approvedAt: null,
    });
    expect(organization?.schemaName).toMatch(/^org_[a-f0-9]{32}$/);

    const [orgAdmin, ...otherUsers] = await testDb.select().from(users);
    expect(otherUsers).toHaveLength(0);
    expect(orgAdmin).toMatchObject({
      email: "admin@springfield.example",
      role: "ORG_ADMIN",
      organizationId: organization?.id,
    });
    expect(orgAdmin?.updatedAt).toBeInstanceOf(Date);
    await expect(
      verifyPassword("correct horse battery staple", orgAdmin?.hashedPassword ?? ""),
    ).resolves.toBe(true);
  });

  it("stores the org-admin email lowercased", async () => {
    await signUpOrganization({ ...signupInput, orgAdminEmail: " Admin@Springfield.Example " });

    const stored = await testDb.select({ email: users.email }).from(users);
    expect(stored).toEqual([{ email: "admin@springfield.example" }]);
  });

  it("throws when the org-admin email is already in use", async () => {
    await signUpOrganization(signupInput);

    await expect(
      signUpOrganization({ ...signupInput, organizationName: "Shelbyville College" }),
    ).rejects.toBeInstanceOf(EmailAlreadyInUseError);

    // The whole signup rolled back: no second Organization.
    await expect(testDb.$count(organizations)).resolves.toBe(1);
  });

  it("throws EmailAlreadyInUseError when a concurrent signup wins the unique index", async () => {
    await signUpOrganization(signupInput);
    // Simulate the race: the in-transaction check runs before the concurrent
    // signup commits, so it finds nothing, and the insert then hits the real
    // unique index on User.email (Postgres error 23505).
    const transaction = testDb.transaction.bind(testDb);
    vi.spyOn(testDb, "transaction").mockImplementationOnce((callback) =>
      transaction(async (tx) => {
        vi.spyOn(tx.query.users, "findFirst").mockResolvedValue(undefined);
        return callback(tx);
      }),
    );

    await expect(
      signUpOrganization({ ...signupInput, organizationName: "Shelbyville College" }),
    ).rejects.toBeInstanceOf(EmailAlreadyInUseError);
    await expect(
      testDb.$count(organizations, eq(organizations.name, "Shelbyville College")),
    ).resolves.toBe(0);
  });
});
