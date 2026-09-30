import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { testDb } = await vi.hoisted(async () => {
  const { createTestDatabase } = await import("@/lib/db/testing");
  return { testDb: await createTestDatabase() };
});

vi.mock("@/lib/db/client", () => ({ db: testDb }));

import { InvalidVerificationTokenError, verifyEmail } from "@/lib/auth/verify-email";
import { users } from "@/lib/db/schema";
import { resetTestDatabase } from "@/lib/db/testing";
import type { Email } from "@/lib/email/email-sender";
import { signUpOrganization } from "@/lib/organizations/signup";

const SIGNED_UP_AT = new Date("2026-09-01T09:00:00Z");

// Signs up an org-admin and returns the token from the link they were emailed.
async function signUpAndReadToken(): Promise<string> {
  const sent: Email[] = [];
  await signUpOrganization(
    {
      organizationName: "Springfield Elementary",
      institutionType: "SCHOOL",
      orgAdminEmail: "admin@springfield.example",
      orgAdminPassword: "correct horse battery staple",
    },
    { send: async (email) => void sent.push(email) },
  );
  const link = sent[0]?.text.match(/https:\/\/\S+/)?.[0];
  const token = link ? new URL(link).searchParams.get("token") : null;
  if (!token) {
    throw new Error("Signup sent no verification link.");
  }
  return token;
}

async function readEmailVerified(): Promise<Date | null | undefined> {
  const [orgAdmin] = await testDb.select({ emailVerified: users.emailVerified }).from(users);
  return orgAdmin?.emailVerified;
}

describe("verifyEmail", () => {
  beforeEach(async () => {
    // Only Date is faked, so PGlite's own timers keep running.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(SIGNED_UP_AT);
    vi.stubEnv("APP_URL", "https://upresent.example");
    await resetTestDatabase(testDb);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("marks the org-admin's email verified", async () => {
    const token = await signUpAndReadToken();
    vi.setSystemTime(new Date("2026-09-01T10:30:00Z"));

    await verifyEmail({ token });

    await expect(readEmailVerified()).resolves.toEqual(new Date("2026-09-01T10:30:00Z"));
  });

  it("rejects a token that was never issued", async () => {
    await signUpAndReadToken();

    await expect(verifyEmail({ token: "not-a-real-token" })).rejects.toBeInstanceOf(
      InvalidVerificationTokenError,
    );
    await expect(readEmailVerified()).resolves.toBeNull();
  });

  it("rejects a token that was already used", async () => {
    const token = await signUpAndReadToken();
    await verifyEmail({ token });

    await expect(verifyEmail({ token })).rejects.toBeInstanceOf(InvalidVerificationTokenError);
  });

  it("rejects a token more than 24 hours old", async () => {
    const token = await signUpAndReadToken();
    vi.setSystemTime(new Date("2026-09-02T09:00:01Z"));

    await expect(verifyEmail({ token })).rejects.toBeInstanceOf(InvalidVerificationTokenError);
    await expect(readEmailVerified()).resolves.toBeNull();
  });

  it("accepts a token just under 24 hours old", async () => {
    const token = await signUpAndReadToken();
    vi.setSystemTime(new Date("2026-09-02T08:59:59Z"));

    await verifyEmail({ token });

    await expect(readEmailVerified()).resolves.toEqual(new Date("2026-09-02T08:59:59Z"));
  });
});
