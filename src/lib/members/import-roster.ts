import { eq } from "drizzle-orm";

import { withTenant } from "@/lib/db/tenant";
import { GroupNotFoundError } from "@/lib/groups/errors";
import { loadOrgAdminActor } from "@/lib/groups/load-actor";
import { CsvUnclosedQuoteError, parseCsv, type CsvRecord } from "@/lib/members/csv";
import { MEMBER_EXTERNAL_ID_MAX_LENGTH, MEMBER_NAME_MAX_LENGTH } from "@/lib/members/member-fields";

export type ImportRosterInput = {
  actor: { id: string };
  groupId: string;
  csv: string;
};

export type RosterImportRejection =
  | "MISSING_NAME"
  | "NAME_TOO_LONG"
  | "EXTERNAL_ID_TOO_LONG"
  | "ALREADY_ON_ROSTER"
  | "REPEATED_IN_FILE";

export type RejectedRosterRow = {
  // The row's line in the file, counting the header as line 1.
  line: number;
  name: string;
  reason: RosterImportRejection;
};

export type RosterImportReport = {
  addedCount: number;
  rejectedRows: RejectedRosterRow[];
};

// Bounds one import's work and transaction; a whole school year's Group is
// far smaller.
const ROSTER_IMPORT_MAX_ROWS = 2000;

export type RosterCsvProblem =
  | { kind: "NO_NAME_COLUMN" }
  | { kind: "UNCLOSED_QUOTE"; line: number }
  | { kind: "TOO_MANY_ROWS"; maxRows: number };

// The file as a whole can't be imported, so nothing from it is added. Row
// problems don't throw: they're reported in RosterImportReport instead.
export class RosterCsvUnreadableError extends Error {
  constructor(readonly problem: RosterCsvProblem) {
    super(`The roster CSV can't be imported: ${problem.kind}.`);
    this.name = "RosterCsvUnreadableError";
  }
}

type CsvMember = { line: number; name: string; externalId: string | undefined };

export async function importRoster(input: ImportRosterInput): Promise<RosterImportReport> {
  const actor = await loadOrgAdminActor(input.actor.id);
  const csvMembers = readCsvMembers(input.csv);

  return withTenant(actor.organization, async ({ db, tables }) => {
    const { groups, members } = tables;
    return db.transaction(async (tx) => {
      // Locking the Group serializes imports into it, so two concurrent
      // imports of the same file can't both pass the duplicate check below.
      const [group] = await tx
        .select({ id: groups.id })
        .from(groups)
        .where(eq(groups.id, input.groupId))
        .for("update");
      if (!group) {
        throw new GroupNotFoundError(input.groupId);
      }

      const onRoster = new Set(
        (
          await tx
            .select({ name: members.name, externalId: members.externalId })
            .from(members)
            .where(eq(members.groupId, group.id))
        ).map(identityOf),
      );
      const inFile = new Set<string>();
      const toAdd: CsvMember[] = [];
      const rejectedRows: RejectedRosterRow[] = [];
      for (const csvMember of csvMembers) {
        const identity = identityOf(csvMember);
        const reason =
          fieldRejectionOf(csvMember) ??
          (onRoster.has(identity)
            ? "ALREADY_ON_ROSTER"
            : inFile.has(identity)
              ? "REPEATED_IN_FILE"
              : undefined);
        if (reason) {
          rejectedRows.push({ line: csvMember.line, name: csvMember.name, reason });
        } else {
          inFile.add(identity);
          toAdd.push(csvMember);
        }
      }

      if (toAdd.length === 0) {
        return { addedCount: 0, rejectedRows };
      }
      // The Group lock doesn't hold off a Member added by hand meanwhile, so
      // the unique index has the last word on IDs: a row it refuses is on
      // the roster after all, not a reason to fail the whole import.
      const added = await tx
        .insert(members)
        .values(toAdd.map(({ name, externalId }) => ({ groupId: group.id, name, externalId })))
        .onConflictDoNothing()
        .returning({ externalId: members.externalId });
      const addedExternalIds = new Set(added.map(({ externalId }) => externalId));
      for (const { line, name, externalId } of toAdd) {
        if (externalId && !addedExternalIds.has(externalId)) {
          rejectedRows.push({ line, name, reason: "ALREADY_ON_ROSTER" });
        }
      }
      rejectedRows.sort((a, b) => a.line - b.line);
      return { addedCount: added.length, rejectedRows };
    });
  });
}

// The header row names the columns, matched ignoring case, spaces, and
// punctuation: "Name", and optionally "ID" or "External ID". Other columns
// are ignored, so a school's own export can be uploaded as it is.
function readCsvMembers(csv: string): CsvMember[] {
  let header: CsvRecord | undefined;
  let records: CsvRecord[];
  try {
    [header, ...records] = parseCsv(csv);
  } catch (error) {
    if (error instanceof CsvUnclosedQuoteError) {
      throw new RosterCsvUnreadableError({ kind: "UNCLOSED_QUOTE", line: error.line });
    }
    throw error;
  }
  const columns = (header?.fields ?? []).map((title) =>
    title.toLowerCase().replace(/[^a-z0-9]/g, ""),
  );
  const nameColumn = columns.indexOf("name");
  const externalIdColumn = columns.findIndex((title) => title === "id" || title === "externalid");
  if (nameColumn === -1) {
    throw new RosterCsvUnreadableError({ kind: "NO_NAME_COLUMN" });
  }
  if (records.length > ROSTER_IMPORT_MAX_ROWS) {
    throw new RosterCsvUnreadableError({ kind: "TOO_MANY_ROWS", maxRows: ROSTER_IMPORT_MAX_ROWS });
  }

  return records.map(({ line, fields }) => ({
    line,
    name: normalizeName(fields[nameColumn] ?? ""),
    externalId: (fields[externalIdColumn] ?? "").trim() || undefined,
  }));
}

// Who a row is, for spotting the same Member twice: their external ID when
// they have one (ignoring case, as the unique index does), otherwise their
// name among Members without an ID, so re-importing a file adds no one twice.
function identityOf(member: { name: string; externalId?: string | null }): string {
  return member.externalId
    ? `id:${member.externalId.toLowerCase()}`
    : `name:${normalizeName(member.name).toLowerCase()}`;
}

// A cell's line breaks and runs of spaces are spreadsheet formatting, not
// part of the name; names already on the roster are compared the same way.
function normalizeName(name: string): string {
  return name.replace(/\s+/g, " ").trim();
}

function fieldRejectionOf(member: CsvMember): RosterImportRejection | undefined {
  if (member.name === "") return "MISSING_NAME";
  if (member.name.length > MEMBER_NAME_MAX_LENGTH) return "NAME_TOO_LONG";
  if (member.externalId && member.externalId.length > MEMBER_EXTERNAL_ID_MAX_LENGTH) {
    return "EXTERNAL_ID_TOO_LONG";
  }
  return undefined;
}
