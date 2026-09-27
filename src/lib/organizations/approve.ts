import { and, eq, sql } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { organizations, type Role } from "@/lib/db/schema";
import { schemaProvisioner, type SchemaProvisioner } from "@/lib/organizations/schema-provisioner";

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

// Bounds each statement of the approval, including the wait for another
// approval's lock, so a hung provisioning run fails the request instead of
// holding it (and a connection) open until the platform kills it.
export const APPROVAL_STATEMENT_TIMEOUT_MS = 60_000;

// Approval synchronously provisions the Organization's dedicated Postgres
// schema before flipping its status — see ADR-0007. The provisioner is
// injectable so this can be tested with a provisioner that fails.
export async function approveOrganization(
  { organizationId, approver }: ApproveOrganizationInput,
  provisioner: SchemaProvisioner = schemaProvisioner,
): Promise<void> {
  // Approval is irreversible, so the role is re-checked here rather than
  // trusting the caller's guard (CODING_STANDARDS.md §10).
  if (approver.role !== "SUPER_ADMIN") {
    throw new ApprovalNotPermittedError(approver.role);
  }

  const provisioningError = await db.transaction(async (tx) => {
    // Transaction-scoped (the `true`), so it can't leak to the next user of
    // this pooled connection.
    await tx.execute(
      sql`SELECT set_config('statement_timeout', ${String(APPROVAL_STATEMENT_TIMEOUT_MS)}, true)`,
    );

    // Serializes approvals of the same Organization for the whole
    // provision-then-approve sequence. Without it, a second approval could
    // drop the schema (after its own failed provisioning) while the first
    // one is migrating it, or right after the first one approved it. A
    // transaction-scoped lock is used rather than a session lock because the
    // pool (and PgBouncer in transaction mode) doesn't guarantee two
    // statements share a session, and it is released automatically on
    // commit, rollback, or a dropped connection. A waiting approval then
    // re-reads the status below and finds it already approved.
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${organizationId}, 0))`);

    const organization = await tx.query.organizations.findFirst({
      where: eq(organizations.id, organizationId),
    });
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
    const approved = await tx
      .update(organizations)
      .set({ status: "APPROVED", approvedAt: new Date() })
      .where(and(eq(organizations.id, organizationId), eq(organizations.status, "PENDING")))
      .returning({ id: organizations.id });
    if (approved.length === 0) {
      throw new OrganizationNotPendingError(organizationId);
    }
    return null;
  });

  if (provisioningError !== null) {
    throw provisioningError;
  }
}
