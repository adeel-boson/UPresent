import type { Metadata } from "next";

import { LoginForm } from "@/app/(auth)/login/_components/login-form";

export const metadata: Metadata = {
  title: "Log in",
};

export default function LoginPage() {
  return <LoginForm />;
}
