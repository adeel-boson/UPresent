import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockTx } = vi.hoisted(() => ({
  mockTx: {
    user: { findUnique: vi.fn() },
    organization: { create: vi.fn() },
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: vi.fn(async (callback: (tx: typeof mockTx) => unknown) => callback(mockTx)),
  },
}));

import { prisma } from "@/lib/prisma";
import { EmailAlreadyInUseError, signUpOrganization } from "@/lib/organizations/signup";

describe("signUpOrganization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTx.user.findUnique.mockResolvedValue(null);
    mockTx.organization.create.mockResolvedValue({});
  });

  it("creates a pending organization with a hashed-password admin user", async () => {
    await signUpOrganization({
      organizationName: "Springfield Elementary",
      institutionType: "SCHOOL",
      adminEmail: "admin@springfield.example",
      adminPassword: "correct horse battery staple",
    });

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(mockTx.organization.create).toHaveBeenCalledTimes(1);

    const createArgs = mockTx.organization.create.mock.calls[0][0];
    expect(createArgs.data.name).toBe("Springfield Elementary");
    expect(createArgs.data.institutionType).toBe("SCHOOL");
    expect(createArgs.data.schemaName).toMatch(/^org_[a-f0-9]{32}$/);
    expect(createArgs.data.users.create.email).toBe("admin@springfield.example");
    expect(createArgs.data.users.create.role).toBe("ORG_ADMIN");
    expect(createArgs.data.users.create.hashedPassword).not.toBe("correct horse battery staple");
  });

  it("throws when the admin email is already in use", async () => {
    mockTx.user.findUnique.mockResolvedValue({ id: "existing-user" });

    await expect(
      signUpOrganization({
        organizationName: "Springfield Elementary",
        institutionType: "SCHOOL",
        adminEmail: "admin@springfield.example",
        adminPassword: "correct horse battery staple",
      }),
    ).rejects.toBeInstanceOf(EmailAlreadyInUseError);

    expect(mockTx.organization.create).not.toHaveBeenCalled();
  });
});
