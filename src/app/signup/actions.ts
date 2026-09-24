"use server";

import { InstitutionType } from "@prisma/client";
import { z } from "zod";

import { EmailAlreadyInUseError, signUpOrganization } from "@/lib/organizations/signup";

export type SignupState = {
  error: string | null;
  success: boolean;
};

const signupSchema = z.object({
  organizationName: z.string().trim().min(1),
  institutionType: z.enum(InstitutionType),
  adminEmail: z.string().trim().pipe(z.email()),
  adminPassword: z.string().min(8),
});

export async function signup(_prevState: SignupState, formData: FormData): Promise<SignupState> {
  const parsed = signupSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return {
      error: "Please fill in all fields (password must be at least 8 characters).",
      success: false,
    };
  }

  try {
    await signUpOrganization(parsed.data);
  } catch (error) {
    if (error instanceof EmailAlreadyInUseError) {
      return { error: "That email is already in use.", success: false };
    }
    throw error;
  }

  return { error: null, success: true };
}
