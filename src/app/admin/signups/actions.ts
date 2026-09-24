"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireRole } from "@/lib/auth/guards";
import { approveOrganization } from "@/lib/organizations/approve";

const organizationIdSchema = z.string().min(1);

export async function approveSignup(organizationId: string): Promise<void> {
  await requireRole("SUPER_ADMIN");

  await approveOrganization(organizationIdSchema.parse(organizationId));
  revalidatePath("/admin/signups");
}
