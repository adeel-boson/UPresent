# UPresent

An attendance-tracking product for schools and colleges (v1 scope), built to extend later to universities and event organizers without a data-model rewrite.

## Language

**Organization**:
A tenant — one school, college, or (later) event organizer using the product. Owns its own `Group`s, members, and configuration (including its allowed attendance statuses and its set of `host title`s).
_Avoid_: Tenant, Institution, Account (in the multi-tenancy/data-isolation sense, "tenant" is fine as an infra term, but "Organization" is the domain noun)

**host title**:
A per-`Organization`-configured label assigned to an individual `host` (e.g., "Teacher," "Professor," "Alumni Guest," "Presenter"). Titles vary _within_ one `Organization` (a university may have both "Professor" and "Alumni Guest" hosts), so this lives on the `host`, not on the `Organization` as a single fixed value. At org creation, the `Organization`'s institution type seeds a sensible default title set, which the `org-admin` can edit afterward.
_Avoid_: Role label, Display name (this is specifically the host's title, not to be confused with the `host`/`org-admin`/`super-admin` role itself)

**Group**:
A recurring or one-off collection of people who meet together and get attendance tracked — a class, course, section, or homeroom today; an event later. Created only by an `org-admin`.
_Avoid_: Class, Course, Section, Event (these are all specific instances of the same underlying concept; use "Group" when speaking generically)

**Session**:
One specific occurrence of a `Group` meeting, at a particular date/time, that attendance is taken against. Generated either manually or from a `Group`'s recurring schedule.
_Avoid_: Meeting, Occurrence, Class period

**Member**:
A person on a `Group`'s roster whose attendance is tracked (e.g., a student). Has no login/account in v1 — added via CSV import or manual entry, not self-registration.
_Avoid_: Student, Attendee, Participant (use "Member" as the generic domain term; "student" etc. are fine in school-facing UI copy but not as the modeling term)

**AttendanceRecord**:
One row per `Member` per `Session`, holding a status and a source. The status is chosen from the owning `Organization`'s configured status set (default: Present, Absent, Late, Excused). The source records how the record was captured (manual today; camera-inferred is a future possibility) — this field exists so new capture methods can be added without a schema change.
_Avoid_: Attendance entry, Check-in (this app is proctor-marked, not self-check-in — "check-in" implies the wrong actor)

**AttendanceAuditLog**:
An immutable record of a change made to an `AttendanceRecord` after its `Session` — who changed it, when, and what it changed from/to. Exists because attendance affects academic standing and compliance reporting.
_Avoid_: History, Changelog

## Roles

**super-admin**:
Cross-tenant role, held by the product operator. Approves new `Organization` signups; has support/debug access. Not part of normal day-to-day usage.

**org-admin**:
Manages one `Organization`: creates `Group`s, invites `host`s, configures attendance statuses. Can self-assign the `host` role to take attendance directly.
_Avoid_: Admin (ambiguous with super-admin — always qualify)

**host**:
Takes attendance for the `Group`s they're assigned to. Scoped to their own `Group`s only — cannot see another host's attendance data within the same `Organization`. Displayed in the UI using its `host title`, not the literal word "host."
_Avoid_: Teacher, Instructor, Organizer (these are `host title` values, not the modeling term for the role itself)
