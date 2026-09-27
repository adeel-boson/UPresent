import { asc, eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { organizations, users, type InstitutionType } from "@/lib/db/schema";

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
  const pending = await db.query.organizations.findMany({
    where: eq(organizations.status, "PENDING"),
    orderBy: asc(organizations.createdAt),
    columns: { id: true, name: true, institutionType: true },
    with: {
      users: { where: eq(users.role, "ORG_ADMIN"), columns: { email: true }, limit: 1 },
    },
  });

  return pending.map(({ users: orgAdmins, ...organization }) => ({
    ...organization,
    orgAdminEmail: orgAdmins[0]?.email ?? null,
  }));
}
