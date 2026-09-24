import { ApproveButton } from "@/app/admin/signups/_components/approve-button";
import { approveSignup } from "@/app/admin/signups/actions";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { requireRole } from "@/lib/auth/guards";
import { INSTITUTION_TYPE_LABELS } from "@/lib/organizations/institution-type";
import { listPendingOrganizations } from "@/lib/organizations/list-pending";

export default async function PendingSignupsPage() {
  await requireRole("SUPER_ADMIN");
  const pendingOrganizations = await listPendingOrganizations();

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-10 sm:px-6">
      <header className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl font-semibold">Pending signup requests</h1>
        <p className="text-sm text-muted-foreground">
          Review and approve organization signups awaiting access.
        </p>
      </header>

      {pendingOrganizations.length === 0 ? (
        <p className="text-sm text-muted-foreground">No pending requests.</p>
      ) : (
        <ul className="flex flex-col gap-4">
          {pendingOrganizations.map((organization) => (
            <li key={organization.id}>
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <CardTitle>
                      <h2>{organization.name}</h2>
                    </CardTitle>
                    <Badge variant="secondary">
                      {INSTITUTION_TYPE_LABELS[organization.institutionType]}
                    </Badge>
                  </div>
                  <CardDescription>Org-admin: {organization.orgAdminEmail ?? "—"}</CardDescription>
                </CardHeader>
                <CardFooter>
                  <form action={approveSignup.bind(null, organization.id)}>
                    <ApproveButton />
                  </form>
                </CardFooter>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
