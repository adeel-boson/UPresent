import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// Parent-relative imports hide where a module lives; `@/` paths are greppable
// and survive file moves. Same-folder `./` imports stay allowed.
const noParentRelativeImports = {
  group: ["../*"],
  message: "Import via the `@/` alias instead of a parent-relative path.",
};

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
    // Routes and components reach data only through domain modules in
    // `src/lib/<domain>/`, which own authorization and tenant scoping.
    // See CODING_STANDARDS.md § Layers.
    files: ["src/app/**", "src/components/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@/lib/prisma",
              message:
                "Query through a domain module in src/lib/<domain>/ instead (CODING_STANDARDS.md § Layers).",
            },
            {
              // Enums and types from @prisma/client stay importable; only a
              // second client (and with it direct queries) is banned.
              name: "@prisma/client",
              importNames: ["PrismaClient"],
              message:
                "Query through a domain module in src/lib/<domain>/ instead (CODING_STANDARDS.md § Layers).",
            },
          ],
          patterns: [noParentRelativeImports],
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
  ]),
]);

export default eslintConfig;
