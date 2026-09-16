---
status: accepted
---

# Prisma as ORM; schema-per-tenant implementation pattern left open

We use **Prisma** as the ORM, despite background research during architecture discussions showing Drizzle currently ahead of Prisma on weekly npm downloads and download-growth trend (Prisma still leads on total GitHub stars and job-posting frequency). Prisma was chosen deliberately over the data: Drizzle has cleaner native support for the dynamic per-tenant schema switching that [ADR-0001](./0001-multi-tenant-schema-per-tenant-isolation.md)'s schema-per-tenant isolation requires, but Prisma was picked anyway. Recording this because a future reader comparing the two would reasonably expect Drizzle to have won.

The specific pattern for making Prisma target a tenant's schema dynamically (e.g., per-request `PrismaClient` instances with a `SET search_path`, raw `$queryRaw` schema switching, or Prisma's native multi-schema support if it proves sufficient) is **explicitly not decided here** — it's deferred to implementation planning, to be resolved by whatever turns out to be the most maintainable/widely-adopted approach at that time.
