import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    user: { findUnique: vi.fn() },
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

import { authenticateUser } from "@/lib/auth/authenticate";
import { hashPassword } from "@/lib/auth/password";

const PASSWORD = "correct horse battery staple";

describe("authenticateUser", () => {
  let hashedPassword: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    hashedPassword ??= await hashPassword(PASSWORD);
  });

  function userRow(organization: { status: "PENDING" | "APPROVED" } | null) {
    return {
      id: "user-1",
      email: "admin@springfield.example",
      role: organization ? "ORG_ADMIN" : "SUPER_ADMIN",
      hashedPassword,
      organization,
    };
  }

  it("signs in a super-admin, who belongs to no organization", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(userRow(null));

    await expect(
      authenticateUser({ email: "admin@springfield.example", password: PASSWORD }),
    ).resolves.toEqual({ id: "user-1", email: "admin@springfield.example", role: "SUPER_ADMIN" });
  });

  it("signs in an org-admin whose organization is approved", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(userRow({ status: "APPROVED" }));

    await expect(
      authenticateUser({ email: "admin@springfield.example", password: PASSWORD }),
    ).resolves.toMatchObject({ role: "ORG_ADMIN" });
  });

  it("rejects an org-admin whose organization is still pending", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(userRow({ status: "PENDING" }));

    await expect(
      authenticateUser({ email: "admin@springfield.example", password: PASSWORD }),
    ).resolves.toBeNull();
  });

  it("rejects a wrong password", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(userRow(null));

    await expect(
      authenticateUser({ email: "admin@springfield.example", password: "wrong password" }),
    ).resolves.toBeNull();
  });

  it("rejects an unknown email", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);

    await expect(
      authenticateUser({ email: "nobody@springfield.example", password: PASSWORD }),
    ).resolves.toBeNull();
  });

  it("looks the email up case-insensitively", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(userRow(null));

    await authenticateUser({ email: "  Admin@Springfield.Example ", password: PASSWORD });

    expect(mockPrisma.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { email: "admin@springfield.example" } }),
    );
  });
});
