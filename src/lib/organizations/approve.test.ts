import { eq, sql } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { testDb } = await vi.hoisted(async () => {
  const { createTestDatabase } = await import("@/lib/db/testing");
  return { testDb: await createTestDatabase() };
});

vi.mock("@/lib/db/client", () => ({ db: testDb }));

import type { MigratableDatabase } from "@/lib/db/migrate";
import { organizations } from "@/lib/db/schema";
import { resetTestDatabase, schemaExists } from "@/lib/db/testing";
import {
  ApprovalNotPermittedError,
  approveOrganization,
  OrganizationNotFoundError,
  OrganizationNotPendingError,
} from "@/lib/organizations/approve";
import type { SchemaProvisioner } from "@/lib/organizations/schema-provisioner";

const SCHEMA_NAME = "org_0123456789abcdef0123456789abcdef";

const superAdmin = { role: "SUPER_ADMIN" } as const;

type Provision = SchemaProvisioner["provision"];

async function readOrganization() {
  return testDb.query.organizations.findFirst({ where: eq(organizations.id, "org-1") });
}

// True while the caller's transaction holds approval's advisory lock for the
// Organization (a bigint key, which pg_locks splits into classid/objid).
async function holdsApprovalLock(tx: MigratableDatabase, organizationId: string) {
  const result = await tx.execute(sql`
    SELECT EXISTS (
      SELECT 1 FROM pg_locks
      WHERE locktype = 'advisory' AND granted AND objsubid = 1
        AND (classid::bigint << 32 | objid::bigint) = hashtextextended(${organizationId}, 0)
    ) AS "held"
  `);
  // The driver-generic database types `execute`'s result as unknown; PGlite
  // (like pg) returns `{ rows }`.
  return (result as unknown as { rows: { held: boolean }[] }).rows[0]?.held;
}

describe("approveOrganization", () => {
  let fakeProvisioner: SchemaProvisioner & { provision: ReturnType<typeof vi.fn<Provision>> };

  beforeEach(async () => {
    await resetTestDatabase(testDb);
    await testDb.insert(organizations).values({
      id: "org-1",
      name: "Springfield Elementary",
      institutionType: "SCHOOL",
      schemaName: SCHEMA_NAME,
    });
    fakeProvisioner = { provision: vi.fn<Provision>().mockResolvedValue(undefined) };
  });

  it("provisions the tenant schema and marks the organization approved", async () => {
    await approveOrganization({ organizationId: "org-1", approver: superAdmin }, fakeProvisioner);

    expect(fakeProvisioner.provision).toHaveBeenCalledExactlyOnceWith(
      SCHEMA_NAME,
      expect.anything(),
    );
    await expect(readOrganization()).resolves.toMatchObject({
      status: "APPROVED",
      approvedAt: expect.any(Date),
    });
  });

  it("provisions before updating status", async () => {
    let statusDuringProvisioning: string | undefined;
    fakeProvisioner.provision.mockImplementation(async (_schemaName, tx) => {
      const [organization] = await tx
        .select({ status: organizations.status })
        .from(organizations)
        .where(eq(organizations.id, "org-1"));
      statusDuringProvisioning = organization?.status;
    });

    await approveOrganization({ organizationId: "org-1", approver: superAdmin }, fakeProvisioner);

    expect(statusDuringProvisioning).toBe("PENDING");
  });

  it("locks the organization before reading its status, so concurrent approvals run one at a time", async () => {
    let isLockHeldDuringProvisioning: boolean | undefined;
    fakeProvisioner.provision.mockImplementation(async (_schemaName, tx) => {
      isLockHeldDuringProvisioning = await holdsApprovalLock(tx, "org-1");
    });

    await approveOrganization({ organizationId: "org-1", approver: superAdmin }, fakeProvisioner);

    expect(isLockHeldDuringProvisioning).toBe(true);
    // Transaction-scoped: released once approval commits.
    await expect(holdsApprovalLock(testDb, "org-1")).resolves.toBe(false);
  });

  it("commits the provisioner's cleanup, then rethrows, when provisioning fails", async () => {
    // Stands in for the real provisioner's DROP SCHEMA: a write made through
    // the approval transaction after provisioning failed.
    fakeProvisioner.provision.mockImplementation(async (schemaName, tx) => {
      await tx.execute(sql`CREATE SCHEMA ${sql.identifier(schemaName)}`);
      throw new Error("tenant migration failed");
    });

    await expect(
      approveOrganization({ organizationId: "org-1", approver: superAdmin }, fakeProvisioner),
    ).rejects.toThrow("tenant migration failed");
    // A rolled-back transaction would have undone it.
    await expect(schemaExists(testDb, SCHEMA_NAME)).resolves.toBe(true);
  });

  it("leaves the organization pending when provisioning fails", async () => {
    fakeProvisioner.provision.mockRejectedValue(new Error("tenant migration failed"));

    await expect(
      approveOrganization({ organizationId: "org-1", approver: superAdmin }, fakeProvisioner),
    ).rejects.toThrow("tenant migration failed");
    await expect(readOrganization()).resolves.toMatchObject({
      status: "PENDING",
      approvedAt: null,
    });
  });

  it("throws when the approver is not a super-admin", async () => {
    await expect(
      approveOrganization(
        { organizationId: "org-1", approver: { role: "ORG_ADMIN" } },
        fakeProvisioner,
      ),
    ).rejects.toBeInstanceOf(ApprovalNotPermittedError);
    expect(fakeProvisioner.provision).not.toHaveBeenCalled();
    await expect(readOrganization()).resolves.toMatchObject({ status: "PENDING" });
  });

  it("throws when the organization does not exist", async () => {
    await expect(
      approveOrganization({ organizationId: "missing", approver: superAdmin }, fakeProvisioner),
    ).rejects.toBeInstanceOf(OrganizationNotFoundError);
    expect(fakeProvisioner.provision).not.toHaveBeenCalled();
  });

  it("throws when the organization is already approved", async () => {
    await testDb
      .update(organizations)
      .set({ status: "APPROVED" })
      .where(eq(organizations.id, "org-1"));

    await expect(
      approveOrganization({ organizationId: "org-1", approver: superAdmin }, fakeProvisioner),
    ).rejects.toBeInstanceOf(OrganizationNotPendingError);
    expect(fakeProvisioner.provision).not.toHaveBeenCalled();
  });

  it("throws when a concurrent approval flipped the status first", async () => {
    // Stands in for another approval committing between this one's status
    // read and its conditional update.
    fakeProvisioner.provision.mockImplementation(async (_schemaName, tx) => {
      await tx
        .update(organizations)
        .set({ status: "APPROVED" })
        .where(eq(organizations.id, "org-1"));
    });

    await expect(
      approveOrganization({ organizationId: "org-1", approver: superAdmin }, fakeProvisioner),
    ).rejects.toBeInstanceOf(OrganizationNotPendingError);
  });
});
