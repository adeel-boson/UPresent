import type { InstitutionType } from "@prisma/client";

// UI copy for each InstitutionType. Typed as a Record so adding an enum
// value in schema.prisma fails the typecheck until it has a label.
export const INSTITUTION_TYPE_LABELS: Record<InstitutionType, string> = {
  SCHOOL: "School",
  COLLEGE: "College",
};
