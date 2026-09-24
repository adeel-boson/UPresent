# UPresent — v1 Project Plan

This document explains what UPresent v1 is and what it does, in plain terms, for anyone picking up the project. It's the narrative companion to [`CONTEXT.md`](../CONTEXT.md) (domain vocabulary) and [`docs/adr/`](./adr/) (why-we-decided-this records) — read those for precise definitions and rationale; this doc is the "what does the product actually do" overview.

## What UPresent is

An attendance-tracking product, initially built for **schools and colleges**, architected generically enough to extend later to universities and non-educational event organizers without a data-model rewrite.

This is a solo project (TypeScript, Next.js) built for portfolio/learning value first, with a path to becoming a real product if it proves useful.

## The core loop

1. An **Organization** (a school or college) signs up.
2. A **super-admin** (the product operator) approves the signup, which provisions that org's isolated data.
3. The **org-admin** for that Organization creates **Group**s (classes/sections) and invites **host**s (teachers) to run them.
4. The org-admin populates each Group's roster with **Member**s (students) — by CSV import or manual entry.
5. Each Group meets — either on a recurring schedule or as one-off **Session**s — and its assigned host marks attendance for every Member on the roster, per Session.
6. Org-admins and hosts view attendance reports scoped to what they're allowed to see.

## Who uses it (v1)

- **super-admin**: the product operator. Approves new Organization signups. Not part of day-to-day usage.
- **org-admin**: runs one Organization. Creates Groups, invites hosts, manages roster, configures org-level settings (attendance statuses, host titles).
- **host**: runs attendance for the Groups they're assigned to (displayed as "Teacher" by default, but the label is configurable per Organization — see `host title` in `CONTEXT.md`).
- **Member** (e.g., a student): has no login or account in v1. They exist only as roster entries whose attendance gets tracked by a host.

There is no self-check-in and no offline mode in v1 — attendance is always proctor-marked by a host, and the app requires connectivity. See [ADR-0006](./adr/0006-proctor-marked-online-only-capture.md).

## Feature scope for v1

**Organization lifecycle**

- Self-serve signup (org name, institution type, admin email+password).
- Signup sits pending until a super-admin approves it.
- Approval synchronously provisions the Organization's isolated Postgres schema.
- Email verification (via Resend) is required before an org-admin can act.

**People & roles**

- Org-admin invites hosts by email; hosts set their own password on accepting the invite.
- Org-admin can self-assign the host role to take attendance directly.
- Each host has a **host title** (e.g., "Teacher," "Professor," "Alumni Guest," "Presenter") drawn from a per-Organization-configurable list, pre-seeded based on institution type.

**Groups, Sessions, and rosters**

- Only org-admins create Groups.
- A Group's Sessions are either created manually, one at a time, or generated from a simple recurring weekly schedule (days of week + time) — the org-admin picks which mode per Group.
- No holiday/exception handling for recurring schedules in v1 — an admin manually cancels a generated Session if needed (see `docs/ideas/recurrence-holiday-calendar.md`, gitignored).
- Members are added to a Group's roster via CSV bulk import or manual one-by-one entry.

**Taking attendance**

- A host marks each roster Member's status for a Session.
- Statuses are drawn from a per-Organization-configurable list, defaulting to Present / Absent / Late / Excused.
- Edits to an AttendanceRecord are allowed only within a bounded time window after the Session, and every edit is captured in an audit log (who, when, from what to what). See [ADR-0008](./adr/0008-attendance-edit-window-with-audit-log.md).

**Reporting**

- Per-student attendance percentage over a date range.
- Per-group attendance summary.
- CSV export.
- Access is role-scoped: a host sees only their own Groups; an org-admin sees everything in their Organization.

## Explicitly out of scope for v1

These were discussed and deliberately deferred — not overlooked. Full detail is in `docs/ideas/` (gitignored, local-only):

- Camera-feed-based automatic attendance (face detection).
- Full recurrence rules with holiday-calendar/exception support.
- Per-Group override of the Organization's attendance status set.
- Student/Member accounts or self-check-in of any kind.
- Offline-tolerant attendance capture.
- Async/queued Organization provisioning (current approach is synchronous; revisit if signup volume grows).

## Tech stack

| Concern             | Choice                                           | Why                                                                                                                            |
| ------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| App framework       | Next.js (App Router), full-stack, one deployable | [ADR-0002](./adr/0002-nextjs-fullstack-on-vercel.md)                                                                           |
| Hosting             | Vercel (not yet deployed — local dev for now)    | [ADR-0002](./adr/0002-nextjs-fullstack-on-vercel.md)                                                                           |
| Database            | Postgres, one schema per Organization (tenant)   | [ADR-0001](./adr/0001-multi-tenant-schema-per-tenant-isolation.md)                                                             |
| Local dev database  | Docker Postgres                                  | —                                                                                                                              |
| ORM                 | Prisma                                           | [ADR-0003](./adr/0003-prisma-orm-tenant-pattern-deferred.md) (schema-per-tenant implementation pattern deliberately left open) |
| Auth                | Auth.js, email + password with verification      | [ADR-0004](./adr/0004-authjs-email-password.md)                                                                                |
| Transactional email | Resend                                           | —                                                                                                                              |
| Testing             | TDD from the start                               | GitHub Actions CI deferred until later                                                                                         |

## Where to look next

- [`CONTEXT.md`](../CONTEXT.md) — domain glossary (precise term definitions, what to avoid calling things).
- [`docs/adr/`](./adr/) — why each architectural decision was made, including rejected alternatives.
- GitHub Issues (`ready-for-agent` label) — the ticket breakdown of this plan into buildable vertical slices.
