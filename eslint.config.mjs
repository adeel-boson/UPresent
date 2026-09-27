import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// Parent-relative imports hide where a module lives; `@/` paths are greppable
// and survive file moves. Same-folder `./` imports stay allowed.
const noParentRelativeImports = {
  group: ["../*"],
  message: "Import via the `@/` alias instead of a parent-relative path.",
};

const queryThroughDomainModule =
  "Query through a domain module in src/lib/<domain>/ instead (CODING_STANDARDS.md § Layers).";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      "@typescript-eslint/consistent-type-imports": ["error", { fixStyle: "inline-type-imports" }],
      "import/order": [
        "error",
        {
          groups: [["builtin", "external"], "internal", ["parent", "sibling", "index"]],
          pathGroups: [{ pattern: "@/**", group: "internal" }],
          pathGroupsExcludedImportTypes: ["builtin"],
          "newlines-between": "always",
        },
      ],
      "no-restricted-imports": ["error", { patterns: [noParentRelativeImports] }],
    },
  },
  {
    // Tenant tables are reached only through `withTenant`, which builds them
    // for the caller's Organization. The tenant schema module's own exports
    // point at a placeholder schema for drizzle-kit. See ADR-0009.
    files: ["src/**"],
    ignores: ["src/lib/db/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@/lib/db/tenant-schema",
              message: "Reach tenant tables through withTenant from @/lib/db/tenant (ADR-0009).",
            },
          ],
          patterns: [noParentRelativeImports],
        },
      ],
    },
  },
  {
    // Routes and components reach data only through domain modules in
    // `src/lib/<domain>/`, which own authorization and tenant scoping.
    // Types and enum values from `@/lib/db/schema` stay importable; the
    // client, the tenant helper and Drizzle's or pg's query APIs don't.
    // See CODING_STANDARDS.md § Layers.
    files: ["src/app/**", "src/components/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            { name: "pg", message: queryThroughDomainModule },
            { name: "drizzle-orm", message: queryThroughDomainModule },
          ],
          patterns: [
            noParentRelativeImports,
            {
              group: ["@/lib/db/*", "!@/lib/db/schema"],
              message: queryThroughDomainModule,
            },
            { group: ["drizzle-orm/*", "@electric-sql/*"], message: queryThroughDomainModule },
          ],
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Other agents' git worktrees: separate checkouts with their own .next/.
    ".claude/worktrees/**",
  ]),
]);

export default eslintConfig;
