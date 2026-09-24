import { Prisma } from "@prisma/client";
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

import { verifyPassword } from "@/lib/auth/password";
import { prisma } from "@/lib/prisma";
import {
  EmailAlreadyInUseError,
  signUpOrganization,
  type SignUpOrganizationInput,
} from "@/lib/organizations/signup";

const signupInput: SignUpOrganizationInput = {
  organizationName: "Springfield Elementary",
  institutionType: "SCHOOL",
  orgAdminEmail: "admin@springfield.example",
  orgAdminPassword: "correct horse battery staple",
};

describe("signUpOrganization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTx.user.findUnique.mockResolvedValue(null);
    mockTx.organization.create.mockResolvedValue({});
  });

  it("creates a pending organization with a hashed-password org-admin user", async () => {
    await signUpOrganization(signupInput);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(mockTx.organization.create).toHaveBeenCalledTimes(1);

    const createArgs = mockTx.organization.create.mock.calls[0]?.[0];
    expect(createArgs.data.name).toBe("Springfield Elementary");
    expect(createArgs.data.institutionType).toBe("SCHOOL");
    expect(createArgs.data.schemaName).toMatch(/^org_[a-f0-9]{32}$/);
    expect(createArgs.data.users.create.email).toBe("admin@springfield.example");
    expect(createArgs.data.users.create.role).toBe("ORG_ADMIN");
    await expect(
      verifyPassword("correct horse battery staple", createArgs.data.users.create.hashedPassword),
    ).resolves.toBe(true);
  });

  it("stores the org-admin email lowercased", async () => {
    await signUpOrganization({ ...signupInput, orgAdminEmail: " Admin@Springfield.Example " });

    const createArgs = mockTx.organization.create.mock.calls[0]?.[0];
    expect(createArgs.data.users.create.email).toBe("admin@springfield.example");
  });

  it("throws when the org-admin email is already in use", async () => {
    mockTx.user.findUnique.mockResolvedValue({ id: "existing-user" });

    await expect(signUpOrganization(signupInput)).rejects.toBeInstanceOf(EmailAlreadyInUseError);

    expect(mockTx.organization.create).not.toHaveBeenCalled();
  });

  it("throws EmailAlreadyInUseError when a concurrent signup wins the unique index", async () => {
    mockTx.organization.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError(
        "Unique constraint failed on the fields: (`email`)",
        {
          code: "P2002",
          clientVersion: "test",
        },
      ),
    );

    await expect(signUpOrganization(signupInput)).rejects.toBeInstanceOf(EmailAlreadyInUseError);
  });
});
