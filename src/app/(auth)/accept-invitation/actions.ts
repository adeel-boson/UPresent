"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import {
  acceptHostInvitation,
  InvalidHostInvitationTokenError,
} from "@/lib/auth/accept-host-invitation";
import { PASSWORD_MIN_LENGTH, passwordSchema } from "@/lib/auth/password-rule";

export type AcceptInvitationState = {
  error: string | null;
};

const acceptInvitationSchema = z.object({
  token: z.string().min(1),
  password: passwordSchema,
  confirmPassword: z.string(),
});

export async function acceptInvitation(
  _prevState: AcceptInvitationState,
  formData: FormData,
): Promise<AcceptInvitationState> {
  const parsed = acceptInvitationSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: `Enter a password of at least ${PASSWORD_MIN_LENGTH} characters.` };
  }
  if (parsed.data.password !== parsed.data.confirmPassword) {
    return { error: "The two passwords don't match." };
  }

  try {
    await acceptHostInvitation({ token: parsed.data.token, password: parsed.data.password });
  } catch (error) {
    if (error instanceof InvalidHostInvitationTokenError) {
      return {
        error:
          "This invitation link is invalid, has already been used, or has expired. Ask whoever invited you to send a new invitation.",
      };
    }
    throw error;
  }

  // Not signed in automatically: login stays the one place that checks email
  // verification and Organization approval.
  redirect("/login?password=set");
}
