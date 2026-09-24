import { prisma } from "@/lib/prisma";
import {
  prismaSchemaProvisioner,
  type SchemaProvisioner,
} from "@/lib/organizations/schema-provisioner";

export class OrganizationNotFoundError extends Error {
  constructor(organizationId: string) {
    super(`Organization ${organizationId} not found.`);
    this.name = "OrganizationNotFoundError";
  }
}

export class OrganizationNotPendingError extends Error {
  constructor(organizationId: string) {
    super(`Organization ${organizationId} is not pending approval.`);
    this.name = "OrganizationNotPendingError";
  }
}

// Approval synchronously provisions the Organization's dedicated Postgres
// schema before flipping its status — see ADR-0007. The provisioner is
// injectable so this can be tested without shelling out to `prisma migrate
// deploy`.
export async function approveOrganization(
  organizationId: string,
  provisioner: SchemaProvisioner = prismaSchemaProvisioner,
): Promise<void> {
  const organization = await prisma.organization.findUnique({ where: { id: organizationId } });
  if (!organization) {
    throw new OrganizationNotFoundError(organizationId);
  }
  if (organization.status !== "PENDING") {
    throw new OrganizationNotPendingError(organizationId);
  }

  await provisioner.provision(organization.schemaName);

  await prisma.organization.update({
    where: { id: organizationId },
    data: { status: "APPROVED", approvedAt: new Date() },
  });
}
