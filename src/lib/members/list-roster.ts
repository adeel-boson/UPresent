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
  // The page shown, which is the last one when a later page was asked for.
  page: number;
  // At least 1: an empty roster is one empty page.
  pageCount: number;
};

export type ListRosterInput = {
  actor: { id: string };
  groupId: string;
  // 1-based; defaults to the first page. A page past the end shows the last
  // one, e.g. after its only Member was removed.
  page?: number;
};

// One page of a Group's roster in the org-admin's own Organization, by name.
export async function listRoster(input: ListRosterInput): Promise<Roster> {
  const actor = await loadOrgAdminActor(input.actor.id);

  return withTenant(actor.organization, async ({ db, tables }) => {
    const { groups, members } = tables;
    const [group] = await db
      .select({ id: groups.id })
      .from(groups)
      .where(eq(groups.id, input.groupId));
    if (!group) {
      throw new GroupNotFoundError(input.groupId);
    }

    const memberCount = await db.$count(members, eq(members.groupId, group.id));
    const pageCount = Math.max(1, Math.ceil(memberCount / ROSTER_PAGE_SIZE));
    const page = Math.min(input.page ?? 1, pageCount);

    // The id breaks ties between Members with the same name, so pages don't
    // overlap.
    const rows = await db
      .select({ id: members.id, name: members.name, externalId: members.externalId })
      .from(members)
      .where(eq(members.groupId, group.id))
      .orderBy(asc(members.name), asc(members.id))
      .limit(ROSTER_PAGE_SIZE)
      .offset((page - 1) * ROSTER_PAGE_SIZE);

    return { members: rows, page, pageCount };
  });
}
