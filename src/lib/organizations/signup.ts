import type { InstitutionType } from "@prisma/client";

import { hashPassword } from "@/lib/auth/password";
import { prisma } from "@/lib/prisma";
import { generateSchemaName } from "@/lib/organizations/schema-name";

export type SignUpOrganizationInput = {
  organizationName: string;
  institutionType: InstitutionType;
  adminEmail: string;
  adminPassword: string;
};

export class EmailAlreadyInUseError extends Error {
  constructor(email: string) {
    super(`${email} is already in use.`);
    this.name = "EmailAlreadyInUseError";
  }
}

// Creates a pending Organization plus its admin User. No tenant schema is
// provisioned here — that only happens on super-admin approval, see
// ADR-0007.
export async function signUpOrganization(input: SignUpOrganizationInput): Promise<void> {
  const hashedPassword = await hashPassword(input.adminPassword);

  await prisma.$transaction(async (tx) => {
    const existingUser = await tx.user.findUnique({ where: { email: input.adminEmail } });
    if (existingUser) {
      throw new EmailAlreadyInUseError(input.adminEmail);
    }

    await tx.organization.create({
      data: {
        name: input.organizationName,
        institutionType: input.institutionType,
        schemaName: generateSchemaName(),
        users: {
          create: {
            email: input.adminEmail,
            hashedPassword,
            role: "ORG_ADMIN",
          },
        },
      },
    });
  });
}
