import { withTenant, type SessionCreationMode } from "@/lib/db/tenant";
import { loadOrgAdminActor } from "@/lib/groups/load-actor";

export { SESSION_CREATION_MODES } from "@/lib/db/tenant";

export type CreateGroupInput = {
  // The signed-in user; their role and Organization are loaded from it.
  actor: { id: string };
  name: string;
  sessionCreationMode: SessionCreationMode;
};

// Creates a Group in the org-admin's own Organization. Only org-admins create
// Groups (ADR-0005), so the role is re-checked here, from the database.
export async function createGroup(input: CreateGroupInput): Promise<{ id: string }> {
  const actor = await loadOrgAdminActor(input.actor.id);

  const [group] = await withTenant(actor.organization, ({ db, tables }) =>
    db
      .insert(tables.groups)
      .values({ name: input.name, sessionCreationMode: input.sessionCreationMode })
      .returning({ id: tables.groups.id }),
  );
  if (!group) {
    throw new Error("Inserting the Group returned no row.");
  }
  return group;
}
