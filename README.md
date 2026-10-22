# UPresent

An attendance-tracking product for schools and colleges. See [`docs/v1-plan.md`](docs/v1-plan.md) for what the product does, [`CONTEXT.md`](CONTEXT.md) for domain vocabulary, and [`docs/adr/`](docs/adr) for why things are built this way.

## Prerequisites

- Node.js 20+
- Docker (for local Postgres)

## Getting started from a clean checkout

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy the example environment file (the database and seed defaults work out of the box with the `docker-compose.yml` below):

   ```bash
   cp .env.example .env
   ```

   Then generate `AUTH_SECRET`. Login fails with `MissingSecret` while it is empty. This writes it to `.env.local`, which Next.js loads alongside `.env`:

   ```bash
   npx auth secret
   ```

   Signup emails a verification link through [Resend](https://resend.com). Set `RESEND_API_KEY` to a Resend API key, `EMAIL_FROM` to a sender on a domain verified in Resend, and `APP_URL` to the origin links should open (`http://localhost:3000` locally). Resend's shared test sender, `onboarding@resend.dev`, only delivers to the email address of your own Resend account.

3. Start local Postgres:

   ```bash
   docker compose up -d
   ```

4. Apply the database migrations: the shared schema, then every approved Organization's tenant schema (none yet on a fresh database):

   ```bash
   npm run db:migrate
   npm run db:migrate:tenants
   ```

5. Seed a super-admin account. Its email and password are the static local-dev values `SEED_SUPER_ADMIN_EMAIL` / `SEED_SUPER_ADMIN_PASSWORD` in `.env`. Every run (re)sets the super-admin's password to exactly `SEED_SUPER_ADMIN_PASSWORD`, so that is always the password to log in with. Local dev only:

   ```bash
   npm run db:seed
   ```

6. Start the dev server:

   ```bash
   npm run dev
   ```

7. Open [http://localhost:3000](http://localhost:3000) and log in with the seeded super-admin credentials.

## Scripts

| Command                           | What it does                                                                                          |
| --------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `npm run dev`                     | Start the Next.js dev server                                                                          |
| `npm run build` / `npm run start` | Production build / start                                                                              |
| `npm run check`                   | Typecheck, lint, format check and tests (the merge gate)                                              |
| `npm run typecheck`               | Generate route types, then `tsc --noEmit`                                                             |
| `npm run lint`                    | ESLint                                                                                                |
| `npm run format`                  | Format the repo with Prettier                                                                         |
| `npm test`                        | Run the test suite once (domain tests run against an in-process Postgres, PGlite; no database needed) |
| `npm run test:watch`              | Run tests in watch mode                                                                               |
| `npm run db:generate`             | Generate migrations from schema changes (shared and tenant) into `db/migrations/`                     |
| `npm run db:migrate`              | Apply pending shared-schema migrations                                                                |
| `npm run db:migrate:tenants`      | Apply pending tenant migrations to every approved Organization's schema                               |
| `npm run db:seed`                 | (Re-)seed the super-admin account                                                                     |
| `npm run db:studio`               | Open Drizzle Studio to browse the shared schema                                                       |

## Changing the database schema

Shared tables (`User`, `Organization`) are defined in [`src/lib/db/schema.ts`](src/lib/db/schema.ts), and per-Organization tables in [`src/lib/db/tenant-schema.ts`](src/lib/db/tenant-schema.ts) ([ADR-0009](docs/adr/0009-drizzle-orm-tenant-table-factory.md)). Edit one, then run `npm run db:generate` and commit the new files under `db/migrations/`. Apply them with `npm run db:migrate` and `npm run db:migrate:tenants`. Never edit a migration that has been applied.

## Upgrading a local database from before Drizzle

Databases created while the project used Prisma (they have a `_prisma_migrations` table, and every `org_…` schema holds copies of `User`/`Organization`) are not migrated in place. They only ever held local test data, so recreate the database, then follow steps 4–5 above:

```bash
docker compose down -v   # deletes the local Postgres volume
docker compose up -d
npm run db:migrate && npm run db:migrate:tenants && npm run db:seed
```

## Stack

Next.js (App Router, TypeScript) · Drizzle ORM · Postgres (Docker locally) · Auth.js (Credentials provider) · Vitest. See [`docs/v1-plan.md`](docs/v1-plan.md#tech-stack) for rationale and the linked ADRs.

How code here is written, and what "done" means: [`CODING_STANDARDS.md`](CODING_STANDARDS.md).
