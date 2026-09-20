import { redirect } from "next/navigation";

import { auth, signOut } from "@/lib/auth";

export default async function DashboardPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  return (
    <main style={{ maxWidth: 480, margin: "4rem auto", fontFamily: "sans-serif" }}>
      <h1>Dashboard</h1>
      <p>
        Logged in as <strong>{session.user.email}</strong> ({session.user.role})
      </p>
      {session.user.role === "SUPER_ADMIN" ? (
        <p>
          <a href="/admin/signups">Pending signup requests</a>
        </p>
      ) : null}
      <form
        action={async () => {
          "use server";
          await signOut({ redirectTo: "/login" });
        }}
      >
        <button type="submit">Log out</button>
      </form>
    </main>
  );
}
