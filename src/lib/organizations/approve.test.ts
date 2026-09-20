import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    organization: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}));

import {
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

describe("approveOrganization", () => {
  let fakeProvisioner: SchemaProvisioner;

  beforeEach(() => {
    vi.clearAllMocks();
    fakeProvisioner = { provision: vi.fn().mockResolvedValue(undefined) };
  });

  it("provisions the tenant schema and marks the organization approved", async () => {
    mockPrisma.organization.findUnique.mockResolvedValue(pendingOrganization);

    await approveOrganization("org-1", fakeProvisioner);

    expect(fakeProvisioner.provision).toHaveBeenCalledWith("org_abc123");
    expect(mockPrisma.organization.update).toHaveBeenCalledWith({
      where: { id: "org-1" },
      data: { status: "APPROVED", approvedAt: expect.any(Date) },
    });
  });

  it("provisions before updating status", async () => {
    mockPrisma.organization.findUnique.mockResolvedValue(pendingOrganization);
    const callOrder: string[] = [];
    fakeProvisioner.provision = vi.fn().mockImplementation(async () => {
      callOrder.push("provision");
    });
    mockPrisma.organization.update.mockImplementation(async () => {
      callOrder.push("update");
    });

    await approveOrganization("org-1", fakeProvisioner);

    expect(callOrder).toEqual(["provision", "update"]);
  });

  it("throws when the organization does not exist", async () => {
    mockPrisma.organization.findUnique.mockResolvedValue(null);

    await expect(approveOrganization("missing", fakeProvisioner)).rejects.toBeInstanceOf(
      OrganizationNotFoundError,
    );
    expect(fakeProvisioner.provision).not.toHaveBeenCalled();
  });

  it("throws when the organization is already approved", async () => {
    mockPrisma.organization.findUnique.mockResolvedValue({
      ...pendingOrganization,
      status: "APPROVED",
    });

    await expect(approveOrganization("org-1", fakeProvisioner)).rejects.toBeInstanceOf(
      OrganizationNotPendingError,
    );
    expect(fakeProvisioner.provision).not.toHaveBeenCalled();
  });
});
