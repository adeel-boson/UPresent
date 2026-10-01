import { eq } from "drizzle-orm";

import { buildEmailLink, createEmailLinkToken } from "@/lib/auth/email-link-token";
import { hostInvitationTokens, users } from "@/lib/db/schema";
import { withTenant } from "@/lib/db/tenant";
import { emailSender, type Email, type EmailSender } from "@/lib/email/email-sender";
import { GroupManagementNotPermittedError, GroupNotFoundError } from "@/lib/groups/errors";
import { loadGroupsActor } from "@/lib/groups/load-actor";

// Long enough for an invitation to wait out a weekend or a week of term
// prep, unlike a password reset link, which is used within minutes.
export const HOST_INVITATION_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type InviteHostInput = {
  // The signed-in user; their role and Organization are loaded from it.
  actor: { id: string };
  groupId: string;
  email: string;
};

// The email already has an account that isn't a host of this Organization:
// an org-admin (this Organization's or another's), a super-admin, or a host
// of another Organization. A User belongs to one Organization with one role,
// so it can't be made this Organization's host.
export class HostEmailNotInvitableError extends Error {
  constructor(groupId: string) {
    super(`The invited email for Group ${groupId} belongs to an account that can't host it.`);
    this.name = "HostEmailNotInvitableError";
  }
}

// Invites a host to one of the org-admin's Groups by email, and assigns them
// to it straight away:
// - a new email gets a HOST User with no password, and a link to set one;
// - a host who hasn't accepted yet gets a fresh link (earlier ones keep
//   working until one is used);
// - a host who already has a password is told they were added to the Group.
// The org-admin sees the email in the Group's hosts either way.
export async function inviteHost(
  input: InviteHostInput,
  sender: EmailSender = emailSender,
): Promise<void> {
  const actor = await loadGroupsActor(input.actor.id);
  if (actor?.role !== "ORG_ADMIN") {
    throw new GroupManagementNotPermittedError(input.actor.id);
  }
  const { organization } = actor;
  // Emails are stored lowercase so login can match them case-insensitively.
  const email = input.email.trim().toLowerCase();

  await withTenant(organization, ({ db, tables }) =>
    db.transaction(async (tx) => {
      const [group] = await tx
        .select({ id: tables.groups.id, name: tables.groups.name })
        .from(tables.groups)
        .where(eq(tables.groups.id, input.groupId));
      if (!group) {
        throw new GroupNotFoundError(input.groupId);
      }

      // ON CONFLICT rather than look-then-insert: when two invitations of one
      // new email race, the second waits for the first to commit and then
      // finds its User below, instead of failing on the unique index.
      await tx
        .insert(users)
        .values({ email, role: "HOST", organizationId: organization.id })
        .onConflictDoNothing({ target: users.email });
      const [host] = await tx
        .select({
          id: users.id,
          email: users.email,
          role: users.role,
          organizationId: users.organizationId,
          hashedPassword: users.hashedPassword,
        })
        .from(users)
        .where(eq(users.email, email));
      if (!host) {
        throw new Error("The invited host's User is missing after inserting it.");
      }
      if (host.role !== "HOST" || host.organizationId !== organization.id) {
        throw new HostEmailNotInvitableError(group.id);
      }

      await tx
        .insert(tables.groupHosts)
        .values({ groupId: group.id, hostId: host.id })
        .onConflictDoNothing();

      const invitation = {
        to: host.email,
        organizationName: organization.name,
        groupName: group.name,
      };
      let message: Email;
      if (host.hashedPassword === null) {
        const { token, tokenHash } = createEmailLinkToken();
        await tx.insert(hostInvitationTokens).values({
          tokenHash,
          userId: host.id,
          expiresAt: new Date(Date.now() + HOST_INVITATION_TOKEN_TTL_MS),
        });
        message = invitationEmail({
          ...invitation,
          link: buildEmailLink("/accept-invitation", token),
        });
      } else {
        message = addedToGroupEmail(invitation);
      }

      // Sent inside the transaction, so a failed send leaves no assignment or
      // invitation behind that nobody was told about.
      await sender.send(message);
    }),
  );
}

type InvitationDetails = { to: string; organizationName: string; groupName: string };

function invitationEmail({
  to,
  organizationName,
  groupName,
  link,
}: InvitationDetails & { link: string }): Email {
  return {
    to,
    subject: `You're invited to take attendance at ${organizationName}`,
    text: [
      `${organizationName} has invited you to take attendance for ${groupName} on UPresent.`,
      "Open the link below to set your password:",
      "",
      link,
      "",
      "The link works once and expires in 7 days.",
      "If you weren't expecting this, you can ignore this email.",
    ].join("\n"),
  };
}

function addedToGroupEmail({ to, organizationName, groupName }: InvitationDetails): Email {
  return {
    to,
    subject: `You've been added to ${groupName}`,
    text: [
      `${organizationName} has added you to ${groupName} on UPresent, to take its attendance.`,
      "Log in with your existing password to see it.",
    ].join("\n"),
  };
}
