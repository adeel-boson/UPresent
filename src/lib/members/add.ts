import { eq } from "drizzle-orm";

import { isUniqueViolation } from "@/lib/db/errors";
import { withTenant } from "@/lib/db/tenant";
import { GroupNotFoundError } from "@/lib/groups/errors";
import { loadOrgAdminActor } from "@/lib/groups/load-actor";

export type AddMemberInput = {
  // The signed-in user; their role and Organization are loaded from it.
  actor: { id: string };
  groupId: string;
  name: string;
  externalId?: string;
};

// Adds one Member to a Group's roster in the org-admin's own Organization.
// Members are roster entries with no login (ADR-0005).
export async function addMember(input: AddMemberInput): Promise<{ id: string }> {
  const actor = await loadOrgAdminActor(input.actor.id);

  return withTenant(actor.organization, async ({ db, tables }) => {
    const [group] = await db
      .select({ id: tables.groups.id })
      .from(tables.groups)
      .where(eq(tables.groups.id, input.groupId));
    if (!group) {
      throw new GroupNotFoundError(input.groupId);
    }

    // The unique index is the check: two concurrent adds can't both pass it.
    let member: { id: string } | undefined;
    try {
      [member] = await db
        .insert(tables.members)
        .values({ groupId: group.id, name: input.name, externalId: input.externalId })
        .returning({ id: tables.members.id });
    } catch (error) {
      if (isUniqueViolation(error, "Member_groupId_externalId_key")) {
        throw new MemberExternalIdTakenError(group.id);
      }
      throw error;
    }
    if (!member) {
      throw new Error("Inserting the Member returned no row.");
    }
    return member;
  });
}

export class MemberExternalIdTakenError extends Error {
  constructor(groupId: string) {
    super(`Group ${groupId} already has a Member with that external ID.`);
    this.name = "MemberExternalIdTakenError";
  }
}
