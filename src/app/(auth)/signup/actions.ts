"use server";

import { z } from "zod";

import { institutionTypeEnum } from "@/lib/db/schema";
import { signUpOrganization } from "@/lib/organizations/signup";

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
  institutionType: z.enum(institutionTypeEnum.enumValues),
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

  // Resolves the same whether or not the email already has an account (the
  // owner is emailed instead), so this never reveals which emails do.
  await signUpOrganization(parsed.data);

  return { status: "submitted" };
}
