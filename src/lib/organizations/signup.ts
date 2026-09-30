import { eq } from "drizzle-orm";

import { issueVerificationEmail } from "@/lib/auth/email-verification";
import { hashPassword } from "@/lib/auth/password";
import { db } from "@/lib/db/client";
import { isUniqueViolation } from "@/lib/db/errors";
import {
  organizations,
  USER_EMAIL_UNIQUE_INDEX,
  users,
  type InstitutionType,
} from "@/lib/db/schema";
import { generateSchemaName } from "@/lib/db/schema-name";
import { emailSender, type Email, type EmailSender } from "@/lib/email/email-sender";

export type SignUpOrganizationInput = {
  organizationName: string;
  institutionType: InstitutionType;
  orgAdminEmail: string;
  orgAdminPassword: string;
};

// Creates a pending Organization plus its org-admin User, and emails the
// org-admin a verification link (ADR-0004). No tenant schema is provisioned
// here — that only happens on super-admin approval, see ADR-0007.
//
// If the email already has an account, nothing is created and its owner is
// emailed instead. Either way this resolves the same, so the signup form
// can't be used to find out which emails have accounts.
export async function signUpOrganization(
  input: SignUpOrganizationInput,
  sender: EmailSender = emailSender,
): Promise<void> {
  // Emails are stored lowercase so login can match them case-insensitively.
  const orgAdminEmail = input.orgAdminEmail.trim().toLowerCase();
  const hashedPassword = await hashPassword(input.orgAdminPassword);

  let isAlreadyRegistered: boolean;
  try {
    isAlreadyRegistered = await db.transaction(async (tx) => {
      const existingUser = await tx.query.users.findFirst({
        where: eq(users.email, orgAdminEmail),
        columns: { id: true },
      });
      if (existingUser) {
        return true;
      }

      const [organization] = await tx
        .insert(organizations)
        .values({
          name: input.organizationName,
          institutionType: input.institutionType,
          schemaName: generateSchemaName(),
        })
        .returning({ id: organizations.id });
      if (!organization) {
        throw new Error("Inserting the Organization returned no row.");
      }

      const [orgAdmin] = await tx
        .insert(users)
        .values({
          email: orgAdminEmail,
          hashedPassword,
          role: "ORG_ADMIN",
          organizationId: organization.id,
        })
        .returning({ id: users.id, email: users.email });
      if (!orgAdmin) {
        throw new Error("Inserting the org-admin User returned no row.");
      }

      // Sent inside the transaction, so a failed send rolls the signup back
      // and the person can simply sign up again, instead of being left with
      // an account they can never verify. If the commit itself fails after
      // sending, the emailed link just finds no token.
      await sender.send(await issueVerificationEmail(tx, orgAdmin));
      return false;
    });
  } catch (error) {
    // The check above runs under READ COMMITTED, so two concurrent signups
    // with one email can both pass it; the unique index on User.email then
    // rejects the second insert.
    if (!isUniqueViolation(error, USER_EMAIL_UNIQUE_INDEX)) {
      throw error;
    }
    isAlreadyRegistered = true;
  }

  if (isAlreadyRegistered) {
    await sender.send(alreadyRegisteredEmail(orgAdminEmail));
  }
}

// Tells the owner of an existing account that someone used their email to
// sign up, without saying anything the form's visitor could learn.
function alreadyRegisteredEmail(to: string): Email {
  return {
    to,
    subject: "Someone tried to sign up with your email",
    text: [
      "Someone just tried to sign up an organization on UPresent with this email address,",
      "but it already has an account, so nothing was created.",
      "",
      "If that was you, log in with your existing account instead.",
      "If it wasn't, you can ignore this email; your account hasn't changed.",
    ].join("\n"),
  };
}
