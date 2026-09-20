"use server";

import { EmailAlreadyInUseError, signUpOrganization } from "@/lib/organizations/signup";

export type SignupState = {
  error: string | null;
  success: boolean;
};

export async function signup(
  _prevState: SignupState,
  formData: FormData,
): Promise<SignupState> {
  const organizationName = formData.get("organizationName");
  const institutionType = formData.get("institutionType");
  const adminEmail = formData.get("adminEmail");
  const adminPassword = formData.get("adminPassword");

  if (
    typeof organizationName !== "string" ||
    organizationName.trim().length === 0 ||
    (institutionType !== "SCHOOL" && institutionType !== "COLLEGE") ||
    typeof adminEmail !== "string" ||
    adminEmail.trim().length === 0 ||
    typeof adminPassword !== "string" ||
    adminPassword.length < 8
  ) {
    return {
      error: "Please fill in all fields (password must be at least 8 characters).",
      success: false,
    };
  }

  try {
    await signUpOrganization({
      organizationName: organizationName.trim(),
      institutionType,
      adminEmail: adminEmail.trim(),
      adminPassword,
    });
  } catch (error) {
    if (error instanceof EmailAlreadyInUseError) {
      return { error: "That email is already in use.", success: false };
    }
    throw error;
  }

  return { error: null, success: true };
}
