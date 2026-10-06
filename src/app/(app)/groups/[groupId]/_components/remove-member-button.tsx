"use client";

import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";

export function RemoveMemberButton({ memberName }: { memberName: string }) {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      variant="outline"
      size="lg"
      disabled={pending}
      aria-label={`Remove ${memberName} from the roster`}
      className="h-11"
    >
      {pending ? "Removing…" : "Remove"}
    </Button>
  );
}
