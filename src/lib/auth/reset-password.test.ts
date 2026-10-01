import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { testDb } = await vi.hoisted(async () => {
  const { createTestDatabase } = await import("@/lib/db/testing");
  return { testDb: await createTestDatabase() };
});

vi.mock("@/lib/db/client", () => ({ db: testDb }));

import { authenticateUser } from "@/lib/auth/authenticate";
import { hashPassword } from "@/lib/auth/password";
import type { RequestContext } from "@/lib/auth/request-context";
import { requestPasswordReset } from "@/lib/auth/request-password-reset";
import { InvalidPasswordResetTokenError, resetPassword } from "@/lib/auth/reset-password";
import { users } from "@/lib/db/schema";
import { resetTestDatabase } from "@/lib/db/testing";
import type { Email } from "@/lib/email/email-sender";
import { signUpOrganization } from "@/lib/organizations/signup";

const EMAIL = "super-admin@upresent.example";
const OLD_PASSWORD = "old password 123";
const NEW_PASSWORD = "new password 456";
const REQUESTED_AT = new Date("2026-09-29T14:00:00Z");

const REQUEST_CONTEXT: RequestContext = {
  browser: "Firefox 130",
  os: "macOS",
  device: "desktop",
  ip: "198.51.100.23",
  time: new Date("2026-09-29T14:20:00Z"),
};

function recordingSender(): { sent: Email[]; send: (email: Email) => Promise<void> } {
  const sent: Email[] = [];
  return { sent, send: async (email) => void sent.push(email) };
}

function readToken(email: Email | undefined): string {
  const link = email?.text.match(/https:\/\/\S+/)?.[0];
  const token = link ? new URL(link).searchParams.get("token") : null;
  if (!token) {
    throw new Error("The email carries no link with a token.");
  }
  return token;
}

async function createUser(fields: Partial<typeof users.$inferInsert> = {}): Promise<void> {
  await testDb.insert(users).values({
    email: EMAIL,
    hashedPassword: await hashPassword(OLD_PASSWORD),
    role: "SUPER_ADMIN",
    ...fields,
  });
}

async function requestResetToken(): Promise<string> {
  const sender = recordingSender();
  await requestPasswordReset({ email: EMAIL, requestContext: REQUEST_CONTEXT }, sender);
  return readToken(sender.sent[0]);
}

async function reset(token: string, sender = recordingSender()): Promise<void> {
  await resetPassword(
    { token, newPassword: NEW_PASSWORD, requestContext: REQUEST_CONTEXT },
    sender,
  );
}

async function canLogInWith(password: string): Promise<boolean> {
  return (await authenticateUser({ email: EMAIL, password })) !== null;
}

async function readEmailVerified(): Promise<Date | null | undefined> {
  const [user] = await testDb
    .select({ emailVerified: users.emailVerified })
    .from(users)
    .where(eq(users.email, EMAIL));
  return user?.emailVerified;
}

describe("resetPassword", () => {
  beforeEach(async () => {
    // Only Date is faked, so PGlite's own timers keep running.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(REQUESTED_AT);
    vi.stubEnv("APP_URL", "https://upresent.example");
    await resetTestDatabase(testDb);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  it("replaces the user's password", async () => {
    await createUser();
    const token = await requestResetToken();

    await reset(token);

    await expect(canLogInWith(NEW_PASSWORD)).resolves.toBe(true);
    await expect(canLogInWith(OLD_PASSWORD)).resolves.toBe(false);
  });

  it("emails the user that their password changed, and from where", async () => {
    await createUser();
    const token = await requestResetToken();
    const sender = recordingSender();

    await reset(token, sender);

    expect(sender.sent).toHaveLength(1);
    expect(sender.sent[0]?.to).toBe(EMAIL);
    expect(sender.sent[0]?.subject).toBe("Your UPresent password was changed");
    expect(sender.sent[0]?.text).toContain(
      "Changed from: Firefox 130 on macOS (desktop) · IP 198.51.100.23 · 29 Sep 2026, 14:20 UTC",
    );
  });

  it("rejects a token that was never issued", async () => {
    await createUser();
    const sender = recordingSender();

    await expect(reset("not-a-real-token", sender)).rejects.toBeInstanceOf(
      InvalidPasswordResetTokenError,
    );
    await expect(canLogInWith(OLD_PASSWORD)).resolves.toBe(true);
    expect(sender.sent).toEqual([]);
  });

  it("rejects a token that was already used", async () => {
    await createUser();
    const token = await requestResetToken();
    await reset(token);

    await expect(reset(token)).rejects.toBeInstanceOf(InvalidPasswordResetTokenError);
  });

  it("rejects a token more than 1 hour old", async () => {
    await createUser();
    const token = await requestResetToken();
    vi.setSystemTime(new Date("2026-09-29T15:00:01Z"));

    await expect(reset(token)).rejects.toBeInstanceOf(InvalidPasswordResetTokenError);
    await expect(canLogInWith(OLD_PASSWORD)).resolves.toBe(true);
  });

  it("accepts a token just under 1 hour old", async () => {
    await createUser();
    const token = await requestResetToken();
    vi.setSystemTime(new Date("2026-09-29T14:59:59Z"));

    await reset(token);

    await expect(canLogInWith(NEW_PASSWORD)).resolves.toBe(true);
  });

  it("accepts an older outstanding link, then invalidates every other link", async () => {
    await createUser();
    const olderToken = await requestResetToken();
    const newerToken = await requestResetToken();

    await reset(olderToken);

    await expect(reset(newerToken)).rejects.toBeInstanceOf(InvalidPasswordResetTokenError);
  });

  it("marks an unverified email verified, since the link reached the inbox", async () => {
    await createUser({ role: "ORG_ADMIN", emailVerified: null });
    const token = await requestResetToken();
    vi.setSystemTime(new Date("2026-09-29T14:10:00Z"));

    await reset(token);

    await expect(readEmailVerified()).resolves.toEqual(new Date("2026-09-29T14:10:00Z"));
  });

  it("keeps the original time of an already verified email", async () => {
    await createUser({ emailVerified: new Date("2026-09-01T09:00:00Z") });
    const token = await requestResetToken();

    await reset(token);

    await expect(readEmailVerified()).resolves.toEqual(new Date("2026-09-01T09:00:00Z"));
  });

  it("rejects an email verification token", async () => {
    const sender = recordingSender();
    await signUpOrganization(
      {
        organizationName: "Springfield Elementary",
        institutionType: "SCHOOL",
        orgAdminEmail: EMAIL,
        orgAdminPassword: OLD_PASSWORD,
      },
      sender,
    );
    const verificationToken = readToken(sender.sent[0]);

    await expect(reset(verificationToken)).rejects.toBeInstanceOf(InvalidPasswordResetTokenError);
  });
});
