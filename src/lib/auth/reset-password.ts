import { and, eq, isNull } from "drizzle-orm";

import { redeemEmailLinkToken } from "@/lib/auth/email-link-token";
import { hashPassword } from "@/lib/auth/password";
import { formatRequestContext, type RequestContext } from "@/lib/auth/request-context";
import { db } from "@/lib/db/client";
import { passwordResetTokens, users } from "@/lib/db/schema";
import { emailSender, type EmailSender } from "@/lib/email/email-sender";

export type ResetPasswordInput = {
  token: string;
  // Already checked against the password rule by the caller.
  newPassword: string;
  // Only put in the email, never stored or logged.
  requestContext: RequestContext;
};

// One error for unknown, used and expired tokens: the person's next step is
// the same, and the message reveals nothing about which tokens exist.
export class InvalidPasswordResetTokenError extends Error {
  constructor() {
    super("The password reset token is invalid or has expired.");
    this.name = "InvalidPasswordResetTokenError";
  }
}

// Sets a new password for the User a reset token was issued to, and emails
// them that it changed. It doesn't sign them in: login stays the one place
// that checks email verification and Organization approval.
export async function resetPassword(
  input: ResetPasswordInput,
  sender: EmailSender = emailSender,
): Promise<void> {
  // Hashed before the transaction, so bcrypt's deliberate slowness doesn't
  // hold the transaction open.
  const hashedPassword = await hashPassword(input.newPassword);
  const now = new Date();

  await db.transaction(async (tx) => {
    // Single-use, and it invalidates the User's other reset links, any of
    // which could otherwise undo this reset.
    const userId = await redeemEmailLinkToken(tx, passwordResetTokens, input.token, now);
    if (!userId) {
      throw new InvalidPasswordResetTokenError();
    }

    const [user] = await tx
      .update(users)
      .set({ hashedPassword })
      .where(eq(users.id, userId))
      .returning({ email: users.email });
    if (!user) {
      throw new Error(`Resetting the password of User ${userId} updated no row.`);
    }
    // Opening the link proves the User controls the inbox, which is what
    // verification proves. Conditional, so an earlier verification keeps its
    // timestamp.
    await tx
      .update(users)
      .set({ emailVerified: now })
      .where(and(eq(users.id, userId), isNull(users.emailVerified)));

    // Sent inside the transaction: if the owner can't be told their password
    // changed, it doesn't change, and the link still works for a retry.
    await sender.send({
      to: user.email,
      subject: "Your UPresent password was changed",
      text: [
        "The password for your UPresent account was just changed using a reset link.",
        `Changed from: ${formatRequestContext(input.requestContext)}`,
        "",
        "If this was you, there's nothing else to do.",
        "If it wasn't, reset your password again straight away from the login page.",
      ].join("\n"),
    });
  });
}
