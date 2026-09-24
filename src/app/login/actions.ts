"use server";

import { CredentialsSignin } from "next-auth";
import { z } from "zod";

import { signIn } from "@/lib/auth";

export type LoginState = {
  error: string | null;
};

const INVALID_CREDENTIALS: LoginState = { error: "Invalid email or password." };

const loginSchema = z.object({
  email: z.string().trim().min(1),
  password: z.string().min(1),
});

export async function login(_prevState: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return INVALID_CREDENTIALS;
  }

  try {
    // Redirects (by throwing) on success, so nothing after it runs.
    await signIn("credentials", { ...parsed.data, redirectTo: "/dashboard" });
  } catch (error) {
    // Only a rejected login maps to the generic message. Anything else
    // (database down, misconfigured secret) is rethrown, not disguised as
    // bad credentials.
    if (error instanceof CredentialsSignin) {
      return INVALID_CREDENTIALS;
    }
    throw error;
  }
  return { error: null };
}
