import { and, eq, isNull } from "drizzle-orm";

import { hashVerificationToken } from "@/lib/auth/email-verification";
import { db } from "@/lib/db/client";
import { emailVerificationTokens, users } from "@/lib/db/schema";

export type VerifyEmailInput = {
  token: string;
};

// One error for unknown, used and expired tokens: the person's next step is
// the same, and the message reveals nothing about which tokens exist.
export class InvalidVerificationTokenError extends Error {
  constructor() {
    super("The email verification token is invalid or has expired.");
    this.name = "InvalidVerificationTokenError";
  }
}

// Marks the email of the User a verification token was issued to as verified
// (ADR-0004). Tokens are single-use: deleting the row and reading it back in
// one statement means two concurrent uses can't both succeed.
export async function verifyEmail({ token }: VerifyEmailInput): Promise<void> {
  const now = new Date();
  await db.transaction(async (tx) => {
    const [used] = await tx
      .delete(emailVerificationTokens)
      .where(eq(emailVerificationTokens.tokenHash, hashVerificationToken(token)))
      .returning({
        userId: emailVerificationTokens.userId,
        expiresAt: emailVerificationTokens.expiresAt,
      });
    if (!used || used.expiresAt <= now) {
      throw new InvalidVerificationTokenError();
    }

    // Conditional, so verifying again never moves the original timestamp.
    await tx
      .update(users)
      .set({ emailVerified: now })
      .where(and(eq(users.id, used.userId), isNull(users.emailVerified)));
    // The user's other tokens have nothing left to prove.
    await tx.delete(emailVerificationTokens).where(eq(emailVerificationTokens.userId, used.userId));
  });
}
