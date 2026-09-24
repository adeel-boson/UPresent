import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockAuth, mockRedirect } = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  // Mirrors next/navigation: redirect() never returns.
  mockRedirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
}));

vi.mock("@/lib/auth", () => ({ auth: mockAuth }));
vi.mock("next/navigation", () => ({ redirect: mockRedirect }));

import { requireRole, requireUser } from "@/lib/auth/guards";

const superAdmin = { email: "root@upresent.local", role: "SUPER_ADMIN" };
const orgAdmin = { email: "admin@springfield.example", role: "ORG_ADMIN" };

describe("requireUser", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns the signed-in user", async () => {
    mockAuth.mockResolvedValue({ user: orgAdmin });

    await expect(requireUser()).resolves.toEqual(orgAdmin);
  });

  it("redirects to /login when nobody is signed in", async () => {
    mockAuth.mockResolvedValue(null);

    await expect(requireUser()).rejects.toThrow("NEXT_REDIRECT:/login");
  });
});

describe("requireRole", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns the user when their role is allowed", async () => {
    mockAuth.mockResolvedValue({ user: superAdmin });

    await expect(requireRole("SUPER_ADMIN")).resolves.toEqual(superAdmin);
  });

  it("redirects to /dashboard when the role is not allowed", async () => {
    mockAuth.mockResolvedValue({ user: orgAdmin });

    await expect(requireRole("SUPER_ADMIN")).rejects.toThrow("NEXT_REDIRECT:/dashboard");
  });

  it("redirects to /login before checking roles when nobody is signed in", async () => {
    mockAuth.mockResolvedValue(null);

    await expect(requireRole("SUPER_ADMIN")).rejects.toThrow("NEXT_REDIRECT:/login");
  });
});
