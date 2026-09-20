"use client";

import { useActionState } from "react";

import { signup, type SignupState } from "@/app/signup/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Alert, AlertTitle } from "@/components/ui/alert";

const initialState: SignupState = { error: null, success: false };

export default function SignupPage() {
  const [state, formAction, pending] = useActionState(signup, initialState);

  if (state.success) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4 py-10">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle className="text-xl">Request received</CardTitle>
            <CardDescription>
              Thanks — your organization signup is pending approval.
              You&apos;ll be able to log in once a super-admin approves it.
            </CardDescription>
          </CardHeader>
        </Card>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl">Sign up your organization</CardTitle>
          <CardDescription>
            Create an admin account for your school or college.
          </CardDescription>
        </CardHeader>
        <form action={formAction}>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="organizationName">Organization name</Label>
              <Input id="organizationName" name="organizationName" type="text" required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="institutionType">Institution type</Label>
              <Select name="institutionType" required>
                <SelectTrigger id="institutionType" className="w-full">
                  <SelectValue placeholder="Select one" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SCHOOL">School</SelectItem>
                  <SelectItem value="COLLEGE">College</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="adminEmail">Admin email</Label>
              <Input
                id="adminEmail"
                name="adminEmail"
                type="email"
                required
                autoComplete="email"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="adminPassword">Admin password</Label>
              <Input
                id="adminPassword"
                name="adminPassword"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
              />
            </div>
            {state.error ? (
              <Alert variant="destructive" role="alert">
                <AlertTitle>{state.error}</AlertTitle>
              </Alert>
            ) : null}
          </CardContent>
          <CardFooter>
            <Button type="submit" disabled={pending} className="w-full">
              {pending ? "Submitting…" : "Sign up"}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </main>
  );
}
