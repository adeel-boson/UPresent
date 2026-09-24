"use client";

import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";

// Approval provisions a schema synchronously and can take seconds, so the
// button reports progress and blocks a second submit meanwhile.
export function ApproveButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" size="lg" disabled={pending} className="h-11">
      {pending ? "Approving…" : "Approve"}
    </Button>
  );
}
