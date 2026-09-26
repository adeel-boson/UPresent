import type { Role } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import {
  MIGRATE_TIMEOUT_MS,
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

// A waiting approval sits behind at most one other provisioning run, then
// runs its own, so the transaction must outlive two migration timeouts.
const APPROVAL_TRANSACTION_TIMEOUT_MS = 2 * MIGRATE_TIMEOUT_MS + 15_000;

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

  const provisioningError = await prisma.$transaction(
    async (tx) => {
      // Serializes approvals of the same Organization for the whole
      // provision-then-approve sequence. Without it, a second approval could
      // drop the schema (after its own failed migrate) while the first one is
      // migrating it, or right after the first one approved it. A
      // transaction-scoped lock is used rather than a session lock because
      // Prisma's pool (and PgBouncer in transaction mode) doesn't guarantee
      // two statements share a session, and it is released automatically on
      // commit, rollback, or a dropped connection. A waiting approval then
      // re-reads the status below and finds it already approved.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${organizationId}, 0))`;

      const organization = await tx.organization.findUnique({ where: { id: organizationId } });
      if (!organization) {
        throw new OrganizationNotFoundError(organizationId);
      }
      if (organization.status !== "PENDING") {
        throw new OrganizationNotPendingError(organizationId);
      }

      try {
        await provisioner.provision(organization.schemaName, tx);
      } catch (error) {
        // Returned, not thrown: the provisioner drops a half-migrated schema
        // through `tx` on failure, and throwing here would roll that back.
        return error;
      }

      // Conditional on PENDING as a second line of defense: of two
      // approvals that somehow both got here, only one flips the status.
      const { count } = await tx.organization.updateMany({
        where: { id: organizationId, status: "PENDING" },
        data: { status: "APPROVED", approvedAt: new Date() },
      });
      if (count === 0) {
        throw new OrganizationNotPendingError(organizationId);
      }
      return null;
    },
    { timeout: APPROVAL_TRANSACTION_TIMEOUT_MS },
  );

  if (provisioningError !== null) {
    throw provisioningError;
  }
}
