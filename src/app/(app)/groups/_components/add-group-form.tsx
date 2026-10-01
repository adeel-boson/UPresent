"use client";

import { useActionState } from "react";

import { addGroup, type AddGroupState } from "@/app/(app)/groups/actions";
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
import { SESSION_CREATION_MODE_LABELS } from "@/lib/groups/session-creation-mode";

const initialState: AddGroupState = { status: "idle" };

export function AddGroupForm() {
  const [state, formAction, pending] = useActionState(addGroup, initialState);
  const fields = state.status === "error" ? state.fields : undefined;

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>Add a group</h2>
        </CardTitle>
        <CardDescription>A class, course or section whose attendance is taken.</CardDescription>
      </CardHeader>
      {/* Remount when the returned fields change: Base UI inputs read
          defaultValue only on mount, so this is how they pick it up. */}
      <form key={JSON.stringify(fields ?? null)} action={formAction}>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              name="name"
              type="text"
              required
              maxLength={200}
              placeholder="e.g. Grade 4 — Room 2"
              defaultValue={fields?.name}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="sessionCreationMode">Sessions</Label>
            <Select
              name="sessionCreationMode"
              items={SESSION_CREATION_MODE_LABELS}
              required
              defaultValue={fields?.sessionCreationMode || null}
            >
              <SelectTrigger id="sessionCreationMode" className="w-full">
                <SelectValue placeholder="Select one" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(SESSION_CREATION_MODE_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <FormErrorAlert message={state.status === "error" ? state.error : null} />
        </CardContent>
        <CardFooter>
          <Button type="submit" size="lg" disabled={pending} className="h-11 w-full sm:w-auto">
            {pending ? "Adding…" : "Add group"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
