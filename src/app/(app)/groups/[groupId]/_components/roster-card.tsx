import { removeMemberFromGroup } from "@/app/(app)/groups/[groupId]/actions";
import { AddMemberForm } from "@/app/(app)/groups/[groupId]/_components/add-member-form";
import { ImportRosterForm } from "@/app/(app)/groups/[groupId]/_components/import-roster-form";
import { RemoveMemberControl } from "@/app/(app)/groups/[groupId]/_components/remove-member-control";
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

export function RosterCard({ groupId, roster }: { groupId: string; roster: Roster }) {
  const { page, pageCount } = roster;
  const hasPreviousPage = page > 1;
  const hasNextPage = page < pageCount;

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
        <section
          aria-labelledby="import-roster-heading"
          className="flex flex-col gap-3 border-t pt-6"
        >
          <h3 id="import-roster-heading" className="font-medium">
            Import from a CSV file
          </h3>
          <ImportRosterForm groupId={groupId} />
        </section>
        {roster.members.length === 0 ? (
          <p className="text-sm text-muted-foreground">No one on the roster yet.</p>
        ) : (
          <ul className="flex flex-col divide-y">
            {roster.members.map((member) => (
              <li
                key={member.id}
                className="flex flex-wrap items-center justify-between gap-2 py-2"
              >
                <span className="flex min-w-0 flex-col">
                  <span className="text-sm break-words">{member.name}</span>
                  {member.externalId ? (
                    <span className="text-xs break-all text-muted-foreground">
                      ID {member.externalId}
                    </span>
                  ) : null}
                </span>
                <RemoveMemberControl
                  memberName={member.name}
                  removeMember={removeMemberFromGroup.bind(null, groupId, member.id)}
                />
              </li>
            ))}
          </ul>
        )}
      </CardContent>
      {pageCount > 1 ? (
        <CardFooter className="flex items-center justify-between gap-4">
          {hasPreviousPage ? (
            <TextLink href={`/groups/${groupId}?page=${page - 1}`} className="text-sm">
              ← Previous
            </TextLink>
          ) : (
            <span />
          )}
          <span className="text-sm text-muted-foreground">
            Page {page} of {pageCount}
          </span>
          {hasNextPage ? (
            <TextLink href={`/groups/${groupId}?page=${page + 1}`} className="text-sm">
              Next →
            </TextLink>
          ) : (
            <span />
          )}
        </CardFooter>
      ) : null}
    </Card>
  );
}
