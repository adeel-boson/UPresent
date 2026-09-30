import { buildEmailLink, createEmailLinkToken } from "@/lib/auth/email-link-token";
import type { Transaction } from "@/lib/db/client";
import { emailVerificationTokens } from "@/lib/db/schema";
import type { Email } from "@/lib/email/email-sender";

// Long enough to reach an inbox that is checked once a day, short enough that
// an old email lying around stops being useful.
export const VERIFICATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

// Stores a new verification token for the user inside `tx`, and returns the
// email that carries it. The caller sends the email, so it decides whether a
// failed send should undo the rest of its transaction.
export async function issueVerificationEmail(
  tx: Transaction,
  user: { id: string; email: string },
): Promise<Email> {
  const { token, tokenHash } = createEmailLinkToken();
  await tx.insert(emailVerificationTokens).values({
    tokenHash,
    userId: user.id,
    expiresAt: new Date(Date.now() + VERIFICATION_TOKEN_TTL_MS),
  });

  return {
    to: user.email,
    subject: "Verify your email for UPresent",
    text: [
      "Confirm this is your email address by opening the link below:",
      "",
      buildEmailLink("/verify-email", token),
      "",
      "The link works once and expires in 24 hours.",
      "If you didn't sign up for UPresent, you can ignore this email.",
    ].join("\n"),
  };
}
