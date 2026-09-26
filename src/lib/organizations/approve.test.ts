import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma } = vi.hoisted(() => {
  const mockPrisma = {
    organization: {
      findUnique: vi.fn(),
      updateMany: vi.fn(),
    },
    $executeRaw: vi.fn(),
    // Runs the callback against the same mock, standing in for the
    // transaction client. A callback that resolves means the transaction
    // commits; one that rejects means it rolls back.
    $transaction: vi.fn(async (callback: (tx: unknown) => Promise<unknown>) =>
      callback(mockPrisma),
    ),
  };
  return { mockPrisma };
});

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}));

import {
  ApprovalNotPermittedError,
  approveOrganization,
  OrganizationNotFoundError,
  OrganizationNotPendingError,
} from "@/lib/organizations/approve";
import type { SchemaProvisioner } from "@/lib/organizations/schema-provisioner";

const pendingOrganization = {
  id: "org-1",
  name: "Springfield Elementary",
  institutionType: "SCHOOL",
  status: "PENDING",
  schemaName: "org_abc123",
  createdAt: new Date(),
  approvedAt: null,
};

const superAdmin = { role: "SUPER_ADMIN" } as const;

describe("approveOrganization", () => {
  let fakeProvisioner: SchemaProvisioner;

  beforeEach(() => {
    vi.clearAllMocks();
    fakeProvisioner = { provision: vi.fn().mockResolvedValue(undefined) };
    mockPrisma.organization.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.$executeRaw.mockResolvedValue(1);
  });

  it("provisions the tenant schema and marks the organization approved", async () => {
    mockPrisma.organization.findUnique.mockResolvedValue(pendingOrganization);

    await approveOrganization({ organizationId: "org-1", approver: superAdmin }, fakeProvisioner);

    expect(fakeProvisioner.provision).toHaveBeenCalledWith("org_abc123", mockPrisma);
    expect(mockPrisma.organization.updateMany).toHaveBeenCalledWith({
      where: { id: "org-1", status: "PENDING" },
      data: { status: "APPROVED", approvedAt: expect.any(Date) },
    });
  });

  it("provisions before updating status", async () => {
    mockPrisma.organization.findUnique.mockResolvedValue(pendingOrganization);
    const callOrder: string[] = [];
    fakeProvisioner.provision = vi.fn().mockImplementation(async () => {
      callOrder.push("provision");
    });
    mockPrisma.organization.updateMany.mockImplementation(async () => {
      callOrder.push("update");
      return { count: 1 };
    });

    await approveOrganization({ organizationId: "org-1", approver: superAdmin }, fakeProvisioner);

    expect(callOrder).toEqual(["provision", "update"]);
  });

  it("locks the organization before reading its status, so concurrent approvals run one at a time", async () => {
    mockPrisma.organization.findUnique.mockResolvedValue(pendingOrganization);
    const callOrder: string[] = [];
    mockPrisma.$executeRaw.mockImplementation(async (sql: TemplateStringsArray) => {
      callOrder.push(sql.join("?"));
      return 1;
    });
    mockPrisma.organization.findUnique.mockImplementation(async () => {
      callOrder.push("read");
      return pendingOrganization;
    });

    await approveOrganization({ organizationId: "org-1", approver: superAdmin }, fakeProvisioner);

    expect(callOrder[0]).toContain("pg_advisory_xact_lock");
    expect(callOrder[1]).toBe("read");
    expect(mockPrisma.$executeRaw).toHaveBeenCalledWith(expect.anything(), "org-1");
  });

  it("commits the provisioner's cleanup, then rethrows, when provisioning fails", async () => {
    mockPrisma.organization.findUnique.mockResolvedValue(pendingOrganization);
    fakeProvisioner.provision = vi.fn().mockRejectedValue(new Error("migrate deploy failed"));

    await expect(
      approveOrganization({ organizationId: "org-1", approver: superAdmin }, fakeProvisioner),
    ).rejects.toThrow("migrate deploy failed");
    // A rejected transaction callback would roll back the dropped schema.
    await expect(mockPrisma.$transaction.mock.results[0]?.value).resolves.toBeDefined();
  });

  it("leaves the organization pending when provisioning fails", async () => {
    mockPrisma.organization.findUnique.mockResolvedValue(pendingOrganization);
    fakeProvisioner.provision = vi.fn().mockRejectedValue(new Error("migrate deploy failed"));

    await expect(
      approveOrganization({ organizationId: "org-1", approver: superAdmin }, fakeProvisioner),
    ).rejects.toThrow("migrate deploy failed");
    expect(mockPrisma.organization.updateMany).not.toHaveBeenCalled();
  });

  it("throws when the approver is not a super-admin", async () => {
    await expect(
      approveOrganization(
        { organizationId: "org-1", approver: { role: "ORG_ADMIN" } },
        fakeProvisioner,
      ),
    ).rejects.toBeInstanceOf(ApprovalNotPermittedError);
    expect(mockPrisma.organization.findUnique).not.toHaveBeenCalled();
    expect(fakeProvisioner.provision).not.toHaveBeenCalled();
  });

  it("throws when the organization does not exist", async () => {
    mockPrisma.organization.findUnique.mockResolvedValue(null);

    await expect(
      approveOrganization({ organizationId: "missing", approver: superAdmin }, fakeProvisioner),
    ).rejects.toBeInstanceOf(OrganizationNotFoundError);
    expect(fakeProvisioner.provision).not.toHaveBeenCalled();
  });

  it("throws when the organization is already approved", async () => {
    mockPrisma.organization.findUnique.mockResolvedValue({
      ...pendingOrganization,
      status: "APPROVED",
    });

    await expect(
      approveOrganization({ organizationId: "org-1", approver: superAdmin }, fakeProvisioner),
    ).rejects.toBeInstanceOf(OrganizationNotPendingError);
    expect(fakeProvisioner.provision).not.toHaveBeenCalled();
  });

  it("throws when a concurrent approval flipped the status first", async () => {
    mockPrisma.organization.findUnique.mockResolvedValue(pendingOrganization);
    mockPrisma.organization.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      approveOrganization({ organizationId: "org-1", approver: superAdmin }, fakeProvisioner),
    ).rejects.toBeInstanceOf(OrganizationNotPendingError);
  });
});
