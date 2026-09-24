import Link from "next/link";

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
import { signOut } from "@/lib/auth";
import { requireUser } from "@/lib/auth/guards";

export default async function DashboardPage() {
  const user = await requireUser();

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl">Dashboard</CardTitle>
          <CardDescription>
            Logged in as <strong className="text-foreground">{user.email}</strong>
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div>
            <Badge variant="secondary">{user.role}</Badge>
          </div>
          {user.role === "SUPER_ADMIN" ? (
            <Link
              href="/admin/signups"
              className="text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              Pending signup requests
            </Link>
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
