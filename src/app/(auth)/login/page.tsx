"use client";

import { useActionState } from "react";

import { login, type LoginState } from "@/app/(auth)/login/actions";
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

const initialState: LoginState = { error: null };

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(login, initialState);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">
          <h1>Log in</h1>
        </CardTitle>
        <CardDescription>Enter your email and password to access your account.</CardDescription>
      </CardHeader>
      <form action={formAction}>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" required autoComplete="email" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
            />
          </div>
          <FormErrorAlert message={state.error} />
        </CardContent>
        <CardFooter className="flex flex-col gap-4">
          <Button type="submit" size="lg" disabled={pending} className="h-11 w-full">
            {pending ? "Logging in…" : "Log in"}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            Need an account? <TextLink href="/signup">Sign up your organization</TextLink>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}
