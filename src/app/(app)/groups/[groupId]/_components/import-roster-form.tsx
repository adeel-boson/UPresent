"use client";

import { useActionState } from "react";

import { importRosterToGroup, type ImportRosterState } from "@/app/(app)/groups/[groupId]/actions";
import { FormErrorAlert } from "@/components/forms/form-error-alert";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { RosterImportRejection } from "@/lib/members/import-roster";
import { MEMBER_EXTERNAL_ID_MAX_LENGTH, MEMBER_NAME_MAX_LENGTH } from "@/lib/members/member-fields";

const initialState: ImportRosterState = { status: "idle" };

const REJECTION_LABELS: Record<RosterImportRejection, string> = {
  MISSING_NAME: "no name",
  NAME_TOO_LONG: `name longer than ${MEMBER_NAME_MAX_LENGTH} characters`,
  EXTERNAL_ID_TOO_LONG: `ID longer than ${MEMBER_EXTERNAL_ID_MAX_LENGTH} characters`,
  ALREADY_ON_ROSTER: "already on the roster",
  REPEATED_IN_FILE: "appears earlier in the file",
};

export function ImportRosterForm({ groupId }: { groupId: string }) {
  const [state, formAction, pending] = useActionState(
    importRosterToGroup.bind(null, groupId),
    initialState,
  );
  const report = state.status === "imported" ? state.report : undefined;

  return (
    // Remount after each result so the file input clears.
    <form key={JSON.stringify(state)} action={formAction} className="flex flex-col gap-4">
      {report && (
        <Alert role="status">
          <AlertTitle>
            Added {report.addedCount} {report.addedCount === 1 ? "person" : "people"} to the roster.
          </AlertTitle>
          {report.rejectedRows.length > 0 && (
            <AlertDescription className="flex flex-col gap-2">
              <p>
                Skipped {report.rejectedRows.length}{" "}
                {report.rejectedRows.length === 1 ? "row" : "rows"}:
              </p>
              <ul className="flex max-h-60 flex-col gap-1 overflow-y-auto">
                {report.rejectedRows.map((row) => (
                  <li key={row.line} className="break-words">
                    Line {row.line}
                    {row.name ? ` (${row.name})` : null}: {REJECTION_LABELS[row.reason]}
                  </li>
                ))}
              </ul>
            </AlertDescription>
          )}
        </Alert>
      )}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="roster-csv">CSV file</Label>
        <Input
          id="roster-csv"
          name="file"
          type="file"
          required
          accept=".csv,text/csv"
          aria-describedby="roster-csv-hint"
          className="h-11 py-2"
        />
        <p id="roster-csv-hint" className="text-sm text-muted-foreground">
          The first row names the columns: “Name”, and optionally “ID”. Other columns are ignored.
          People already on the roster are skipped.
        </p>
      </div>
      <FormErrorAlert message={state.status === "error" ? state.error : null} />
      <Button type="submit" size="lg" disabled={pending} className="h-11 w-full sm:w-auto">
        {pending ? "Importing…" : "Import"}
      </Button>
    </form>
  );
}
