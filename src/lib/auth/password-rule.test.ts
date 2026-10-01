import { describe, expect, it } from "vitest";

import { passwordSchema } from "@/lib/auth/password-rule";

describe("passwordSchema", () => {
  it("accepts a password of 8 characters", () => {
    expect(passwordSchema.safeParse("abcdefgh").success).toBe(true);
  });

  it("rejects a password of 7 characters", () => {
    expect(passwordSchema.safeParse("abcdefg").success).toBe(false);
  });
});
