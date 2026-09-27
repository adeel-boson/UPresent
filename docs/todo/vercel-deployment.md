# TODO: Vercel deployment blockers

Status: open. The app isn't deployed yet ([ADR-0002](../adr/0002-nextjs-fullstack-on-vercel.md)
targets Vercel). These are the things in the current code that stop, or put at risk, a Vercel
deploy.

## 1. Tenant provisioning shelled out to the Prisma CLI — resolved

Resolved by [ADR-0009](../adr/0009-drizzle-orm-tenant-table-factory.md) (option 1 below).
Approval now creates the schema and applies the tenant-only migrations in-process, inside the
approval transaction, through the app's own pool
([`schema-provisioner.ts`](../../src/lib/organizations/schema-provisioner.ts),
[`migrate.ts`](../../src/lib/db/migrate.ts)). There's no CLI, child process, or
full-history replay.

- `db/migrations/tenant/` ships with the approval route through `outputFileTracingIncludes`
  in `next.config.ts`. The build's trace for `/admin/signups` lists the folder. **Unverified:**
  not yet observed on a real Vercel deploy.
- A failed or killed provisioning run rolls back with the approval transaction, so no
  half-migrated schema is left behind. Approval sets a transaction-local `statement_timeout`
  (60 s) so a hung run fails well inside Vercel's 300 s default.
- The runner's lock is `pg_advisory_xact_lock`, which is safe behind a transaction-mode pooler.
  Prisma's 10 s `migrate deploy` lock is gone.

The options considered were: (1) an in-process runner (chosen), (2) moving provisioning to an
asynchronous job, and (3) bundling the CLI into the function.

## 2. ADR-0007's synchronous provisioning

Kept. Provisioning is now a `CREATE SCHEMA` plus the tenant migrations over an existing
connection, which is well within the function duration limit at pilot scale. Revisit if tenant
migrations grow slow.

## 3. Deploy-time migrations and configuration

- **Migrations on deploy:** run `npm run db:migrate` (shared schema) and then
  `npm run db:migrate:tenants` (every approved Organization's schema) as a build or CI step
  before traffic shifts. Nothing runs them automatically yet. Use a direct (non-pooled)
  connection URL for this step. The app itself can use the pooled one.
- **Connection pooling:** `src/lib/db/client.ts` keeps one small module-scope `pg.Pool`
  (`max: 5`, 5 s idle timeout). Vercel also recommends `attachDatabasePool` from
  `@vercel/functions`, so idle connections close before a function suspends. Add it when
  deploying.
- **Environment variables:** `DATABASE_URL` (pooled) and `AUTH_SECRET` must be set in the
  Vercel project, plus a direct URL for the migration step. The `SEED_SUPER_ADMIN_*` variables
  are only for the local seed script.
- **`trustHost: true`** in [`src/lib/auth/config.ts`](../../src/lib/auth/config.ts) is set for
  `npm run start` and self-hosting. Vercel is trusted by Auth.js without it. Recheck it if
  the app ever sits behind a proxy that forwards an untrusted `Host` header.
