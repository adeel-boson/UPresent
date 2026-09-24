import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { approveSignup } from "@/app/admin/signups/actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";

export default async function PendingSignupsPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }
  if (session.user.role !== "SUPER_ADMIN") {
    redirect("/dashboard");
  }

  const pendingOrganizations = await prisma.organization.findMany({
    where: { status: "PENDING" },
    orderBy: { createdAt: "asc" },
    include: { users: true },
  });

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-10 sm:px-6">
      <header className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl font-semibold">
          Pending signup requests
        </h1>
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
                    <CardTitle>{organization.name}</CardTitle>
                    <Badge variant="secondary">{organization.institutionType}</Badge>
                  </div>
                  <CardDescription>
                    Admin: {organization.users[0]?.email}
                  </CardDescription>
                </CardHeader>
                <CardFooter>
                  <form
                    action={async () => {
                      "use server";
                      await approveSignup(organization.id);
                    }}
                  >
                    <Button type="submit">Approve</Button>
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
