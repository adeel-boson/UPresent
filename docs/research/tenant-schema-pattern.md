# Tenant Schema Pattern with Prisma — Research Notes

Purpose: primary-source findings to decide how UPresent defines, migrates, and queries per-tenant
Postgres schemas (ADR-0001) with Prisma (ADR-0003 deferred this), on Vercel serverless. Sections
1–5 are factual and cited. Sections 6–8 compare the options, make one recommendation, and sketch
the implementation. Research conducted 2026-09-26.

Starting point: Prisma 6.19 (`prisma-client-js`, no driver adapter), one `schema.prisma` with
`User` and `Organization`. `src/lib/organizations/schema-provisioner.ts` runs `CREATE SCHEMA` and
then `npx --no-install prisma migrate deploy` with `?schema=org_<hex>`, which replays the whole
shared history into every tenant schema.

---

## 1. Prisma version state (September 2026)

- **Prisma 6 is security-patch-only and reaches end of life on 19 November 2026** ("12 months
  after the release of Prisma ORM 7"). Prisma 7 is the supported line. Prisma 8 is a release
  candidate with GA expected October 2026. The page warns Prisma 7 projects to pin `prisma@7`
  to avoid an automatic jump to 8.
  Source: [Prisma ORM release status](https://www.prisma.io/docs/prisma-orm/release-status)
- Prisma 7.0.0 made the Rust-free client the default. Upgrading to 7 requires a driver adapter
  for every database ("require a driver adapter for all databases"), the `prisma-client`
  generator with a mandatory `output` path, `prisma.config.ts` holding the datasource URL,
  explicit env loading, ESM, and Node 20.19+. `prisma-client-js` "will be removed in future
  releases".
  Source: [Upgrade to v7 (Prisma docs)](https://www.prisma.io/docs/orm/v6/more/upgrades/to-v7),
  [Prisma ORM v7.0.0 changelog](https://www.prisma.io/changelog/2025-11-19)
- In **6.16.0** driver adapters and the Rust-free client (`engineType = "client"`) became GA,
  and the `prisma-client` generator was declared "ready for production". So everything the
  recommendation below needs is available on 6.19 today, and it is also the only shape
  Prisma 7 supports.
  Source: [Prisma 6.16.0 release](https://github.com/prisma/orm/releases/tag/6.16.0)
- **Prisma 8 RC** is a large rewrite: PSL files need a `// use prisma-8` header, config moves to
  `definePrismaConfig`, `.take/.skip` become `.limit/.offset`, CLI commands are renamed, and
  "expect breaking changes between release candidates". Latest stable is 7.10.0 (25 Aug 2026).
  Source: [prisma/orm releases](https://github.com/prisma/orm/releases),
  [Prisma 8 changelog, 2026-08-02](https://www.prisma.io/changelog/2026-08-02)
- `multiSchema` and `prisma.config.ts` both became **GA in 6.13.0**. You no longer need the
  preview flag.
  Source: [Prisma ORM v6.13.0 changelog](https://www.prisma.io/changelog/2025-07-30)
- There is no public programmatic Migrate API in the docs I read. Migrations are applied with
  the CLI (`migrate deploy`) or with `prisma db execute`, which "applies a SQL script to the
  database without interacting with the Prisma migrations table".
  Source: [Prisma CLI reference](https://www.prisma.io/docs/orm/reference/prisma-cli-reference)

## 2. Does Prisma qualify table names with the schema? (Yes, and it decides everything)

- In Prisma's own logging docs, the example SQL is fully qualified:
  `SELECT "public"."User"."id", ... FROM "public"."User"`.
  Source: [Logging (Prisma docs)](https://www.prisma.io/docs/orm/prisma-client/observability-and-logging/logging)
- The query builder builds every model's table as `(schema_prefix, model_db_name)`. The prefix
  comes from the model's `@@schema` or, if there is none, from the connection's `schema_name`.
  Source: [prisma-engines `sql-query-builder/src/model_extensions/table.rs`](https://github.com/prisma/prisma-engines/blob/main/query-compiler/query-builders/sql-query-builder/src/model_extensions/table.rs)
- quaint's `ConnectionInfo::schema_name()` is documented as "what item names are prefixed with
  in queries" (for Postgres: "the selected schema inside the current database"). For driver
  adapters (`ConnectionInfo::External`) it returns the adapter-supplied `schema_name`.
  Source: [prisma-engines `quaint/src/connector/connection_info.rs`](https://github.com/prisma/prisma-engines/blob/main/quaint/src/connector/connection_info.rs)
- A confirmed bug report (6.16.2, `prisma-client` + `@prisma/adapter-pg`) says that with no
  adapter `schema` option, ORM queries are "prefixed with the schema 'public'", even when the URL
  has `?schema=`. The fix is to pass the `schema` option to `PrismaPg`.
  Source: [prisma/prisma#28128](https://github.com/prisma/prisma/issues/28128)
- Postgres resolves only _unqualified_ names through `search_path`. A qualified `schema.table`
  name bypasses it.
  Source: [PostgreSQL: Schemas](https://www.postgresql.org/docs/current/ddl-schemas.html)
- **Consequence:** `SET search_path` / `set_config('search_path', …, true)` **cannot redirect
  Prisma model queries.** Prisma always emits `"public"."Group"` (or whatever schema the client
  was built with), so any "one client + switch search_path per request" design (including an
  `$extends` wrapper) silently reads and writes the wrong schema. It only affects `$queryRaw`
  with unqualified names. The one Prisma-level lever is the **schema the client is built with**
  (URL `?schema=` for the Rust engine without an adapter, or the adapter's `schema` option).
- Prisma's migration SQL files, by contrast, are **unqualified** (e.g. `CREATE TABLE "User"` in
  this repo's `prisma/migrations/*/migration.sql`). So they _do_ follow `search_path`, which is
  why `migrate deploy ?schema=` works for provisioning today.

## 3. Defining and migrating tenant-only tables separately (question a)

- **`multiSchema` doesn't fit dynamic N schemas.** You list every schema name in the datasource
  `schemas` array and pin every model with `@@schema("…")`, all at generate time.
  Source: [Multi-schema (Prisma docs)](https://www.prisma.io/docs/orm/prisma-schema/data-model/multi-schema)
- Feature requests for dynamic per-tenant schemas are still unresolved. #12420 ("Isolating
  multi-tenant data via database schemas") is open since 2022, and the suggested workaround is
  a Prisma Client per tenant. #24928 (dynamic `@@schema`) was closed as not planned. Users in
  #24794 describe duplicating every model per tenant as the only `multiSchema` route.
  Source: [prisma/prisma#12420](https://github.com/prisma/prisma/issues/12420),
  [prisma/prisma#24928](https://github.com/prisma/prisma/issues/24928),
  [prisma/prisma#24794](https://github.com/prisma/prisma/issues/24794)
- **Second schema file + second client:** you can point `prisma.config.ts` `schema` at a file or
  folder and set `migrations.path` explicitly, and choose a config with `--config`.
  `migrate dev` takes `--schema` and `--create-only`. So a separate `prisma/tenant/schema.prisma`
  can have its own migrations directory and its own generated client (distinct `output`).
  Source: [Prisma Config reference](https://www.prisma.io/docs/orm/v6/reference/prisma-config-reference),
  [Prisma CLI reference (v6)](https://www.prisma.io/docs/orm/v6/reference/prisma-cli-reference)
- `prisma migrate diff … --script` generates SQL between two sources (schema files, migration
  directories, empty). `prisma db execute --stdin/--file` applies SQL without touching
  `_prisma_migrations`. In v7, `--shadow-database-url` was removed and `--from-config-datasource`
  was added. **Unverified:** whether `--from-migrations` needs a shadow DB on 6.19. The v6 docs
  page I read was ambiguous, so the sketch below avoids that flag.
  Source: [Prisma CLI reference](https://www.prisma.io/docs/orm/reference/prisma-cli-reference)
- **Plain SQL files applied by our own runner** need no Prisma support. Postgres runs
  unqualified DDL in the first schema of `search_path`, and `SET LOCAL` scopes that to one
  transaction (section 5).
- **Cross-schema FKs are legal in Postgres:** "schemas are not rigidly separated: a user can
  access objects in any of the schemas", so a tenant table can reference `public."User"("id")`.
  A Prisma client generated from only the tenant schema file can't model that relation. The FK
  column becomes a scalar, and the constraint is hand-added to the tenant migration SQL.
  Source: [PostgreSQL: Schemas](https://www.postgresql.org/docs/current/ddl-schemas.html)

## 4. Targeting a tenant schema at runtime (question b)

- **URL `?schema=`** (Prisma 6 Rust engine, no adapter): `schema` is a documented Postgres
  connection argument (default `public`). Each `PrismaClient` owns its own pool of
  `num_physical_cpus * 2 + 1` connections by default (tunable with `connection_limit`). So N
  cached tenant clients hold up to N pools per function instance.
  Source: [PostgreSQL (Prisma docs)](https://www.prisma.io/docs/orm/overview/databases/postgresql),
  [Connection pool (Prisma v6 docs)](https://www.prisma.io/docs/orm/v6/prisma-client/setup-and-configuration/databases-connections/connection-pool)
- **Driver adapter `schema` option:** documented as
  `new PrismaPg({ connectionString }, { schema: "mySchema" })`. The same doc exists for v6
  (where it called adapters "Preview", before they went GA in 6.16).
  Source: [PostgreSQL (Prisma docs)](https://www.prisma.io/docs/orm/overview/databases/postgresql),
  [PostgreSQL (Prisma v6 docs)](https://www.prisma.io/docs/orm/v6/overview/databases/postgresql)
- In the `@prisma/adapter-pg` source (tags 6.19.0 and 7.10.0), `schema` is typed "The name of
  the schema to use in generated queries". `getConnectionInfo()` returns it as `schemaName`,
  which feeds the table qualification in section 2. It does **not** issue `SET search_path`.
  Source: [adapter-pg `pg.ts` @ 6.19.0](https://github.com/prisma/orm/blob/6.19.0/packages/adapter-pg/src/pg.ts),
  [adapter-pg `pg.ts` @ 7.10.0](https://github.com/prisma/orm/blob/7.10.0/packages/adapter-pg/src/pg.ts)
- **Key enabler:** the `PrismaPg` factory accepts `pg.Pool | pg.PoolConfig | string`. With an
  external pool, `connect()` reuses it (`this.externalPool ?? new pg.Pool(...)`), and dispose
  only ends it if `disposeExternalPool` is set. So **many tenant `PrismaClient`s, each with a
  different `schema`, can share ONE `pg.Pool`.** Connection count stays flat as tenants grow.
  Source: [adapter-pg `pg.ts` @ 7.10.0](https://github.com/prisma/orm/blob/7.10.0/packages/adapter-pg/src/pg.ts)
- With adapters, "connection pooling defaults (and configuration) now come from the driver
  itself". The `pg` pool defaults to max 10.
  Source: [Connection pool (Prisma v6 docs)](https://www.prisma.io/docs/orm/v6/prisma-client/setup-and-configuration/databases-connections/connection-pool)
- **`$extends` + `set_config` pattern:** Prisma's RLS example wraps each query in a batch
  `$transaction` that first runs `set_config('app.current_company_id', …, TRUE)`. It warns that
  explicit `$transaction()` calls "may not work as intended" and says it "is not intended to be
  used in production". For schema switching it doesn't help anyway (section 2).
  Source: [prisma-client-extensions/row-level-security](https://github.com/prisma/prisma-client-extensions/tree/main/row-level-security)
- **Unverified:** the memory and startup cost of instantiating one `PrismaClient` per tenant
  (each loads the query engine or compiler). No Prisma doc I found quantifies it, so bound it
  with an LRU cache and measure.

## 5. Serverless and pooling constraints (questions c, d)

- **PgBouncer transaction mode:** `SET/RESET`, SQL `PREPARE/DEALLOCATE`, `LISTEN`, and
  _session-level_ advisory locks are "Never" compatible. Protocol-level prepared statements
  work only with `max_prepared_statements` > 0.
  Source: [PgBouncer features](https://www.pgbouncer.org/features.html)
- `SET LOCAL` lasts "only till the end of the current transaction, whether committed or not".
  Outside a transaction it only emits a warning. `set_config(name, value, true)` is the
  function form. Plain `SET` persists for the session, so behind a transaction pooler it
  leaks to whoever gets that server connection next.
  Source: [PostgreSQL: SET](https://www.postgresql.org/docs/current/sql-set.html),
  [PostgreSQL: admin functions](https://www.postgresql.org/docs/current/functions-admin.html)
- `pg_advisory_xact_lock` / `pg_try_advisory_xact_lock` are transaction-scoped and released
  automatically at commit or rollback. `pg_advisory_lock` is session-scoped. Only the xact
  form is safe through a transaction pooler.
  Source: [PostgreSQL: admin functions](https://www.postgresql.org/docs/current/functions-admin.html)
- Neon's pooler is PgBouncer in transaction mode. `SET search_path` does not persist across
  transactions. The fixes Neon lists are direct connections, schema-qualified names, or
  `ALTER ROLE … SET search_path`. Protocol-level prepared statements are supported, and up to
  10,000 client connections are allowed.
  Source: [Neon connection pooling](https://neon.com/docs/connect/connection-pooling)
- Supabase transaction mode (port 6543) "does not support prepared statements". It also loses
  session-level state between transactions ("`set` and `reset`, session-level advisory locks").
  Source: [Supabase: Connecting to Postgres](https://supabase.com/docs/guides/database/connecting-to-postgres)
- node-postgres only creates server-side prepared statements when a query config has a `name`.
  Source: [node-postgres: Queries](https://node-postgres.com/features/queries)
- Prisma's `pgbouncer=true` disables named prepared statements (for the Rust engine). Prisma
  recommends **not** setting it with PgBouncer ≥ 1.21. Migrate's schema engine "does not
  support connection pooling with PgBouncer" and needs a direct URL.
  Source: [PgBouncer (Prisma v6 docs)](https://www.prisma.io/docs/orm/v6/prisma-client/setup-and-configuration/databases-connections/pgbouncer)
- `migrate deploy` takes an advisory lock (key 72707369) with a non-configurable 10 s timeout.
  Prisma says `migrate deploy` "should generally be part of an automated CI/CD pipeline".
  People hit that lock timeout behind poolers and cold serverless databases, and use
  `PRISMA_SCHEMA_DISABLE_ADVISORY_LOCK=1` to get past it.
  Source: [Development and production (Prisma v6 docs)](https://www.prisma.io/docs/orm/v6/prisma-migrate/workflows/development-and-production),
  [prisma/prisma#27636](https://github.com/prisma/prisma/issues/27636)
- Vercel with Fluid compute: default and max duration is 300 s on Hobby. On Pro/Enterprise the
  default is 300 s and the max is 800 s (30 min in beta). Route handlers set `maxDuration`.
  Source: [Vercel: Configuring maximum duration](https://vercel.com/docs/functions/configuring-functions/duration)
- Vercel recommends a pool in module/global scope, a short idle timeout (~5 s), and
  `attachDatabasePool` from `@vercel/functions` so idle connections close before suspension.
  Source: [Vercel KB: Connection pooling with functions](https://vercel.com/kb/guide/connection-pooling-with-functions)
- Next.js decides what ships in a function by statically tracing `import`/`require`/`fs` with
  `@vercel/nft`. Anything else needs `outputFileTracingIncludes`. A child process running
  `npx prisma` is not a traced import, so the CLI and schema engine aren't guaranteed to exist
  at runtime. **Unverified:** I didn't deploy the current provisioner to Vercel to watch it
  fail, but nothing in the trace model would include it.
  Source: [Next.js: `output` / file tracing](https://nextjs.org/docs/app/api-reference/config/next-config-js/output)
  (also `node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/output.md`)

---

## 6. Comparison of end-to-end options

| Option                                                                         | Shared/tenant split                            | Runtime targeting               | Pooler-safe                   | Serverless-safe                        | Connections per instance | Migration rollout                                                         | Prisma-version dependence                                  | Complexity                                                       |
| ------------------------------------------------------------------------------ | ---------------------------------------------- | ------------------------------- | ----------------------------- | -------------------------------------- | ------------------------ | ------------------------------------------------------------------------- | ---------------------------------------------------------- | ---------------------------------------------------------------- |
| **A. Status quo**: replay full history, per-tenant client via `?schema=`       | None (tenants get empty `User`/`Organization`) | Per-tenant client, own pool     | Yes (qualified names)         | **No**: needs CLI via `npx` at runtime | N × pool size            | `migrate deploy` per schema; 10 s lock, needs direct URL                  | Prisma 6 only (URL `schema` ignored with adapters, #28128) | Low now, grows badly                                             |
| **B. `multiSchema`**                                                           | Yes                                            | Static `@@schema`               | Yes                           | Yes                                    | 1 pool                   | Normal Migrate                                                            | GA ≥ 6.13                                                  | **Not viable**: schema names fixed at generate time              |
| **C. One client + `search_path` in tx / `$extends`**                           | Possible                                       | `SET LOCAL search_path`         | Yes if `SET LOCAL`            | Yes                                    | 1 pool                   | Own runner                                                                | Any                                                        | **Not viable**: Prisma emits `"public"."T"`, search_path ignored |
| **D. Tenant schema file + Rust-engine client per tenant via `?schema=`**       | Yes                                            | LRU of clients, each own pool   | Yes                           | Yes if migrations don't use CLI        | N × `connection_limit`   | Own SQL runner                                                            | Prisma 6 only; breaks on 7                                 | Medium                                                           |
| **E. Tenant schema file + `PrismaPg({schema})` clients sharing one `pg.Pool`** | Yes                                            | LRU of clients, one shared pool | Yes (qualified names, no SET) | Yes                                    | 1 pool (e.g. max 5)      | Own SQL runner: per-schema version table, xact advisory lock, `SET LOCAL` | 6.16+ and 7 (the v7-native shape)                          | Medium                                                           |
| **F. Prisma for shared only; tenant tables via SQL builder (Kysely/raw)**      | Yes                                            | `withSchema()` / qualified SQL  | Yes                           | Yes                                    | 1 pool                   | Own SQL runner                                                            | None for tenant side                                       | Medium-high: two data-access styles                              |

## 7. Recommendation

**Adopt option E: a separate tenant Prisma schema and generated client, instantiated per tenant
as `new TenantPrismaClient({ adapter: new PrismaPg(sharedPool, { schema }) })` and cached
behind `withTenant(schemaName, fn)`. Tenant migrations are Prisma-authored SQL files applied
by our own in-process runner that tracks versions per schema.**

Rationale:

- It works _with_ Prisma's always-qualified SQL instead of against it. Isolation comes from the
  client's schema, not from mutable connection state, so pooling can't leak it (sections 2, 5).
- One shared `pg.Pool` keeps connection count independent of tenant count, which is what makes
  it viable on Vercel. Option D's pool-per-tenant doesn't scale (section 4).
- It removes the runtime CLI dependency and the full-history replay. Tenants get only tenant
  tables, provisioning is plain SQL over the existing connection, and the synchronous approval
  in ADR-0007 fits easily within Vercel's 300 s default.
- It's the Prisma 7 shape (mandatory adapters). It's buildable on 6.19 now, since adapters are
  GA since 6.16, and it sets up the upgrade Prisma 6's 19 Nov 2026 EOL forces anyway. Pin
  `prisma@7`, not 8, until 8 is GA and settles.
- Types stay first-class for tenant tables, and there's no second query style (unlike F).

Costs to accept: the host→User link is a scalar plus a hand-written cross-schema FK, with no
Prisma relation (joins become two queries in `src/lib/`). We own a small migration runner. And
there's a per-tenant client cache whose memory must be measured.

## 8. Implementation sketch

1. **Spike first (half a day):** on local Postgres, create two `org_*` schemas. Instantiate two
   tenant clients over one `pg.Pool` with different `schema` options, then insert and read.
   Confirm with `log: ['query']` that SQL reads `"org_…"."Group"`, including enum casts and
   interactive `$transaction`. Test on 6.19 with `prisma-client-js` + adapter, and with
   `prisma-client` + `engineType = "client"`. Record the per-client heap cost.
2. **Upgrade path:** move the shared client to `@prisma/adapter-pg` (`src/lib/prisma.ts` builds
   `new PrismaClient({ adapter: new PrismaPg(pool, { schema: "public" }) })`). Ideally, do the
   Prisma 7 upgrade in its own issue before or alongside this work (`prisma-client` generator,
   `prisma.config.ts`, ESM).
3. **Pool module:** create `src/lib/db/pool.ts`. It holds one module-scope `pg.Pool`
   (`max` ≈ 5, `idleTimeoutMillis` ≈ 5000) on the pooled URL, wrapped in `attachDatabasePool`.
   `DIRECT_URL` is only for migrations.
4. **Tenant schema:** create `prisma/tenant/schema.prisma` (Group, Session, Member,
   AttendanceRecord, AttendanceAuditLog, host-assignment table) with generator
   `output = "../../src/generated/tenant-client"`. Add `prisma/tenant.config.ts` with
   `schema: "prisma/tenant/schema.prisma"` and `migrations.path: "prisma/tenant/migrations"`.
   Host IDs are `String` scalars.
5. **Author tenant migrations:** add a `db:migrate:tenant` script that runs
   `prisma migrate dev --config prisma/tenant.config.ts --create-only` against a local
   `?schema=tenant_template`. It yields unqualified `migration.sql` files. Hand-append
   cross-schema FKs such as `REFERENCES "public"."User"("id")`. Decide `ON DELETE` in the ADR,
   because a `User` delete will now check N schemas. Add a lint or test that tenant SQL never
   contains a schema-qualified `org_`/`public` name except the allowed FK targets.
6. **Bundle migrations:** a `prebuild` script generates
   `src/lib/tenancy/tenant-migrations.generated.ts` (an array of `{ id, sql, checksum }`) from
   `prisma/tenant/migrations/*/migration.sql`, so the runtime never reads files. Alternatively,
   use `outputFileTracingIncludes`.
7. **Runner:** `src/lib/tenancy/migrate-tenant.ts` exports `migrateTenant(schemaName)`, which
   validates the name with `isGeneratedSchemaName` and then, per pending migration, runs one
   `pg` transaction:
   `BEGIN; SELECT pg_advisory_xact_lock(hashtext(schemaName));`
   `SET LOCAL search_path TO "org_x";`
   `CREATE TABLE IF NOT EXISTS "_tenant_migrations"(id text primary key, checksum text, applied_at timestamptz default now());`
   then skip if already applied, run the SQL, insert the row, and `COMMIT`. It stops at the
   first failure and throws, leaving that schema at the last good version. The locks are
   transaction-scoped and `SET LOCAL`, so the runner works through a transaction pooler.
8. **Provisioning** (`schema-provisioner.ts`): replace `exec("npx prisma migrate deploy")` with
   `CREATE SCHEMA IF NOT EXISTS` plus `migrateTenant(schemaName)` in-process. This keeps the
   `SchemaProvisioner` interface and ADR-0007's synchronous approval. Set `maxDuration` on the
   approval route.
9. **Runtime helper:** `src/lib/tenancy/with-tenant.ts` exports
   `withTenant(schemaName, fn: (db: TenantPrismaClient) => Promise<T>)`. It validates the name,
   gets or creates the client from an LRU (e.g. 50 entries, keyed by `schemaName`, sharing the
   pool, never `disposeExternalPool`), and calls `fn`. The schema name comes only from the
   session user's Organization (CODING_STANDARDS §4). A lint rule stops domain code from
   importing `src/generated/tenant-client` outside this helper.
10. **Rollout over N tenants:** a `db:migrate:tenants` script (tsx) runs
    `prisma migrate deploy` for the shared schema (direct URL). It then selects `schemaName`
    from `Organization` where `status = 'APPROVED'` and calls `migrateTenant` for each with
    small concurrency. It reports a per-schema pass/fail summary and exits non-zero on any
    failure. Run it as a deploy step (CI job or Vercel build command) before traffic shifts.
    Write migrations expand/contract so old code tolerates new columns. A failed schema stays
    on the old version. Optionally `withTenant` compares the schema's latest migration id
    (cached) against the bundled list and fails closed.
11. **Clean up existing tenants:** a one-off tenant migration (or script) drops the stray
    `User`/`Organization`/`_prisma_migrations`/enum copies from existing `org_*` schemas, after
    asserting they're empty.
12. **Docs:** write the ADR that closes ADR-0003. Update CODING_STANDARDS §4 (tenant pattern,
    migrations bullet: shared migrations no longer run in tenant schemas) and `CONTEXT.md` if
    new terms appear.

### Not verified / open

- The adapter `schema` option with `prisma-client-js` on 6.19. Source-level evidence
  (quaint `External` `schema_name`) says it's honoured, but spike step 1 must confirm it, as
  must enum-type qualification.
- The memory cost per cached `PrismaClient`.
- Whether `migrate diff --from-migrations` needs a shadow DB on 6.19 (the sketch avoids it).
- Prisma 8 behaviour for adapter `schema` options (the RC API is still moving).
- Whether the current `npx` provisioner actually fails on Vercel (inferred from tracing docs,
  not observed).
