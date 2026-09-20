import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { approveSignup } from "@/app/admin/signups/actions";

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
    <main style={{ maxWidth: 640, margin: "4rem auto", fontFamily: "sans-serif" }}>
      <h1>Pending signup requests</h1>
      {pendingOrganizations.length === 0 ? (
        <p>No pending requests.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, display: "flex", flexDirection: "column", gap: "1rem" }}>
          {pendingOrganizations.map((organization) => (
            <li
              key={organization.id}
              style={{ border: "1px solid #ccc", borderRadius: 4, padding: "1rem" }}
            >
              <p>
                <strong>{organization.name}</strong> ({organization.institutionType})
              </p>
              <p>Admin: {organization.users[0]?.email}</p>
              <form
                action={async () => {
                  "use server";
                  await approveSignup(organization.id);
                }}
              >
                <button type="submit">Approve</button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
