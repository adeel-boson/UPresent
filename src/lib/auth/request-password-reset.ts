import { eq } from "drizzle-orm";

import { buildEmailLink, createEmailLinkToken } from "@/lib/auth/email-link-token";
import { formatRequestContext, type RequestContext } from "@/lib/auth/request-context";
import { db } from "@/lib/db/client";
import { passwordResetTokens, users } from "@/lib/db/schema";
import { emailSender, type EmailSender } from "@/lib/email/email-sender";

// Short, because the link alone is enough to take over the account: it only
// has to survive the few minutes between asking for it and opening it.
export const PASSWORD_RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

export type RequestPasswordResetInput = {
  email: string;
  // Only put in the email, never stored or logged.
  requestContext: RequestContext;
};

// Emails the User with this email a single-use link to set a new password,
// whatever their role or Organization status. Earlier links stay valid until
// one is used. For an email with no account nothing is sent, and this resolves
// the same, so the form can't be used to find out which emails have accounts.
export async function requestPasswordReset(
  input: RequestPasswordResetInput,
  sender: EmailSender = emailSender,
): Promise<void> {
  const email = input.email.trim().toLowerCase();

  await db.transaction(async (tx) => {
    const user = await tx.query.users.findFirst({
      where: eq(users.email, email),
      columns: { id: true, email: true },
    });
    if (!user) {
      return;
    }

    const { token, tokenHash } = createEmailLinkToken();
    await tx.insert(passwordResetTokens).values({
      tokenHash,
      userId: user.id,
      expiresAt: new Date(Date.now() + PASSWORD_RESET_TOKEN_TTL_MS),
    });

    // Sent inside the transaction, so a failed send doesn't leave behind a
    // token nobody received.
    await sender.send({
      to: user.email,
      subject: "Reset your UPresent password",
      text: [
        "Someone asked to reset the password for your UPresent account.",
        "Open the link below to set a new password:",
        "",
        buildEmailLink("/reset-password", token),
        "",
        "The link works once and expires in 1 hour.",
        `Requested from: ${formatRequestContext(input.requestContext)}`,
        "",
        "If you didn't ask for this, you can ignore this email; your password hasn't changed.",
      ].join("\n"),
    });
  });
}
