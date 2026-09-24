import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    organization: {
      findUnique: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}));

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
  });

  it("provisions the tenant schema and marks the organization approved", async () => {
    mockPrisma.organization.findUnique.mockResolvedValue(pendingOrganization);

    await approveOrganization({ organizationId: "org-1", approver: superAdmin }, fakeProvisioner);

    expect(fakeProvisioner.provision).toHaveBeenCalledWith("org_abc123");
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
