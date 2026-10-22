import type { Metadata } from "next";
import { z } from "zod";

import { TextLink } from "@/components/navigation/text-link";
import { Card, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { InvalidVerificationTokenError, verifyEmail } from "@/lib/auth/verify-email";

export const metadata: Metadata = {
  title: "Verify email",
};

const searchParamsSchema = z.object({
  token: z.string().min(1),
});

// The link from the verification email. It is public: the token itself is the
// proof, and the person usually isn't signed in (they can't be, until their
// email is verified). Verifying on a GET means a mail scanner that opens the
// link verifies the address too, which still shows the link reached the
// inbox, the thing verification proves.
export default async function VerifyEmailPage({ searchParams }: PageProps<"/verify-email">) {
  const parsed = searchParamsSchema.safeParse(await searchParams);

  let isVerified = false;
  if (parsed.success) {
    try {
      await verifyEmail({ token: parsed.data.token });
      isVerified = true;
    } catch (error) {
      if (!(error instanceof InvalidVerificationTokenError)) {
        throw error;
      }
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">
          <h1>{isVerified ? "Email verified" : "Link not valid"}</h1>
        </CardTitle>
        <CardDescription>
          {isVerified
            ? "Thanks — your email is verified. You can log in once a super-admin approves your organization."
            : "This verification link is invalid, has already been used, or has expired."}
        </CardDescription>
      </CardHeader>
      <CardFooter>
        <TextLink href="/login" className="text-sm">
          Go to log in
        </TextLink>
      </CardFooter>
    </Card>
  );
}
