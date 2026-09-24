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

2. Copy the example environment file and adjust values if needed (the defaults work out of the box with the `docker-compose.yml` below):

   ```bash
   cp .env.example .env
   ```

3. Start local Postgres:

   ```bash
   docker compose up -d
   ```

4. Create and apply the database schema:

   ```bash
   npm run db:migrate
   ```

5. Seed a super-admin account (email/password come from `SEED_SUPER_ADMIN_EMAIL` / `SEED_SUPER_ADMIN_PASSWORD` in `.env`):

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
| `npm run lint`                    | ESLint                                                    |
| `npm test`                        | Run the test suite once                                   |
| `npm run test:watch`              | Run tests in watch mode                                   |
| `npm run db:migrate`              | Create/apply Prisma migrations against the local database |
| `npm run db:seed`                 | (Re-)seed the super-admin account                         |
| `npm run db:studio`               | Open Prisma Studio to browse the local database           |

## Stack

Next.js (App Router, TypeScript) · Prisma · Postgres (Docker locally) · Auth.js (Credentials provider) · Vitest. See [`docs/v1-plan.md`](docs/v1-plan.md#tech-stack) for rationale and the linked ADRs.

This ticket ([#1](https://github.com/adeel-boson/UPresent/issues/1)) is foundation only: a working local dev loop and a super-admin login. No Organization/Group/roster modeling yet — that starts in [#2](https://github.com/adeel-boson/UPresent/issues/2).
