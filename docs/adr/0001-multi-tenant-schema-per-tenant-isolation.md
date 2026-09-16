# Schema-per-tenant isolation for multi-tenant data

UPresent is multi-tenant SaaS (one `Organization` = one tenant: a school or college). We isolate tenant data using **one Postgres schema per tenant**, rather than the more common shared-schema-with-`organization_id`-column approach or full database-per-tenant. Schema-per-tenant gives stronger blast-radius containment than a shared schema (a query bug can't leak across tenants without an explicit schema switch) while staying cheaper to operate than database-per-tenant. This is a deliberate deviation from the "obvious" early-stage-SaaS default (shared schema + row filtering) — chosen up front because retrofitting stronger isolation later means migrating live tenant data, which is far more painful than starting with it.

## Consequences

- New tenant onboarding requires provisioning (creating + migrating) a dedicated schema, not just inserting a row — see [ADR-0007](./0007-gated-self-serve-onboarding-sync-provisioning.md).
- The ORM/data layer must support targeting a schema dynamically per request (see [ADR-0003](./0003-prisma-orm-tenant-pattern-deferred.md)).
