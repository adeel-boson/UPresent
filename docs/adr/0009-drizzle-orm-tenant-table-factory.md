---
status: accepted
---

# Drizzle ORM, with tenant tables built per schema and migrated in-process

Supersedes [ADR-0003](./0003-prisma-orm-tenant-pattern-deferred.md). We replace Prisma with **Drizzle ORM** (node-postgres driver) and decide the schema-per-tenant pattern ([ADR-0001](./0001-multi-tenant-schema-per-tenant-isolation.md)) that ADR-0003 left open. Prisma schema-qualifies every query with the schema its client was built for, and fixes `multiSchema` names at generate time, so each Organization would need its own client. Its only migration tool is a CLI, which provisioning shelled out to at request time, replaying the whole shared history (`User`, `Organization`, …) into every tenant schema. That can't run on Vercel ([ADR-0002](./0002-nextjs-fullstack-on-vercel.md)). Drizzle builds tables for any schema name at runtime and exposes its migration files to code, so we could fix both.

## The pattern

- **(a) Defining tenant tables.** Tenant tables are defined once, in `defineTenantTables(schema)` in `src/lib/db/tenant-schema.ts`, with `schema.table(…)`/`schema.enum(…)`. Shared tables live in `src/lib/db/schema.ts` with `pgTable`/`pgEnum` (the `public` schema).
- **(b) Targeting a tenant.** `withTenant(organization, ({ db, tables }) => …)` in `src/lib/db/tenant.ts` validates the Organization's `schemaName`, then hands `fn` that schema's tables (`defineTenantTables(pgSchema(schemaName))`) and a Drizzle instance over the **one shared `pg.Pool`**, so `db.query.*` is bound to the same schema. Both are cached per schema (bounded). Every tenant query therefore names its schema explicitly (`"org_…"."Group"`); nothing depends on connection state. It is the only way domain code reaches tenant tables; lint bans importing the tenant schema module elsewhere.
- **(c) Generating and applying migrations.** Two drizzle-kit configs write two folders: `drizzle.config.ts` → `db/migrations/shared/`, `drizzle.tenant.config.ts` → `db/migrations/tenant/`. For drizzle-kit, the tenant tables are built against a placeholder schema named `"tenant"`, so the generated SQL reads `"tenant"."Group"`, while FKs to shared tables stay `"public"."User"`. Shared migrations apply with Drizzle's `migrate()` (history in `drizzle.__drizzle_migrations`). Tenant migrations apply with our own runner (`migrateTenantSchema` in `src/lib/db/migrate.ts`): Drizzle's `migrate()` runs SQL as written and can't retarget it. The runner rewrites `"tenant".` to the Organization's schema and keeps a `__drizzle_migrations` history table inside each tenant schema, so dropping the schema drops its history. It applies all pending migrations in one transaction under a transaction-scoped advisory lock. Provisioning on approval ([ADR-0007](./0007-gated-self-serve-onboarding-sync-provisioning.md)) creates the schema and runs this runner inside the approval transaction. It uses no CLI and no child process, and stays synchronous.
- **(d) Rolling out to existing tenants.** `npm run db:migrate:tenants` runs the runner for every `APPROVED` Organization, one schema at a time. It reports failures and exits non-zero, and a failed schema stays at its last good version. Deploys run `db:migrate` then `db:migrate:tenants`, and tenant migrations are written expand/contract so old code tolerates the new shape.

## Why this pattern

- **Transaction-mode pooling (PgBouncer, Neon, Supabase).** Isolation lives in the table objects, not in `search_path`, so no session state can leak between requests on a shared server connection, and a query needs no surrounding transaction. The runner's only session-affecting statements are transaction-scoped (`pg_advisory_xact_lock`, `set_config(…, true)` for approval's statement timeout).
- **Vercel.** One small pool per function instance (`max: 5`, 5 s idle timeout) serves every Organization, so connection count doesn't grow with tenants. Migrations run in-process over that pool. `next.config.ts` ships `db/migrations/tenant/` with the approval route via `outputFileTracingIncludes`, because the runner reads it from disk.

## Considered options

- **`SET LOCAL search_path` per transaction, with tenant tables as plain `pgTable`.** It is also pooler-safe, and it needs no factory. It was rejected for two reasons. drizzle-kit writes `"public".` into generated DDL for enums and FK targets even for default-schema tables, so tenant migrations would still need rewriting, and there'd be no way to tell a tenant FK from a real FK to `public."User"`. And every tenant query would have to run inside a transaction, where a forgotten `withTenant` silently resolves against `public`.
- **Prisma with one client per tenant over a shared pool** (the research note's option E). It keeps Prisma, but it still needs our own runner for tenant SQL, per-tenant generated clients, and a Prisma 7 upgrade. See [`docs/research/tenant-schema-pattern.md`](../research/tenant-schema-pattern.md).

## Consequences

- A tenant table that references a shared one (a host's `User`) gets a real cross-schema FK. Relations between the two schema modules aren't modeled for relational queries, so joins across them are written explicitly.
- Deleting a `User` must check every tenant schema that references it. Decide `ON DELETE` per FK when those tables arrive.
- Existing local databases built by Prisma are not migrated. Drop and recreate them (README).
