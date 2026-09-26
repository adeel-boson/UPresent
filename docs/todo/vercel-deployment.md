# TODO: Vercel deployment blockers

Status: open. The app isn't deployed yet ([ADR-0002](../adr/0002-nextjs-fullstack-on-vercel.md)
targets Vercel). These are the things in the current code that stop, or put at risk, a Vercel
deploy.

## 1. Tenant provisioning shells out to the Prisma CLI

**Problem.** Approving an Organization runs `npx --no-install prisma migrate deploy` in a
child process, inside the super-admin's approval request
([`schema-provisioner.ts`](../../src/lib/organizations/schema-provisioner.ts)).

**Why it won't work on Vercel.**

- Next.js decides what goes into a serverless function by tracing `import`s. A child process
  running `npx prisma` isn't traced, so the CLI, the schema engine and `prisma/migrations/`
  aren't guaranteed to be in the function bundle. (Inferred from the tracing docs, not yet
  observed on a real deploy.)
- The request holds a database transaction (the per-Organization advisory lock) for the
  whole migration. Vercel caps function duration (300 s by default), and approval's
  transaction timeout is about 255 s. If Vercel kills the function mid-migration, the
  cleanup that drops a half-migrated schema never runs, and the next approval hits P3009
  until someone drops that schema by hand.
- Prisma Migrate needs a direct (non-pooled) connection, but the app on Vercel should connect
  through a pooler. `prisma/schema.prisma` has no `directUrl` yet.
- Prisma's own `migrate deploy` lock (key 72707369) times out after 10 s, so two approvals of
  _different_ Organizations at once can fail.

**Options.**

1. Replace the CLI with an in-process migration runner that applies tenant-only SQL files
   through the app's own connection. This is the recommendation in
   [docs/research/tenant-schema-pattern.md](../research/tenant-schema-pattern.md), and it
   also fixes the full-history replay into every tenant schema.
2. Keep the CLI but move provisioning out of the request, into a job that runs where the CLI
   exists (a CI step, a queue worker, or a non-serverless host). Approval then needs a
   "setting up" state, which [ADR-0007](../adr/0007-gated-self-serve-onboarding-sync-provisioning.md)
   already names as the future path.
3. Bundle the CLI into the function with `outputFileTracingIncludes`. This is fragile, and
   it still leaves the time limit and the direct-connection problem.

## 2. ADR-0007's synchronous provisioning

ADR-0007 accepts provisioning inside the approval request as fast enough at pilot scale.
On Vercel that only holds if provisioning stays well under the function duration limit.
Option 1 above keeps it synchronous (a few `CREATE TABLE`s over an existing connection).
Option 2 makes it asynchronous and supersedes that part of ADR-0007.

## 3. Deploy-time migrations and configuration

- **Shared-schema migrations:** nothing runs `prisma migrate deploy` for the shared schema
  on deploy yet. It needs a build or CI step using a direct connection URL.
- **Environment variables:** `DATABASE_URL` (pooled) and `AUTH_SECRET` must be set in the
  Vercel project. A direct URL for migrations is also needed once `directUrl` is added. The
  `SEED_SUPER_ADMIN_*` variables are only for the local seed script.
- **`trustHost: true`** in [`src/lib/auth/config.ts`](../../src/lib/auth/config.ts) is set for
  `npm run start` and self-hosting. Vercel is trusted by Auth.js without it. Recheck it if
  the app ever sits behind a proxy that forwards an untrusted `Host` header.

## Decision needed

Choose between option 1 (in-process tenant migrations, keeping ADR-0007 synchronous) and
option 2 (asynchronous provisioning, superseding part of ADR-0007), and record the choice as
an ADR along with the tenant query pattern that ADR-0003 left open.
