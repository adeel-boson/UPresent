import { eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { users, type Organization, type Role } from "@/lib/db/schema";

// A signed-in User as the groups modules act on them: their role and
// Organization as stored now, not as the session remembered them.
export type GroupsActor = {
  id: string;
  email: string;
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
    columns: { id: true, email: true, role: true },
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
    email: user.email,
    role: user.role,
    organization: {
      id: organization.id,
      name: organization.name,
      schemaName: organization.schemaName,
    },
  };
}
