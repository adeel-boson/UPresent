import type { Metadata } from "next";

import { ForgotPasswordForm } from "@/app/(auth)/forgot-password/_components/forgot-password-form";

export const metadata: Metadata = {
  title: "Forgot password",
};

export default function ForgotPasswordPage() {
  return <ForgotPasswordForm />;
}
