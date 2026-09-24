import type { InstitutionType } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export type PendingOrganization = {
  id: string;
  name: string;
  institutionType: InstitutionType;
  orgAdminEmail: string | null;
};

// Oldest first, so the super-admin works through signups in arrival order.
// Returns only what the review screen renders — never the full User rows
// (they carry hashedPassword).
export async function listPendingOrganizations(): Promise<PendingOrganization[]> {
  const organizations = await prisma.organization.findMany({
    where: { status: "PENDING" },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      institutionType: true,
      users: { where: { role: "ORG_ADMIN" }, select: { email: true }, take: 1 },
    },
  });

  return organizations.map(({ users, ...organization }) => ({
    ...organization,
    orgAdminEmail: users[0]?.email ?? null,
  }));
}
