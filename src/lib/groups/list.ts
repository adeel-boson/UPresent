import { asc, eq } from "drizzle-orm";

import { withTenant, type SessionCreationMode } from "@/lib/db/tenant";
import { loadGroupsActor } from "@/lib/groups/load-actor";

export type GroupSummary = {
  id: string;
  name: string;
  sessionCreationMode: SessionCreationMode;
};

// The Groups a signed-in user may see, by name: every Group in the
// Organization for an org-admin, and only the Groups they host for a host
// (CONTEXT.md). Empty for a user with no approved Organization.
export async function listGroupsForUser(user: { id: string }): Promise<GroupSummary[]> {
  const actor = await loadGroupsActor(user.id);
  if (!actor) {
    return [];
  }

  return withTenant(actor.organization, ({ db, tables }) => {
    const { groups, groupHosts } = tables;
    const columns = {
      id: groups.id,
      name: groups.name,
      sessionCreationMode: groups.sessionCreationMode,
    };

    if (actor.role === "ORG_ADMIN") {
      return db.select(columns).from(groups).orderBy(asc(groups.name));
    }
    // The role scope lives in the query (CODING_STANDARDS §4).
    return db
      .select(columns)
      .from(groups)
      .innerJoin(groupHosts, eq(groupHosts.groupId, groups.id))
      .where(eq(groupHosts.hostId, actor.id))
      .orderBy(asc(groups.name));
  });
}
