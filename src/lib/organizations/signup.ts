import { eq } from "drizzle-orm";

import { hashPassword } from "@/lib/auth/password";
import { db } from "@/lib/db/client";
import { isUniqueViolation } from "@/lib/db/errors";
import { organizations, users, type InstitutionType } from "@/lib/db/schema";
import { generateSchemaName } from "@/lib/organizations/schema-name";

export type SignUpOrganizationInput = {
  organizationName: string;
  institutionType: InstitutionType;
  orgAdminEmail: string;
  orgAdminPassword: string;
};

export class EmailAlreadyInUseError extends Error {
  constructor(email: string) {
    super(`${email} is already in use.`);
    this.name = "EmailAlreadyInUseError";
  }
}

// Creates a pending Organization plus its org-admin User. No tenant schema is
// provisioned here — that only happens on super-admin approval, see
// ADR-0007.
export async function signUpOrganization(input: SignUpOrganizationInput): Promise<void> {
  // Emails are stored lowercase so login can match them case-insensitively.
  const orgAdminEmail = input.orgAdminEmail.trim().toLowerCase();
  const hashedPassword = await hashPassword(input.orgAdminPassword);

  try {
    await db.transaction(async (tx) => {
      const existingUser = await tx.query.users.findFirst({
        where: eq(users.email, orgAdminEmail),
        columns: { id: true },
      });
      if (existingUser) {
        throw new EmailAlreadyInUseError(orgAdminEmail);
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

      await tx.insert(users).values({
        email: orgAdminEmail,
        hashedPassword,
        role: "ORG_ADMIN",
        organizationId: organization.id,
      });
    });
  } catch (error) {
    // The check above runs under READ COMMITTED, so two concurrent signups
    // with one email can both pass it; the unique index on User.email then
    // rejects the second insert.
    if (isUniqueViolation(error)) {
      throw new EmailAlreadyInUseError(orgAdminEmail);
    }
    throw error;
  }
}
