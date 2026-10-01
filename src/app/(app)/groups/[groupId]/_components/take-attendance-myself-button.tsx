"use client";

import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";

export function TakeAttendanceMyselfButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" variant="outline" size="lg" disabled={pending} className="h-11">
      {pending ? "Adding you…" : "Take attendance myself"}
    </Button>
  );
}
