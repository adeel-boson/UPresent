"use client";

import { useActionState } from "react";

import { signup, type SignupState } from "@/app/(auth)/signup/actions";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { INSTITUTION_TYPE_LABELS } from "@/lib/organizations/institution-type";

const initialState: SignupState = { status: "idle" };

export function SignupForm() {
  const [state, formAction, pending] = useActionState(signup, initialState);

  if (state.status === "submitted") {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">
            <h1>Request received</h1>
          </CardTitle>
          <CardDescription>
            Thanks — your organization signup is pending approval. You&apos;ll be able to log in
            once a super-admin approves it.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const fields = state.status === "error" ? state.fields : undefined;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">
          <h1>Sign up your organization</h1>
        </CardTitle>
        <CardDescription>Create the org-admin account for your school or college.</CardDescription>
      </CardHeader>
      {/* Remount when the returned fields change: Base UI inputs read
          defaultValue only on mount, so this is how they pick it up. */}
      <form key={JSON.stringify(fields ?? null)} action={formAction}>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="organizationName">Organization name</Label>
            <Input
              id="organizationName"
              name="organizationName"
              type="text"
              required
              defaultValue={fields?.organizationName}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="institutionType">Institution type</Label>
            <Select
              name="institutionType"
              items={INSTITUTION_TYPE_LABELS}
              required
              defaultValue={fields?.institutionType || null}
            >
              <SelectTrigger id="institutionType" className="w-full">
                <SelectValue placeholder="Select one" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(INSTITUTION_TYPE_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="orgAdminEmail">Your email</Label>
            <Input
              id="orgAdminEmail"
              name="orgAdminEmail"
              type="email"
              required
              autoComplete="email"
              defaultValue={fields?.orgAdminEmail}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="orgAdminPassword">Password</Label>
            <Input
              id="orgAdminPassword"
              name="orgAdminPassword"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
            />
          </div>
          <FormErrorAlert message={state.status === "error" ? state.error : null} />
        </CardContent>
        <CardFooter>
          <Button type="submit" size="lg" disabled={pending} className="h-11 w-full">
            {pending ? "Submitting…" : "Sign up"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
