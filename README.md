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

3. Start local Postgres:

   ```bash
   docker compose up -d
   ```

4. Create and apply the database schema:

   ```bash
   npm run db:migrate
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

| Command                           | What it does                                              |
| --------------------------------- | --------------------------------------------------------- |
| `npm run dev`                     | Start the Next.js dev server                              |
| `npm run build` / `npm run start` | Production build / start                                  |
| `npm run check`                   | Typecheck, lint, format check and tests (the merge gate)  |
| `npm run typecheck`               | Generate route types, then `tsc --noEmit`                 |
| `npm run lint`                    | ESLint                                                    |
| `npm run format`                  | Format the repo with Prettier                             |
| `npm test`                        | Run the test suite once                                   |
| `npm run test:watch`              | Run tests in watch mode                                   |
| `npm run db:migrate`              | Create/apply Prisma migrations against the local database |
| `npm run db:seed`                 | (Re-)seed the super-admin account                         |
| `npm run db:studio`               | Open Prisma Studio to browse the local database           |

## Stack

Next.js (App Router, TypeScript) · Prisma · Postgres (Docker locally) · Auth.js (Credentials provider) · Vitest. See [`docs/v1-plan.md`](docs/v1-plan.md#tech-stack) for rationale and the linked ADRs.

How code here is written, and what "done" means: [`CODING_STANDARDS.md`](CODING_STANDARDS.md).
