import { randomUUID } from "node:crypto";

const SCHEMA_NAME_PATTERN = /^org_[0-9a-f]{32}$/;

// Postgres schema identifiers can't start with a digit and read poorly with
// raw UUID hyphens, so this generates a name safe to interpolate directly
// into `CREATE SCHEMA` / a connection string's `schema` parameter.
export function generateSchemaName(): string {
  return `org_${randomUUID().replace(/-/g, "")}`;
}

// True only for names generateSchemaName() could have produced, so callers
// that interpolate a schema name into SQL can refuse anything else.
export function isGeneratedSchemaName(schemaName: string): boolean {
  return SCHEMA_NAME_PATTERN.test(schemaName);
}
