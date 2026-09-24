import type { Role } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import {
  prismaSchemaProvisioner,
  type SchemaProvisioner,
} from "@/lib/organizations/schema-provisioner";

export type ApproveOrganizationInput = {
  organizationId: string;
  approver: { role: Role };
};

export class ApprovalNotPermittedError extends Error {
  constructor(role: Role) {
    super(`A ${role} cannot approve Organizations.`);
    this.name = "ApprovalNotPermittedError";
  }
}

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
  { organizationId, approver }: ApproveOrganizationInput,
  provisioner: SchemaProvisioner = prismaSchemaProvisioner,
): Promise<void> {
  // Approval is irreversible, so the role is re-checked here rather than
  // trusting the caller's guard (CODING_STANDARDS.md §10).
  if (approver.role !== "SUPER_ADMIN") {
    throw new ApprovalNotPermittedError(approver.role);
  }

  const organization = await prisma.organization.findUnique({ where: { id: organizationId } });
  if (!organization) {
    throw new OrganizationNotFoundError(organizationId);
  }
  if (organization.status !== "PENDING") {
    throw new OrganizationNotPendingError(organizationId);
  }

  // Provisioning is idempotent, so a retry after a failed status update, or
  // a concurrent approval, is safe to repeat.
  await provisioner.provision(organization.schemaName);

  // Conditional on PENDING so, of two concurrent approvals, only one flips
  // the status and the other reports the Organization as no longer pending.
  const { count } = await prisma.organization.updateMany({
    where: { id: organizationId, status: "PENDING" },
    data: { status: "APPROVED", approvedAt: new Date() },
  });
  if (count === 0) {
    throw new OrganizationNotPendingError(organizationId);
  }
}
