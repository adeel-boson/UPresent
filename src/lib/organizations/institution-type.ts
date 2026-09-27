import type { InstitutionType } from "@/lib/db/schema";

// UI copy for each InstitutionType. Typed as a Record so adding an enum
// value in src/lib/db/schema.ts fails the typecheck until it has a label.
export const INSTITUTION_TYPE_LABELS: Record<InstitutionType, string> = {
  SCHOOL: "School",
  COLLEGE: "College",
};
