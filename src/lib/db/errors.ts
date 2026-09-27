// Postgres SQLSTATE for a unique index or constraint violation.
const UNIQUE_VIOLATION = "23505";

// True when a query failed on the named unique index. Naming it matters: a
// table can have several (User has only the email one today, but Organization
// also has schemaName), and a caller mapping this to a user-facing error must
// not mistake another index's violation for its own. Drizzle wraps the
// driver's error (DrizzleQueryError, with the driver's error as `cause`), and
// pg and PGlite both put the SQLSTATE on `code` and the index on
// `constraint`, so this walks the cause chain.
export function isUniqueViolation(error: unknown, constraintName: string): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < 5 && current instanceof Object; depth++) {
    if ("code" in current && current.code === UNIQUE_VIOLATION) {
      return "constraint" in current && current.constraint === constraintName;
    }
    current = "cause" in current ? current.cause : undefined;
  }
  return false;
}
