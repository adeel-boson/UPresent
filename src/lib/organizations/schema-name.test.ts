import { describe, expect, it } from "vitest";

import { generateSchemaName, isGeneratedSchemaName } from "@/lib/organizations/schema-name";

describe("generateSchemaName", () => {
  it("generates a name that passes its own check", () => {
    expect(isGeneratedSchemaName(generateSchemaName())).toBe(true);
  });
});

describe("isGeneratedSchemaName", () => {
  it.each([
    'org_abc"; DROP SCHEMA public CASCADE; --',
    "public",
    "org_ABCDEF0123456789ABCDEF0123456789",
    "org_0123456789abcdef0123456789abcdef0",
  ])("rejects %j", (schemaName) => {
    expect(isGeneratedSchemaName(schemaName)).toBe(false);
  });
});
