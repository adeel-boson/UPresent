import { eq } from "drizzle-orm";

import { withTenant } from "@/lib/db/tenant";
import { GroupManagementNotPermittedError, GroupNotFoundError } from "@/lib/groups/errors";
import { loadGroupsActor } from "@/lib/groups/load-actor";

export type AssignSelfAsHostInput = {
  actor: { id: string };
  groupId: string;
};

// Makes the org-admin one of a Group's hosts, so they can take its attendance
// directly (CONTEXT.md). Their role stays ORG_ADMIN: hosting is the Group
// assignment, and an org-admin already sees every Group.
export async function assignSelfAsHost(input: AssignSelfAsHostInput): Promise<void> {
  const actor = await loadGroupsActor(input.actor.id);
  if (actor?.role !== "ORG_ADMIN") {
    throw new GroupManagementNotPermittedError(input.actor.id);
  }

  await withTenant(actor.organization, async ({ db, tables }) => {
    const [group] = await db
      .select({ id: tables.groups.id })
      .from(tables.groups)
      .where(eq(tables.groups.id, input.groupId));
    if (!group) {
      throw new GroupNotFoundError(input.groupId);
    }
    // Assigning twice changes nothing.
    await db
      .insert(tables.groupHosts)
      .values({ groupId: group.id, hostId: actor.id })
      .onConflictDoNothing();
  });
}
