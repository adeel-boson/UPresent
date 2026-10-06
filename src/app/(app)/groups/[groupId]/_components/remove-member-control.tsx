"use client";

import { useRef, useState } from "react";
import { flushSync, useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";

// Removing a Member deletes them for good, so the first click only asks for
// confirmation; the second one submits.
export function RemoveMemberControl({
  memberName,
  removeMember,
}: {
  memberName: string;
  removeMember: () => Promise<void>;
}) {
  const [isConfirming, setIsConfirming] = useState(false);
  const removeButtonRef = useRef<HTMLButtonElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);

  // Keep focus on the control as it swaps buttons, so keyboard and screen
  // reader users aren't dropped back at the top of the page.
  function askToConfirm() {
    flushSync(() => setIsConfirming(true));
    cancelButtonRef.current?.focus();
  }

  function cancel() {
    flushSync(() => setIsConfirming(false));
    removeButtonRef.current?.focus();
  }

  if (!isConfirming) {
    return (
      <Button
        ref={removeButtonRef}
        type="button"
        variant="outline"
        size="lg"
        aria-label={`Remove ${memberName} from the roster`}
        className="h-11"
        onClick={askToConfirm}
      >
        Remove
      </Button>
    );
  }

  return (
    <form
      action={removeMember}
      role="group"
      aria-label={`Remove ${memberName} from the roster?`}
      className="flex flex-wrap items-center justify-end gap-2"
    >
      <span className="text-sm text-muted-foreground">Remove?</span>
      <Button
        ref={cancelButtonRef}
        type="button"
        variant="outline"
        size="lg"
        className="h-11"
        onClick={cancel}
      >
        Cancel
      </Button>
      <ConfirmRemoveButton memberName={memberName} />
    </form>
  );
}

function ConfirmRemoveButton({ memberName }: { memberName: string }) {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      variant="destructive"
      size="lg"
      disabled={pending}
      aria-label={`Yes, remove ${memberName}`}
      className="h-11"
    >
      {pending ? "Removing…" : "Yes, remove"}
    </Button>
  );
}
