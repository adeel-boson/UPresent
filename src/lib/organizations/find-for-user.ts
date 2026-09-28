import { eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";

export type UserOrganization = {
  name: string;
};

// The Organization the signed-in user belongs to, looked up from their own
// User record (the session's user id), never from anything the request names
// (CODING_STANDARDS §4). Null for a super-admin, who belongs to none.
export async function findOrganizationOfUser(userId: string): Promise<UserOrganization | null> {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: {},
    with: { organization: { columns: { name: true } } },
  });
  return user?.organization ?? null;
}
