import { asc, eq } from "drizzle-orm";

import { withTenant } from "@/lib/db/tenant";
import { GroupNotFoundError } from "@/lib/groups/errors";
import { loadOrgAdminActor } from "@/lib/groups/load-actor";

export const ROSTER_PAGE_SIZE = 50;

export type RosterMember = {
  id: string;
  name: string;
  externalId: string | null;
};

export type Roster = {
  members: RosterMember[];
  hasNextPage: boolean;
};

export type ListRosterInput = {
  actor: { id: string };
  groupId: string;
  // 1-based; defaults to the first page.
  page?: number;
};

// One page of a Group's roster in the org-admin's own Organization, by name.
export async function listRoster(input: ListRosterInput): Promise<Roster> {
  const actor = await loadOrgAdminActor(input.actor.id);
  const page = input.page ?? 1;

  return withTenant(actor.organization, async ({ db, tables }) => {
    const { groups, members } = tables;
    const [group] = await db
      .select({ id: groups.id })
      .from(groups)
      .where(eq(groups.id, input.groupId));
    if (!group) {
      throw new GroupNotFoundError(input.groupId);
    }

    // One row past the page says whether another page follows. The id breaks
    // ties between Members with the same name, so pages don't overlap.
    const rows = await db
      .select({ id: members.id, name: members.name, externalId: members.externalId })
      .from(members)
      .where(eq(members.groupId, group.id))
      .orderBy(asc(members.name), asc(members.id))
      .limit(ROSTER_PAGE_SIZE + 1)
      .offset((page - 1) * ROSTER_PAGE_SIZE);

    return {
      members: rows.slice(0, ROSTER_PAGE_SIZE),
      hasNextPage: rows.length > ROSTER_PAGE_SIZE,
    };
  });
}
