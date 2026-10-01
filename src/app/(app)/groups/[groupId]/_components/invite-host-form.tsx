"use client";

import { useActionState } from "react";

import { inviteHostToGroup, type InviteHostState } from "@/app/(app)/groups/[groupId]/actions";
import { FormErrorAlert } from "@/components/forms/form-error-alert";
import { Alert, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: InviteHostState = { status: "idle" };

export function InviteHostForm({ groupId }: { groupId: string }) {
  const [state, formAction, pending] = useActionState(
    inviteHostToGroup.bind(null, groupId),
    initialState,
  );

  return (
    // Remount after each result: Base UI inputs read defaultValue only on
    // mount, so this clears the field after an invite and keeps it after an
    // error.
    <form key={JSON.stringify(state)} action={formAction} className="flex flex-col gap-4">
      {state.status === "invited" && (
        <Alert role="status">
          <AlertTitle>Invitation sent to {state.email}.</AlertTitle>
        </Alert>
      )}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="off"
          defaultValue={state.status === "error" ? state.email : undefined}
        />
      </div>
      <FormErrorAlert message={state.status === "error" ? state.error : null} />
      <Button type="submit" size="lg" disabled={pending} className="h-11 w-full sm:w-auto">
        {pending ? "Sending…" : "Send invitation"}
      </Button>
    </form>
  );
}
