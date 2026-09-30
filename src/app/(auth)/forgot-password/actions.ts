"use server";

import { headers } from "next/headers";
import { after } from "next/server";
import { z } from "zod";

import { readRequestContext } from "@/app/(auth)/_lib/read-request-context";
import { requestPasswordReset } from "@/lib/auth/request-password-reset";

export type ForgotPasswordState =
  { status: "idle" } | { status: "error"; error: string; email: string } | { status: "submitted" };

const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email()),
});

export async function sendPasswordResetLink(
  _prevState: ForgotPasswordState,
  formData: FormData,
): Promise<ForgotPasswordState> {
  const parsed = forgotPasswordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const email = formData.get("email");
    return {
      status: "error",
      error: "Enter a valid email address.",
      email: typeof email === "string" ? email : "",
    };
  }

  const requestContext = readRequestContext(await headers());
  // Runs after the response is sent, so the response looks and takes the same
  // whether or not the email has an account: sending the email would
  // otherwise make known emails measurably slower (CODING_STANDARDS §10).
  after(() => requestPasswordReset({ email: parsed.data.email, requestContext }));

  return { status: "submitted" };
}
