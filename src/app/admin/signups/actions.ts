"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireRole } from "@/lib/auth/guards";
import { approveOrganization, OrganizationNotPendingError } from "@/lib/organizations/approve";

const organizationIdSchema = z.string().min(1);

export async function approveSignup(organizationId: string): Promise<void> {
  const superAdmin = await requireRole("SUPER_ADMIN");

  try {
    await approveOrganization({
      organizationId: organizationIdSchema.parse(organizationId),
      approver: superAdmin,
    });
  } catch (error) {
    // A double-click or a second super-admin got there first: the
    // Organization is approved either way, so just refresh the list.
    if (!(error instanceof OrganizationNotPendingError)) {
      throw error;
    }
  }
  revalidatePath("/admin/signups");
}
