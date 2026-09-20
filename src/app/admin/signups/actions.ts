"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/lib/auth";
import { approveOrganization } from "@/lib/organizations/approve";

export async function approveSignup(organizationId: string): Promise<void> {
  const session = await auth();
  if (session?.user.role !== "SUPER_ADMIN") {
    throw new Error("Forbidden");
  }

  await approveOrganization(organizationId);
  revalidatePath("/admin/signups");
}
