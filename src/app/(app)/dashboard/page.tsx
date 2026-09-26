import { TextLink } from "@/components/navigation/text-link";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { requireUser } from "@/lib/auth/guards";

export default async function DashboardPage() {
  const user = await requireUser();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">
          <h1>Dashboard</h1>
        </CardTitle>
        <CardDescription>
          Logged in as <strong className="text-foreground">{user.email}</strong>
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div>
          <Badge variant="secondary">{user.role}</Badge>
        </div>
        {user.role === "SUPER_ADMIN" ? (
          <TextLink href="/admin/signups" className="text-sm">
            Pending signup requests
          </TextLink>
        ) : null}
      </CardContent>
    </Card>
  );
}
