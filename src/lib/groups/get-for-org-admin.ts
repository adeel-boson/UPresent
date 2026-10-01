import { asc, eq, sql } from "drizzle-orm";

import { users } from "@/lib/db/schema";
import { withTenant, type SessionCreationMode } from "@/lib/db/tenant";
import { GroupNotFoundError } from "@/lib/groups/errors";
import { loadOrgAdminActor } from "@/lib/groups/load-actor";

export type GroupHostSummary = {
  id: string;
  email: string;
  // False while an invited host hasn't set their password yet.
  hasAcceptedInvitation: boolean;
};

export type GroupDetails = {
  id: string;
  name: string;
  sessionCreationMode: SessionCreationMode;
  hosts: GroupHostSummary[];
};

export type GetGroupForOrgAdminInput = {
  actor: { id: string };
  groupId: string;
};

// One Group of the org-admin's Organization, with its hosts by email.
export async function getGroupForOrgAdmin(input: GetGroupForOrgAdminInput): Promise<GroupDetails> {
  const actor = await loadOrgAdminActor(input.actor.id);

  return withTenant(actor.organization, async ({ db, tables }) => {
    const { groups, groupHosts } = tables;
    const [group] = await db
      .select({
        id: groups.id,
        name: groups.name,
        sessionCreationMode: groups.sessionCreationMode,
      })
      .from(groups)
      .where(eq(groups.id, input.groupId));
    if (!group) {
      throw new GroupNotFoundError(input.groupId);
    }

    // A join into the shared User table; only whether a password is set
    // leaves the query, never the hash.
    const hosts = await db
      .select({
        id: users.id,
        email: users.email,
        hasAcceptedInvitation: sql<boolean>`${users.hashedPassword} IS NOT NULL`,
      })
      .from(groupHosts)
      .innerJoin(users, eq(users.id, groupHosts.hostId))
      .where(eq(groupHosts.groupId, group.id))
      .orderBy(asc(users.email));

    return { ...group, hosts };
  });
}
