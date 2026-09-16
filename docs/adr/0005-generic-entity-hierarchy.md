# Generic Organization → Group → Session → AttendanceRecord hierarchy

Although v1 targets schools and colleges only, the core domain model is deliberately generic: `Organization` → `Group` → `Session` → `AttendanceRecord` (see [CONTEXT.md](../../CONTEXT.md) for definitions), rather than school-specific entities like `Class`/`Course`/`Term`. A `Group` with a single `Session` is structurally an "event," so event-organizer support later is additive, not a rewrite. `AttendanceRecord` carries a `source` field from day one (manual now; camera-inferred is a documented future possibility) so new capture methods don't require a schema migration to add.

This generality is a real trade-off: it's less immediately expressive than school-specific naming/fields would be, accepted in exchange for not having to migrate the core schema when event-organizer support is eventually built.

## Explicit scope boundaries (v1)

- No `Member` (attendee) accounts or logins — members are roster entries only, added by an `org-admin` via CSV import or manual entry.
- `Group`s are created only by an `org-admin`, never self-serve by a `teacher`.
