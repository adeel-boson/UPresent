import type { Metadata } from "next";
import { z } from "zod";

import { LoginForm } from "@/app/(auth)/login/_components/login-form";

export const metadata: Metadata = {
  title: "Log in",
};

// Set by the redirects after a password reset ("updated") and after a host
// accepts their invitation ("set").
const searchParamsSchema = z.object({
  password: z.enum(["updated", "set"]),
});

const PASSWORD_NOTICES = {
  updated: "Password updated. Log in with your new password.",
  set: "Password set. Log in with your email and new password.",
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const parsed = searchParamsSchema.safeParse(await searchParams);

  return <LoginForm notice={parsed.success ? PASSWORD_NOTICES[parsed.data.password] : null} />;
}
