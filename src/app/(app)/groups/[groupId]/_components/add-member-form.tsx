"use client";

import { useActionState } from "react";

import { addMemberToGroup, type AddMemberState } from "@/app/(app)/groups/[groupId]/actions";
import { FormErrorAlert } from "@/components/forms/form-error-alert";
import { Alert, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MEMBER_EXTERNAL_ID_MAX_LENGTH, MEMBER_NAME_MAX_LENGTH } from "@/lib/members/member-fields";

const initialState: AddMemberState = { status: "idle" };

export function AddMemberForm({ groupId }: { groupId: string }) {
  const [state, formAction, pending] = useActionState(
    addMemberToGroup.bind(null, groupId),
    initialState,
  );
  const fields = state.status === "error" ? state.fields : undefined;

  return (
    // Remount after each result: Base UI inputs read defaultValue only on
    // mount, so this clears the fields after an add and keeps them after an
    // error.
    <form key={JSON.stringify(state)} action={formAction} className="flex flex-col gap-4">
      {state.status === "added" && (
        <Alert role="status">
          <AlertTitle>Added {state.name} to the roster.</AlertTitle>
        </Alert>
      )}
      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="flex flex-1 flex-col gap-1.5">
          <Label htmlFor="member-name">Name</Label>
          <Input
            id="member-name"
            name="name"
            type="text"
            required
            maxLength={MEMBER_NAME_MAX_LENGTH}
            autoComplete="off"
            defaultValue={fields?.name}
          />
        </div>
        <div className="flex flex-col gap-1.5 sm:w-48">
          <Label htmlFor="member-external-id">ID (optional)</Label>
          <Input
            id="member-external-id"
            name="externalId"
            type="text"
            maxLength={MEMBER_EXTERNAL_ID_MAX_LENGTH}
            autoComplete="off"
            placeholder="e.g. student number"
            defaultValue={fields?.externalId}
          />
        </div>
      </div>
      <FormErrorAlert message={state.status === "error" ? state.error : null} />
      <Button type="submit" size="lg" disabled={pending} className="h-11 w-full sm:w-auto">
        {pending ? "Adding…" : "Add to roster"}
      </Button>
    </form>
  );
}
