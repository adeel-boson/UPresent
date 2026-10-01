import type { SessionCreationMode } from "@/lib/db/tenant";

// UI copy for each SessionCreationMode. Typed as a Record so adding an enum
// value in src/lib/db/tenant-schema.ts fails the typecheck until it has a
// label.
export const SESSION_CREATION_MODE_LABELS: Record<SessionCreationMode, string> = {
  MANUAL: "Manual: add each session yourself",
  RECURRING: "Recurring: generate sessions from a weekly schedule",
};
