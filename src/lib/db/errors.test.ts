import { describe, expect, it } from "vitest";

import { isUniqueViolation } from "@/lib/db/errors";

describe("isUniqueViolation", () => {
  it("recognizes a unique violation wrapped in a query error", () => {
    const driverError = Object.assign(new Error("duplicate key"), { code: "23505" });

    expect(isUniqueViolation(new Error("Failed query", { cause: driverError }))).toBe(true);
  });

  it.each([
    ["another database error", Object.assign(new Error("fk violation"), { code: "23503" })],
    ["an error without a code", new Error("boom")],
    ["a non-error", "23505"],
  ])("rejects %s", (_name, error) => {
    expect(isUniqueViolation(error)).toBe(false);
  });
});
