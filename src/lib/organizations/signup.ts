import { Prisma, type InstitutionType } from "@prisma/client";

import { hashPassword } from "@/lib/auth/password";
import { prisma } from "@/lib/prisma";
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
    await prisma.$transaction(async (tx) => {
      const existingUser = await tx.user.findUnique({ where: { email: orgAdminEmail } });
      if (existingUser) {
        throw new EmailAlreadyInUseError(orgAdminEmail);
      }

      await tx.organization.create({
        data: {
          name: input.organizationName,
          institutionType: input.institutionType,
          schemaName: generateSchemaName(),
          users: {
            create: {
              email: orgAdminEmail,
              hashedPassword,
              role: "ORG_ADMIN",
            },
          },
        },
      });
    });
  } catch (error) {
    // The check above runs under READ COMMITTED, so two concurrent signups
    // with one email can both pass it; the unique index on User.email then
    // rejects the second insert.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new EmailAlreadyInUseError(orgAdminEmail);
    }
    throw error;
  }
}
