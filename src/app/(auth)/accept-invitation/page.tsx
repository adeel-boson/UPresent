import type { Metadata } from "next";
import { z } from "zod";

import { AcceptInvitationForm } from "@/app/(auth)/accept-invitation/_components/accept-invitation-form";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Accept invitation",
  // The URL carries the invitation token, so never send it on as a Referer.
  referrer: "no-referrer",
};

const searchParamsSchema = z.object({
  token: z.string().min(1),
});

// The link from a host's invitation email. It is public: the token is the
// proof. The token is only checked, and used, when the form is submitted, so
// a mail scanner that opens the link can't use it up.
export default async function AcceptInvitationPage({
  searchParams,
}: PageProps<"/accept-invitation">) {
  const parsed = searchParamsSchema.safeParse(await searchParams);

  if (!parsed.success) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">
            <h1>Link not valid</h1>
          </CardTitle>
          <CardDescription>
            This invitation link is incomplete. Open the link from your email again, or ask whoever
            invited you to send a new invitation.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return <AcceptInvitationForm token={parsed.data.token} />;
}
