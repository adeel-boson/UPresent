import { eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { users, type Organization, type Role } from "@/lib/db/schema";
import { GroupManagementNotPermittedError } from "@/lib/groups/errors";

// A signed-in User as the groups modules act on them: their role and
// Organization as stored now, not as the session remembered them.
export type GroupsActor = {
  id: string;
  role: Role;
  organization: Pick<Organization, "id" | "name" | "schemaName">;
};

// Loads the User behind a session's user id together with the Organization
// whose tenant schema they may reach. Tenant scope comes from this record,
// never from anything the request names (CODING_STANDARDS §4). Null for a
// User with no Organization (a super-admin), or whose Organization isn't
// approved and so has no tenant schema yet.
export async function loadGroupsActor(userId: string): Promise<GroupsActor | null> {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { id: true, role: true },
    with: {
      organization: { columns: { id: true, name: true, schemaName: true, status: true } },
    },
  });
  const organization = user?.organization;
  if (!user || !organization || organization.status !== "APPROVED") {
    return null;
  }
  return {
    id: user.id,
    role: user.role,
    organization: {
      id: organization.id,
      name: organization.name,
      schemaName: organization.schemaName,
    },
  };
}

// The same, for the use cases only an org-admin may run (ADR-0005). The role
// is re-checked here, from the database, rather than trusting the caller's
// guard (CODING_STANDARDS §10).
export async function loadOrgAdminActor(userId: string): Promise<GroupsActor> {
  const actor = await loadGroupsActor(userId);
  if (actor?.role !== "ORG_ADMIN") {
    throw new GroupManagementNotPermittedError(userId);
  }
  return actor;
}
