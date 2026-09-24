"use client";

import Link from "next/link";
import { useActionState } from "react";

import { login, type LoginState } from "@/app/login/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Alert, AlertTitle } from "@/components/ui/alert";

const initialState: LoginState = { error: null };

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(login, initialState);

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <Card className="w-full max-w-sm">
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
            {state.error ? (
              <Alert variant="destructive" role="alert">
                <AlertTitle>{state.error}</AlertTitle>
              </Alert>
            ) : null}
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <Button type="submit" size="lg" disabled={pending} className="h-11 w-full">
              {pending ? "Logging in…" : "Log in"}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              Need an account?{" "}
              <Link
                href="/signup"
                className="font-medium text-primary underline-offset-4 hover:underline"
              >
                Sign up your organization
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </main>
  );
}
