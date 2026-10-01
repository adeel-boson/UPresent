import type { Metadata } from "next";

import { AddGroupForm } from "@/app/(app)/groups/_components/add-group-form";
import { TextLink } from "@/components/navigation/text-link";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { requireRole } from "@/lib/auth/guards";
import { listGroupsForUser } from "@/lib/groups/list";
import { SESSION_CREATION_MODE_LABELS } from "@/lib/groups/session-creation-mode";

export const metadata: Metadata = {
  title: "Groups",
};

export default async function GroupsPage() {
  const user = await requireRole("ORG_ADMIN", "HOST");
  const groups = await listGroupsForUser(user);
  const isOrgAdmin = user.role === "ORG_ADMIN";

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl font-semibold">Groups</h1>
        <p className="text-sm text-muted-foreground">
          {isOrgAdmin ? "Every group in your organization." : "The groups you take attendance for."}
        </p>
      </header>

      {groups.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {isOrgAdmin
            ? "No groups yet. Add the first one below."
            : "You haven't been added to a group yet."}
        </p>
      ) : (
        <ul className="flex flex-col gap-4">
          {groups.map((group) => (
            <li key={group.id}>
              <Card>
                <CardHeader>
                  <CardTitle>
                    <h2>
                      {isOrgAdmin ? (
                        <TextLink href={`/groups/${group.id}`}>{group.name}</TextLink>
                      ) : (
                        group.name
                      )}
                    </h2>
                  </CardTitle>
                  <CardDescription>
                    {SESSION_CREATION_MODE_LABELS[group.sessionCreationMode]}
                  </CardDescription>
                </CardHeader>
              </Card>
            </li>
          ))}
        </ul>
      )}

      {isOrgAdmin ? <AddGroupForm /> : null}
    </div>
  );
}
