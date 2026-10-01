"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireRole } from "@/lib/auth/guards";
import { createGroup, SESSION_CREATION_MODES } from "@/lib/groups/create";

// What the form re-renders with after a failed submit, so the user doesn't
// retype it.
export type AddGroupFields = {
  name: string;
  sessionCreationMode: string;
};

export type AddGroupState =
  { status: "idle" } | { status: "error"; error: string; fields: AddGroupFields };

const addGroupSchema = z.object({
  name: z.string().trim().min(1).max(200),
  sessionCreationMode: z.enum(SESSION_CREATION_MODES),
});

export async function addGroup(
  _prevState: AddGroupState,
  formData: FormData,
): Promise<AddGroupState> {
  const orgAdmin = await requireRole("ORG_ADMIN");
  const parsed = addGroupSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const text = (name: keyof AddGroupFields) => {
      const value = formData.get(name);
      return typeof value === "string" ? value : "";
    };
    return {
      status: "error",
      error: "Enter a name and choose how sessions are created.",
      fields: { name: text("name"), sessionCreationMode: text("sessionCreationMode") },
    };
  }

  const { id } = await createGroup({ actor: orgAdmin, ...parsed.data });

  revalidatePath("/groups");
  redirect(`/groups/${id}`);
}
