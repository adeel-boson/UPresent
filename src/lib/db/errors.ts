// Postgres SQLSTATE for a unique index or constraint violation.
const UNIQUE_VIOLATION = "23505";

// True when a query failed on a unique index. Drizzle wraps the driver's
// error (DrizzleQueryError, with the driver's error as `cause`), and pg and
// PGlite both put the SQLSTATE on `code`, so this walks the cause chain.
export function isUniqueViolation(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < 5 && current instanceof Object; depth++) {
    if ("code" in current && current.code === UNIQUE_VIOLATION) {
      return true;
    }
    current = "cause" in current ? current.cause : undefined;
  }
  return false;
}
