import { createHash, randomBytes } from "node:crypto";

import type { Transaction } from "@/lib/db/client";
import { emailVerificationTokens } from "@/lib/db/schema";
import type { Email } from "@/lib/email/email-sender";

// Long enough to reach an inbox that is checked once a day, short enough that
// an old email lying around stops being useful.
export const VERIFICATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

// Tokens are 256 random bits, so a plain SHA-256 (no salt, no slow hash) is
// enough to make the stored value useless to someone who reads the table.
export function hashVerificationToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

// The public origin links in emails point at. Taken from configuration, never
// from the request's Host header, which a client could set to send the link
// (and its token) to a host they control.
function readAppUrl(): string {
  const appUrl = process.env.APP_URL;
  if (!appUrl) {
    throw new Error("APP_URL must be set to build links in emails (see .env.example).");
  }
  return appUrl;
}

// Stores a new verification token for the user inside `tx`, and returns the
// email that carries it. The caller sends the email, so it decides whether a
// failed send should undo the rest of its transaction.
export async function issueVerificationEmail(
  tx: Transaction,
  user: { id: string; email: string },
): Promise<Email> {
  const token = randomBytes(32).toString("base64url");
  await tx.insert(emailVerificationTokens).values({
    tokenHash: hashVerificationToken(token),
    userId: user.id,
    expiresAt: new Date(Date.now() + VERIFICATION_TOKEN_TTL_MS),
  });

  const link = new URL("/verify-email", readAppUrl());
  link.searchParams.set("token", token);

  return {
    to: user.email,
    subject: "Verify your email for UPresent",
    text: [
      "Confirm this is your email address by opening the link below:",
      "",
      link.toString(),
      "",
      "The link works once and expires in 24 hours.",
      "If you didn't sign up for UPresent, you can ignore this email.",
    ].join("\n"),
  };
}
