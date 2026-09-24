import { randomUUID } from "node:crypto";

// Postgres schema identifiers can't start with a digit and read poorly with
// raw UUID hyphens, so this generates a name safe to interpolate directly
// into `CREATE SCHEMA` / a connection string's `schema` parameter.
export function generateSchemaName(): string {
  return `org_${randomUUID().replace(/-/g, "")}`;
}
