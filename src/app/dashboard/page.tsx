import { redirect } from "next/navigation";

import { auth, signOut } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";

export default async function DashboardPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl">Dashboard</CardTitle>
          <CardDescription>
            Logged in as <strong className="text-foreground">{session.user.email}</strong>
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div>
            <Badge variant="secondary">{session.user.role}</Badge>
          </div>
          {session.user.role === "SUPER_ADMIN" ? (
            <a
              href="/admin/signups"
              className="text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              Pending signup requests
            </a>
          ) : null}
        </CardContent>
        <CardFooter>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
            className="w-full"
          >
            <Button type="submit" variant="outline" className="w-full">
              Log out
            </Button>
          </form>
        </CardFooter>
      </Card>
    </main>
  );
}
