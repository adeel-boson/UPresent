import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { testDb } = await vi.hoisted(async () => {
  const { createTestDatabase } = await import("@/lib/db/testing");
  return { testDb: await createTestDatabase() };
});

vi.mock("@/lib/db/client", () => ({ db: testDb }));

import { hashPassword } from "@/lib/auth/password";
import type { RequestContext } from "@/lib/auth/request-context";
import { requestPasswordReset } from "@/lib/auth/request-password-reset";
import { users } from "@/lib/db/schema";
import { resetTestDatabase } from "@/lib/db/testing";
import type { Email } from "@/lib/email/email-sender";

const REQUEST_CONTEXT: RequestContext = {
  browser: "Chrome 131",
  os: "Windows",
  device: "desktop",
  ip: "203.0.113.7",
  time: new Date("2026-09-29T14:05:00Z"),
};

async function createUser(email: string): Promise<void> {
  await testDb.insert(users).values({
    email,
    hashedPassword: await hashPassword("old password 123"),
    role: "SUPER_ADMIN",
  });
}

async function requestReset(email: string): Promise<Email[]> {
  const sent: Email[] = [];
  await requestPasswordReset(
    { email, requestContext: REQUEST_CONTEXT },
    { send: async (message) => void sent.push(message) },
  );
  return sent;
}

describe("requestPasswordReset", () => {
  beforeEach(async () => {
    vi.stubEnv("APP_URL", "https://upresent.example");
    await resetTestDatabase(testDb);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("emails the user a reset link with where the request came from", async () => {
    await createUser("super-admin@upresent.example");

    const sent = await requestReset("super-admin@upresent.example");

    expect(sent).toHaveLength(1);
    const [email] = sent;
    expect(email?.to).toBe("super-admin@upresent.example");
    expect(email?.text).toMatch(/https:\/\/upresent\.example\/reset-password\?token=[\w-]+/);
    expect(email?.text).toContain("works once and expires in 1 hour");
    expect(email?.text).toContain(
      "Requested from: Chrome 131 on Windows (desktop) · IP 203.0.113.7 · 29 Sep 2026, 14:05 UTC",
    );
  });

  it("matches the email case-insensitively", async () => {
    await createUser("super-admin@upresent.example");

    const sent = await requestReset("  Super-Admin@UPresent.example ");

    expect(sent.map((email) => email.to)).toEqual(["super-admin@upresent.example"]);
  });

  it("sends nothing for an email with no account", async () => {
    await createUser("super-admin@upresent.example");

    await expect(requestReset("nobody@upresent.example")).resolves.toEqual([]);
  });

  it("sends a different link for each request", async () => {
    await createUser("super-admin@upresent.example");

    const [first] = await requestReset("super-admin@upresent.example");
    const [second] = await requestReset("super-admin@upresent.example");

    const linkIn = (email: Email | undefined) => email?.text.match(/https:\/\/\S+/)?.[0];
    expect(linkIn(first)).toBeDefined();
    expect(linkIn(first)).not.toBe(linkIn(second));
  });
});
