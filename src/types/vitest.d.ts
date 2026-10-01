import "vitest";

declare module "vitest" {
  interface ProvidedContext {
    // Path to the migrated PGlite template that createTestDatabase() starts
    // from, written once per run by src/lib/db/testing-global-setup.ts.
    testDatabaseTemplatePath: string;
  }
}
