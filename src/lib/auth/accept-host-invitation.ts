import { and, eq, isNull } from "drizzle-orm";

import { redeemEmailLinkToken } from "@/lib/auth/email-link-token";
import { hashPassword } from "@/lib/auth/password";
import { db } from "@/lib/db/client";
import { hostInvitationTokens, users } from "@/lib/db/schema";

export type AcceptHostInvitationInput = {
  token: string;
  // Already checked against the password rule by the caller.
  password: string;
};

// One error for unknown, used and expired invitations: the person's next step
// is the same (ask the org-admin to invite them again), and the message
// reveals nothing about which tokens exist.
export class InvalidHostInvitationTokenError extends Error {
  constructor() {
    super("The host invitation token is invalid or has expired.");
    this.name = "InvalidHostInvitationTokenError";
  }
}

// Sets the first password of the host an invitation was sent to
// (src/lib/groups/invite-host.ts). It doesn't sign them in: login stays the
// one place that checks email verification and Organization approval.
export async function acceptHostInvitation(input: AcceptHostInvitationInput): Promise<void> {
  // Hashed before the transaction, so bcrypt's deliberate slowness doesn't
  // hold the transaction open.
  const hashedPassword = await hashPassword(input.password);
  const now = new Date();

  await db.transaction(async (tx) => {
    const userId = await redeemEmailLinkToken(tx, hostInvitationTokens, input.token, now);
    if (!userId) {
      throw new InvalidHostInvitationTokenError();
    }

    // Only while no password is set: once the host has one (say, set through
    // a password reset), an old invitation link must not replace it.
    // Opening the link proves the host controls the inbox, which is what
    // email verification proves (ADR-0004).
    const accepted = await tx
      .update(users)
      .set({ hashedPassword, emailVerified: now })
      .where(and(eq(users.id, userId), isNull(users.hashedPassword)))
      .returning({ id: users.id });
    if (accepted.length === 0) {
      throw new InvalidHostInvitationTokenError();
    }
  });
}
