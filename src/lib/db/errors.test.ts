import { describe, expect, it } from "vitest";

import { isUniqueViolation } from "@/lib/db/errors";

function uniqueViolation(constraint: string) {
  return Object.assign(new Error("duplicate key"), { code: "23505", constraint });
}

describe("isUniqueViolation", () => {
  it("recognizes a violation of the named index wrapped in a query error", () => {
    const error = new Error("Failed query", { cause: uniqueViolation("User_email_key") });

    expect(isUniqueViolation(error, "User_email_key")).toBe(true);
  });

  it.each([
    ["a violation of another unique index", uniqueViolation("Organization_schemaName_key")],
    ["another database error", Object.assign(new Error("fk violation"), { code: "23503" })],
    ["an error without a code", new Error("boom")],
    ["a non-error", "23505"],
  ])("rejects %s", (_name, error) => {
    expect(isUniqueViolation(error, "User_email_key")).toBe(false);
  });
});
