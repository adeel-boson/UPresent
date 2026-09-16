import { describe, expect, it } from "vitest";

import { hashPassword, verifyPassword } from "@/lib/auth/password";

describe("password hashing", () => {
  it("verifies a password against its own hash", async () => {
    const hashed = await hashPassword("correct horse battery staple");

    await expect(verifyPassword("correct horse battery staple", hashed)).resolves.toBe(true);
  });

  it("rejects an incorrect password", async () => {
    const hashed = await hashPassword("correct horse battery staple");

    await expect(verifyPassword("wrong password", hashed)).resolves.toBe(false);
  });

  it("produces a different hash than the plaintext input", async () => {
    const hashed = await hashPassword("correct horse battery staple");

    expect(hashed).not.toBe("correct horse battery staple");
  });
});
