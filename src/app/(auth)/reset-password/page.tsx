import type { Metadata } from "next";
import { z } from "zod";

import { ResetPasswordForm } from "@/app/(auth)/reset-password/_components/reset-password-form";
import { TextLink } from "@/components/navigation/text-link";
import { Card, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Reset password",
  // The URL carries the reset token, so never send it on as a Referer.
  referrer: "no-referrer",
};

const searchParamsSchema = z.object({
  token: z.string().min(1),
});

// The link from the reset email. It is public: the token is the proof. The
// token is only checked, and used, when the form is submitted, so a mail
// scanner that opens the link can't use it up.
export default async function ResetPasswordPage({ searchParams }: PageProps<"/reset-password">) {
  const parsed = searchParamsSchema.safeParse(await searchParams);

  if (!parsed.success) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">
            <h1>Link not valid</h1>
          </CardTitle>
          <CardDescription>
            This password reset link is incomplete. Open the link from your email again, or ask for
            a new one.
          </CardDescription>
        </CardHeader>
        <CardFooter>
          <TextLink href="/forgot-password" className="text-sm">
            Ask for a new link
          </TextLink>
        </CardFooter>
      </Card>
    );
  }

  return <ResetPasswordForm token={parsed.data.token} />;
}
