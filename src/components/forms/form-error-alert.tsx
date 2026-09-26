import { Alert, AlertTitle } from "@/components/ui/alert";

// The form-level error a server action returns. role="alert" makes screen
// readers announce it when it appears after a submit.
export function FormErrorAlert({ message }: { message: string | null | undefined }) {
  if (!message) return null;

  return (
    <Alert variant="destructive" role="alert">
      <AlertTitle>{message}</AlertTitle>
    </Alert>
  );
}
