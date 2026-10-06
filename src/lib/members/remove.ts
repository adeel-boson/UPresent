import { and, eq } from "drizzle-orm";

import { withTenant } from "@/lib/db/tenant";
import { loadOrgAdminActor } from "@/lib/groups/load-actor";

export type RemoveMemberInput = {
  // The signed-in user; their role and Organization are loaded from it.
  actor: { id: string };
  groupId: string;
  memberId: string;
};

// Takes a Member off a Group's roster in the org-admin's own Organization. A
// Member is only a roster entry, so removing one deletes it. Deleting roster
// data re-checks the role here, from the database (CODING_STANDARDS §10).
export async function removeMember(input: RemoveMemberInput): Promise<void> {
  const actor = await loadOrgAdminActor(input.actor.id);

  await withTenant(actor.organization, async ({ db, tables }) => {
    const { members } = tables;
    // Matching the Group too means a Member is only ever removed from the
    // roster the org-admin is looking at.
    const removed = await db
      .delete(members)
      .where(and(eq(members.id, input.memberId), eq(members.groupId, input.groupId)))
      .returning({ id: members.id });
    if (removed.length === 0) {
      throw new MemberNotFoundError(input.memberId);
    }
  });
}

// Also thrown for a Member of another Group or Organization.
export class MemberNotFoundError extends Error {
  constructor(memberId: string) {
    super(`Member ${memberId} not found.`);
    this.name = "MemberNotFoundError";
  }
}
