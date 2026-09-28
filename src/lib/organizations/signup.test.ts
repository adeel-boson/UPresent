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
import type { Email, EmailSender } from "@/lib/email/email-sender";
import { signUpOrganization, type SignUpOrganizationInput } from "@/lib/organizations/signup";

const signupInput: SignUpOrganizationInput = {
  organizationName: "Springfield Elementary",
  institutionType: "SCHOOL",
  orgAdminEmail: "admin@springfield.example",
  orgAdminPassword: "correct horse battery staple",
};

function createFakeEmailSender() {
  const sent: Email[] = [];
  const sender: EmailSender = {
    send: vi.fn(async (email: Email) => {
      sent.push(email);
    }),
  };
  return { sender, sent };
}

describe("signUpOrganization", () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    vi.stubEnv("APP_URL", "https://upresent.example");
    await resetTestDatabase(testDb);
  });

  it("creates a pending organization with a hashed-password org-admin user", async () => {
    await signUpOrganization(signupInput, createFakeEmailSender().sender);

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
      emailVerified: null,
    });
    expect(orgAdmin?.updatedAt).toBeInstanceOf(Date);
    await expect(
      verifyPassword("correct horse battery staple", orgAdmin?.hashedPassword ?? ""),
    ).resolves.toBe(true);
  });

  it("emails the org-admin a link to verify their email", async () => {
    const { sender, sent } = createFakeEmailSender();

    await signUpOrganization(signupInput, sender);

    expect(sent).toHaveLength(1);
    expect(sent[0]?.to).toBe("admin@springfield.example");
    expect(sent[0]?.subject).toBe("Verify your email for UPresent");
    expect(sent[0]?.text).toMatch(
      /https:\/\/upresent\.example\/verify-email\?token=[A-Za-z0-9_-]{43}\b/,
    );
  });

  it("stores the org-admin email lowercased", async () => {
    await signUpOrganization(
      { ...signupInput, orgAdminEmail: " Admin@Springfield.Example " },
      createFakeEmailSender().sender,
    );

    const stored = await testDb.select({ email: users.email }).from(users);
    expect(stored).toEqual([{ email: "admin@springfield.example" }]);
  });

  it("creates nothing and notifies the owner when the email is already registered", async () => {
    await signUpOrganization(signupInput, createFakeEmailSender().sender);
    const { sender, sent } = createFakeEmailSender();

    // Resolves like a new signup, so the form can't reveal the account exists.
    await expect(
      signUpOrganization(
        {
          ...signupInput,
          organizationName: "Shelbyville College",
          orgAdminEmail: "ADMIN@springfield.example",
        },
        sender,
      ),
    ).resolves.toBeUndefined();

    await expect(testDb.$count(organizations)).resolves.toBe(1);
    expect(sent).toHaveLength(1);
    expect(sent[0]?.to).toBe("admin@springfield.example");
    expect(sent[0]?.subject).toBe("Someone tried to sign up with your email");
    expect(sent[0]?.text).not.toMatch(/verify-email/);
  });

  it("notifies the owner when a concurrent signup wins the unique index", async () => {
    await signUpOrganization(signupInput, createFakeEmailSender().sender);
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
    const { sender, sent } = createFakeEmailSender();

    await expect(
      signUpOrganization({ ...signupInput, organizationName: "Shelbyville College" }, sender),
    ).resolves.toBeUndefined();

    await expect(
      testDb.$count(organizations, eq(organizations.name, "Shelbyville College")),
    ).resolves.toBe(0);
    expect(sent.map((email) => email.subject)).toEqual([
      "Someone tried to sign up with your email",
    ]);
  });

  it("rolls back the signup when the verification email can't be sent", async () => {
    const failingSender: EmailSender = {
      send: vi.fn(async () => {
        throw new Error("Resend is down");
      }),
    };

    await expect(signUpOrganization(signupInput, failingSender)).rejects.toThrow("Resend is down");

    // Nothing was kept, so the person can simply sign up again.
    await expect(testDb.$count(organizations)).resolves.toBe(0);
    await expect(testDb.$count(users)).resolves.toBe(0);
  });
});
