"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireRole } from "@/lib/auth/guards";
import { assignSelfAsHost } from "@/lib/groups/assign-self-as-host";
import { GroupNotFoundError } from "@/lib/groups/errors";
import { HostEmailNotInvitableError, inviteHost } from "@/lib/groups/invite-host";

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
