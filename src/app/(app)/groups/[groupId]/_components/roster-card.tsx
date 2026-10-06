import { removeMemberFromGroup } from "@/app/(app)/groups/[groupId]/actions";
import { AddMemberForm } from "@/app/(app)/groups/[groupId]/_components/add-member-form";
import { RemoveMemberButton } from "@/app/(app)/groups/[groupId]/_components/remove-member-button";
import { TextLink } from "@/components/navigation/text-link";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import type { Roster } from "@/lib/members/list-roster";

export function RosterCard({
  groupId,
  roster,
  page,
}: {
  groupId: string;
  roster: Roster;
  page: number;
}) {
  const hasPreviousPage = page > 1;

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>Roster</h2>
        </CardTitle>
        <CardDescription>
          The people whose attendance is taken in this group. They don&apos;t need an account.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <AddMemberForm groupId={groupId} />
        {roster.members.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {hasPreviousPage ? "No one on this page." : "No one on the roster yet."}
          </p>
        ) : (
          <ul className="flex flex-col divide-y">
            {roster.members.map((member) => (
              <li key={member.id} className="flex items-center justify-between gap-2 py-2">
                <span className="flex min-w-0 flex-col">
                  <span className="text-sm break-words">{member.name}</span>
                  {member.externalId ? (
                    <span className="text-xs break-all text-muted-foreground">
                      ID {member.externalId}
                    </span>
                  ) : null}
                </span>
                <form action={removeMemberFromGroup.bind(null, groupId, member.id)}>
                  <RemoveMemberButton memberName={member.name} />
                </form>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
      {hasPreviousPage || roster.hasNextPage ? (
        <CardFooter className="flex justify-between gap-4">
          {hasPreviousPage ? (
            <TextLink href={`/groups/${groupId}?page=${page - 1}`} className="text-sm">
              ← Previous
            </TextLink>
          ) : (
            <span />
          )}
          {roster.hasNextPage ? (
            <TextLink href={`/groups/${groupId}?page=${page + 1}`} className="text-sm">
              Next →
            </TextLink>
          ) : null}
        </CardFooter>
      ) : null}
    </Card>
  );
}
