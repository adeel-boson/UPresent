import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    organization: { findMany: vi.fn() },
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

import { listPendingOrganizations } from "@/lib/organizations/list-pending";

describe("listPendingOrganizations", () => {
  beforeEach(() => vi.clearAllMocks());

  it("queries pending organizations oldest first, selecting only the org-admin's email", async () => {
    mockPrisma.organization.findMany.mockResolvedValue([]);

    await listPendingOrganizations();

    expect(mockPrisma.organization.findMany).toHaveBeenCalledWith({
      where: { status: "PENDING" },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        name: true,
        institutionType: true,
        users: { where: { role: "ORG_ADMIN" }, select: { email: true }, take: 1 },
      },
    });
  });

  it("flattens the org-admin's email onto each organization", async () => {
    mockPrisma.organization.findMany.mockResolvedValue([
      {
        id: "org-1",
        name: "Springfield Elementary",
        institutionType: "SCHOOL",
        users: [{ email: "admin@springfield.example" }],
      },
      { id: "org-2", name: "Shelbyville College", institutionType: "COLLEGE", users: [] },
    ]);

    await expect(listPendingOrganizations()).resolves.toEqual([
      {
        id: "org-1",
        name: "Springfield Elementary",
        institutionType: "SCHOOL",
        orgAdminEmail: "admin@springfield.example",
      },
      { id: "org-2", name: "Shelbyville College", institutionType: "COLLEGE", orgAdminEmail: null },
    ]);
  });
});
