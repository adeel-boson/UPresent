import type { Role } from "@prisma/client";

// UI copy for each Role, in CONTEXT.md's vocabulary. Typed as a Record so
// adding an enum value in schema.prisma fails the typecheck until it has a
// label.
export const ROLE_LABELS: Record<Role, string> = {
  SUPER_ADMIN: "Super-admin",
  ORG_ADMIN: "Org-admin",
  // CONTEXT.md: a host is displayed by their host title ("Teacher",
  // "Presenter", …), never the literal word "host". Host titles aren't
  // modeled yet and nothing issues HOST, so this neutral label only covers a
  // host without a title. Once titles exist, show the host's title instead.
  HOST: "Staff",
};
