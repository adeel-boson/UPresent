"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { PASSWORD_MIN_LENGTH, passwordSchema } from "@/lib/auth/password-rule";
import { readRequestContext } from "@/lib/auth/request-context";
import { InvalidPasswordResetTokenError, resetPassword } from "@/lib/auth/reset-password";

export type SetNewPasswordState = {
  error: string | null;
};

const setNewPasswordSchema = z.object({
  token: z.string().min(1),
  password: passwordSchema,
  confirmPassword: z.string(),
});

export async function setNewPassword(
  _prevState: SetNewPasswordState,
  formData: FormData,
): Promise<SetNewPasswordState> {
  const parsed = setNewPasswordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: `Enter a new password of at least ${PASSWORD_MIN_LENGTH} characters.` };
  }
  if (parsed.data.password !== parsed.data.confirmPassword) {
    return { error: "The two passwords don't match." };
  }
  const requestContext = readRequestContext(await headers());

  try {
    await resetPassword({
      token: parsed.data.token,
      newPassword: parsed.data.password,
      requestContext,
    });
  } catch (error) {
    if (error instanceof InvalidPasswordResetTokenError) {
      return { error: "This reset link is invalid, has already been used, or has expired." };
    }
    throw error;
  }

  // Not signed in automatically: login stays the one place that checks email
  // verification and Organization approval.
  redirect("/login?password=updated");
}
