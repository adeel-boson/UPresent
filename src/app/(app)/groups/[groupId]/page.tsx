import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { takeAttendanceMyself } from "@/app/(app)/groups/[groupId]/actions";
import { InviteHostForm } from "@/app/(app)/groups/[groupId]/_components/invite-host-form";
import { TakeAttendanceMyselfButton } from "@/app/(app)/groups/[groupId]/_components/take-attendance-myself-button";
import { TextLink } from "@/components/navigation/text-link";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { requireRole } from "@/lib/auth/guards";
import { GroupNotFoundError } from "@/lib/groups/errors";
import { getGroupForOrgAdmin, type GroupDetails } from "@/lib/groups/get-for-org-admin";
import { SESSION_CREATION_MODE_LABELS } from "@/lib/groups/session-creation-mode";

export const metadata: Metadata = {
  title: "Group",
};

export default async function GroupPage({ params }: PageProps<"/groups/[groupId]">) {
  const orgAdmin = await requireRole("ORG_ADMIN");
  const { groupId } = await params;

  let group: GroupDetails;
  try {
    group = await getGroupForOrgAdmin({ actor: orgAdmin, groupId });
  } catch (error) {
    if (error instanceof GroupNotFoundError) {
      notFound();
    }
    throw error;
  }
  const isOrgAdminHosting = group.hosts.some((host) => host.id === orgAdmin.id);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <TextLink href="/groups" className="text-sm">
          ← All groups
        </TextLink>
        <h1 className="font-heading text-2xl font-semibold">{group.name}</h1>
        <p className="text-sm text-muted-foreground">
          {SESSION_CREATION_MODE_LABELS[group.sessionCreationMode]}
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>
            <h2>Who takes attendance</h2>
          </CardTitle>
          <CardDescription>
            Staff you invite set their own password from the email, then see this group when they
            log in.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {group.hosts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No one yet.</p>
          ) : (
            <ul className="flex flex-col divide-y">
              {group.hosts.map((host) => (
                <li
                  key={host.id}
                  className="flex flex-wrap items-center justify-between gap-2 py-2"
                >
                  <span className="text-sm break-all">
                    {host.email}
                    {host.id === orgAdmin.id ? " (you)" : null}
                  </span>
                  {host.hasAcceptedInvitation ? null : <Badge variant="outline">Invited</Badge>}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
        {isOrgAdminHosting ? null : (
          <CardFooter>
            <form action={takeAttendanceMyself.bind(null, group.id)}>
              <TakeAttendanceMyselfButton />
            </form>
          </CardFooter>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            <h2>Invite by email</h2>
          </CardTitle>
          <CardDescription>
            We&apos;ll email them a link to set a password. The link expires in 7 days.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <InviteHostForm groupId={group.id} />
        </CardContent>
      </Card>
    </div>
  );
}
