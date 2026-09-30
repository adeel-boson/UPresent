import type { Metadata } from "next";
import { z } from "zod";

import { LoginForm } from "@/app/(auth)/login/_components/login-form";

export const metadata: Metadata = {
  title: "Log in",
};

// Set by the reset-password action's redirect after a successful reset.
const searchParamsSchema = z.object({
  password: z.literal("updated"),
});

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const isPasswordUpdated = searchParamsSchema.safeParse(await searchParams).success;

  return <LoginForm isPasswordUpdated={isPasswordUpdated} />;
}
