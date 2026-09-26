import type { Metadata } from "next";

import { SignupForm } from "@/app/(auth)/signup/_components/signup-form";

export const metadata: Metadata = {
  title: "Sign up",
};

export default function SignupPage() {
  return <SignupForm />;
}
