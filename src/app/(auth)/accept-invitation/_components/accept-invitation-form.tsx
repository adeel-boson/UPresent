"use client";

import { useActionState } from "react";

import {
  acceptInvitation,
  type AcceptInvitationState,
} from "@/app/(auth)/accept-invitation/actions";
import { FormErrorAlert } from "@/components/forms/form-error-alert";
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
import { PASSWORD_MIN_LENGTH } from "@/lib/auth/password-rule";

const initialState: AcceptInvitationState = { error: null };

export function AcceptInvitationForm({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState(acceptInvitation, initialState);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">
          <h1>Accept your invitation</h1>
        </CardTitle>
        <CardDescription>
          Choose a password of at least {PASSWORD_MIN_LENGTH} characters. You&apos;ll use it with
          your email to log in.
        </CardDescription>
      </CardHeader>
      <form action={formAction}>
        <input type="hidden" name="token" value={token} />
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              required
              minLength={PASSWORD_MIN_LENGTH}
              autoComplete="new-password"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="confirmPassword">Confirm password</Label>
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              required
              minLength={PASSWORD_MIN_LENGTH}
              autoComplete="new-password"
            />
          </div>
          <FormErrorAlert message={state.error} />
        </CardContent>
        <CardFooter>
          <Button type="submit" size="lg" disabled={pending} className="h-11 w-full">
            {pending ? "Saving…" : "Set password"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
