"use client";

import { useActionState } from "react";

import { forgotPassword, type ForgotPasswordState } from "@/app/(auth)/forgot-password/actions";
import { FormErrorAlert } from "@/components/forms/form-error-alert";
import { TextLink } from "@/components/navigation/text-link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: ForgotPasswordState = { status: "idle" };

export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState(forgotPassword, initialState);

  if (state.status === "submitted") {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">
            <h1>Check your email</h1>
          </CardTitle>
          <CardDescription>
            If an account exists for that email, we&apos;ve emailed a link to set a new password.
            The link works once and expires in 1 hour.
          </CardDescription>
        </CardHeader>
        <CardFooter>
          <TextLink href="/login" className="text-sm">
            Back to log in
          </TextLink>
        </CardFooter>
      </Card>
    );
  }

  const email = state.status === "error" ? state.email : undefined;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">
          <h1>Forgot your password?</h1>
        </CardTitle>
        <CardDescription>
          Enter your account&apos;s email and we&apos;ll email you a link to set a new password.
        </CardDescription>
      </CardHeader>
      {/* Remount when the returned email changes: Base UI inputs read
          defaultValue only on mount, so this is how they pick it up. */}
      <form key={email ?? ""} action={formAction}>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              defaultValue={email}
            />
          </div>
          <FormErrorAlert message={state.status === "error" ? state.error : null} />
        </CardContent>
        <CardFooter className="flex flex-col gap-4">
          <Button type="submit" size="lg" disabled={pending} className="h-11 w-full">
            {pending ? "Sending…" : "Email me a link"}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            Remembered it? <TextLink href="/login">Log in</TextLink>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}
