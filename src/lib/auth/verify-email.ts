import { and, eq, isNull } from "drizzle-orm";

import { redeemEmailLinkToken } from "@/lib/auth/email-link-token";
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
// (ADR-0004). The token is single-use, and redeeming it invalidates the User's
// other verification tokens, which have nothing left to prove.
export async function verifyEmail({ token }: VerifyEmailInput): Promise<void> {
  const now = new Date();
  await db.transaction(async (tx) => {
    const userId = await redeemEmailLinkToken(tx, emailVerificationTokens, token, now);
    if (!userId) {
      throw new InvalidVerificationTokenError();
    }

    // Conditional, so verifying again never moves the original timestamp.
    await tx
      .update(users)
      .set({ emailVerified: now })
      .where(and(eq(users.id, userId), isNull(users.emailVerified)));
  });
}
