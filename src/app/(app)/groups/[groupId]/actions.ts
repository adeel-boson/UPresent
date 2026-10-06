"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireRole } from "@/lib/auth/guards";
import { assignSelfAsHost } from "@/lib/groups/assign-self-as-host";
import { GroupNotFoundError } from "@/lib/groups/errors";
import { HostEmailNotInvitableError, inviteHost } from "@/lib/groups/invite-host";
import { addMember, MemberExternalIdTakenError } from "@/lib/members/add";
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
  name: z.string().trim().min(1).max(200),
  // An empty field means no external ID.
  externalId: z
    .string()
    .trim()
    .max(100)
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
