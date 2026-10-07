"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireRole } from "@/lib/auth/guards";
import { assignSelfAsHost } from "@/lib/groups/assign-self-as-host";
import { GroupNotFoundError } from "@/lib/groups/errors";
import { HostEmailNotInvitableError, inviteHost } from "@/lib/groups/invite-host";
import { addMember, MemberExternalIdTakenError } from "@/lib/members/add";
import {
  importRoster,
  RosterCsvUnreadableError,
  type RosterCsvProblem,
  type RosterImportReport,
} from "@/lib/members/import-roster";
import { MEMBER_EXTERNAL_ID_MAX_LENGTH, MEMBER_NAME_MAX_LENGTH } from "@/lib/members/member-fields";
import { MemberNotFoundError, removeMember } from "@/lib/members/remove";

export type InviteHostState =
  | { status: "idle" }
  | { status: "error"; error: string; email: string }
  | { status: "invited"; email: string };

const groupIdSchema = z.string().min(1);

const inviteHostSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email()),
});

// Bound to the Group's id by the page (`inviteHostToGroup.bind(null, id)`).
export async function inviteHostToGroup(
  groupId: string,
  _prevState: InviteHostState,
  formData: FormData,
): Promise<InviteHostState> {
  const orgAdmin = await requireRole("ORG_ADMIN");
  const id = groupIdSchema.parse(groupId);
  const parsed = inviteHostSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const email = formData.get("email");
    return {
      status: "error",
      error: "Enter a valid email address.",
      email: typeof email === "string" ? email : "",
    };
  }

  try {
    await inviteHost({ actor: orgAdmin, groupId: id, email: parsed.data.email });
  } catch (error) {
    if (error instanceof HostEmailNotInvitableError) {
      return {
        status: "error",
        error:
          "That email already has an account that can't be added to this group. To take attendance yourself, use “Take attendance myself”.",
        email: parsed.data.email,
      };
    }
    if (error instanceof GroupNotFoundError) {
      return { status: "error", error: "This group no longer exists.", email: parsed.data.email };
    }
    throw error;
  }

  revalidatePath(`/groups/${id}`);
  return { status: "invited", email: parsed.data.email };
}

export async function takeAttendanceMyself(groupId: string): Promise<void> {
  const orgAdmin = await requireRole("ORG_ADMIN");
  const id = groupIdSchema.parse(groupId);

  await assignSelfAsHost({ actor: orgAdmin, groupId: id });

  revalidatePath(`/groups/${id}`);
  revalidatePath("/groups");
}

export type AddMemberState =
  | { status: "idle" }
  | { status: "error"; error: string; fields: { name: string; externalId: string } }
  | { status: "added"; name: string };

const addMemberSchema = z.object({
  name: z.string().trim().min(1).max(MEMBER_NAME_MAX_LENGTH),
  // An empty field means no external ID.
  externalId: z
    .string()
    .trim()
    .max(MEMBER_EXTERNAL_ID_MAX_LENGTH)
    .transform((value) => value || undefined),
});

// Bound to the Group's id by the page (`addMemberToGroup.bind(null, id)`).
export async function addMemberToGroup(
  groupId: string,
  _prevState: AddMemberState,
  formData: FormData,
): Promise<AddMemberState> {
  const orgAdmin = await requireRole("ORG_ADMIN");
  const id = groupIdSchema.parse(groupId);
  const parsed = addMemberSchema.safeParse(Object.fromEntries(formData));
  // What the org-admin typed, to put back in the form after an error.
  const name = formData.get("name");
  const externalId = formData.get("externalId");
  const fields = {
    name: typeof name === "string" ? name : "",
    externalId: typeof externalId === "string" ? externalId : "",
  };
  if (!parsed.success) {
    return {
      status: "error",
      error: "Enter a name of up to 200 characters, and an ID of up to 100.",
      fields,
    };
  }

  try {
    await addMember({ actor: orgAdmin, groupId: id, ...parsed.data });
  } catch (error) {
    if (error instanceof MemberExternalIdTakenError) {
      return {
        status: "error",
        error: "Someone on this roster already has that ID.",
        fields,
      };
    }
    if (error instanceof GroupNotFoundError) {
      return { status: "error", error: "This group no longer exists.", fields };
    }
    throw error;
  }

  revalidatePath(`/groups/${id}`);
  return { status: "added", name: parsed.data.name };
}

export type ImportRosterState =
  | { status: "idle" }
  | { status: "error"; error: string }
  | { status: "imported"; report: RosterImportReport };

// Under Next's default 1 MB Server Action body limit with room for the
// multipart overhead, and far more than ROSTER_IMPORT_MAX_ROWS rows need.
const ROSTER_CSV_MAX_BYTES = 512 * 1024;

const importRosterSchema = z.object({
  file: z.file().min(1).max(ROSTER_CSV_MAX_BYTES),
});

function describeCsvProblem(problem: RosterCsvProblem): string {
  switch (problem.kind) {
    case "NO_NAME_COLUMN":
      return "The first row must name the columns, with one called “Name”.";
    case "UNCLOSED_QUOTE":
      return `The quote on line ${problem.line} is never closed. Check the file and try again.`;
    case "TOO_MANY_ROWS":
      return `Import up to ${problem.maxRows} people at a time.`;
  }
}

// Bound to the Group's id by the page (`importRosterToGroup.bind(null, id)`).
export async function importRosterToGroup(
  groupId: string,
  _prevState: ImportRosterState,
  formData: FormData,
): Promise<ImportRosterState> {
  const orgAdmin = await requireRole("ORG_ADMIN");
  const id = groupIdSchema.parse(groupId);
  const parsed = importRosterSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { status: "error", error: "Choose a CSV file of up to 512 KB." };
  }

  let report: RosterImportReport;
  try {
    report = await importRoster({
      actor: orgAdmin,
      groupId: id,
      csv: await parsed.data.file.text(),
    });
  } catch (error) {
    if (error instanceof RosterCsvUnreadableError) {
      return { status: "error", error: describeCsvProblem(error.problem) };
    }
    if (error instanceof GroupNotFoundError) {
      return { status: "error", error: "This group no longer exists." };
    }
    throw error;
  }

  revalidatePath(`/groups/${id}`);
  return { status: "imported", report };
}

const memberIdSchema = z.string().min(1);

// Bound to the Group's and Member's ids by the page.
export async function removeMemberFromGroup(groupId: string, memberId: string): Promise<void> {
  const orgAdmin = await requireRole("ORG_ADMIN");
  const id = groupIdSchema.parse(groupId);
  const parsedMemberId = memberIdSchema.parse(memberId);

  try {
    await removeMember({ actor: orgAdmin, groupId: id, memberId: parsedMemberId });
  } catch (error) {
    // Already off the roster (e.g. removed in another tab): the outcome the
    // org-admin asked for, so refresh the list rather than fail.
    if (!(error instanceof MemberNotFoundError)) {
      throw error;
    }
  }

  revalidatePath(`/groups/${id}`);
}
