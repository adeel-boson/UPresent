"use server";

import { InstitutionType } from "@prisma/client";
import { z } from "zod";

import { EmailAlreadyInUseError, signUpOrganization } from "@/lib/organizations/signup";

// What the form re-renders with after a failed submit, so the user doesn't
// retype it. The password is deliberately never sent back.
export type SignupFields = {
  organizationName: string;
  institutionType: string;
  orgAdminEmail: string;
};

export type SignupState =
  | { status: "idle" }
  | { status: "error"; error: string; fields: SignupFields }
  | { status: "submitted" };

const signupSchema = z.object({
  organizationName: z.string().trim().min(1),
  institutionType: z.enum(InstitutionType),
  orgAdminEmail: z.string().trim().toLowerCase().pipe(z.email()),
  orgAdminPassword: z.string().min(8),
});

function readSubmittedFields(formData: FormData): SignupFields {
  const text = (name: keyof SignupFields) => {
    const value = formData.get(name);
    return typeof value === "string" ? value : "";
  };
  return {
    organizationName: text("organizationName"),
    institutionType: text("institutionType"),
    orgAdminEmail: text("orgAdminEmail"),
  };
}

export async function signup(_prevState: SignupState, formData: FormData): Promise<SignupState> {
  const parsed = signupSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return {
      status: "error",
      error: "Fill in every field with a valid email and a password of at least 8 characters.",
      fields: readSubmittedFields(formData),
    };
  }

  try {
    await signUpOrganization(parsed.data);
  } catch (error) {
    if (error instanceof EmailAlreadyInUseError) {
      return {
        status: "error",
        error: "That email is already in use.",
        fields: readSubmittedFields(formData),
      };
    }
    throw error;
  }

  return { status: "submitted" };
}
