"use client";

import { useActionState } from "react";

import { setNewPassword, type SetNewPasswordState } from "@/app/(auth)/reset-password/actions";
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
import { PASSWORD_MIN_LENGTH } from "@/lib/auth/password-rule";

const initialState: SetNewPasswordState = { error: null };

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState(setNewPassword, initialState);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">
          <h1>Set a new password</h1>
        </CardTitle>
        <CardDescription>
          Choose a password of at least {PASSWORD_MIN_LENGTH} characters.
        </CardDescription>
      </CardHeader>
      <form action={formAction}>
        <input type="hidden" name="token" value={token} />
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="password">New password</Label>
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
            <Label htmlFor="confirmPassword">Confirm new password</Label>
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
        <CardFooter className="flex flex-col gap-4">
          <Button type="submit" size="lg" disabled={pending} className="h-11 w-full">
            {pending ? "Saving…" : "Set new password"}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            Link expired? <TextLink href="/forgot-password">Ask for a new one</TextLink>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}
