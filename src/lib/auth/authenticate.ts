import { eq } from "drizzle-orm";

import { verifyPassword } from "@/lib/auth/password";
import { db } from "@/lib/db/client";
import { users, type Role } from "@/lib/db/schema";

export type AuthenticateInput = {
  email: string;
  password: string;
};

export type AuthenticatedUser = {
  id: string;
  email: string;
  role: Role;
};

// Compared against when no user matches, so an unknown email costs the same
// bcrypt work as a wrong password and response time doesn't reveal which
// emails have accounts. A cost-12 hash (matching SALT_ROUNDS) of a random
// string nobody knows; it is not a credential.
const DUMMY_HASH = "$2b$12$aZ1A.CgiGM1Tf8QiIPvayeMDQqkMSwzoTc80lYCqhkN8cKTrvtrpy";

// Returns the user a login may sign in as, or null. A user tied to an
// Organization can sign in only once that Organization is approved (ADR-0007);
// super-admins belong to no Organization.
export async function authenticateUser(
  input: AuthenticateInput,
): Promise<AuthenticatedUser | null> {
  const user = await db.query.users.findFirst({
    where: eq(users.email, input.email.trim().toLowerCase()),
    columns: { id: true, email: true, role: true, hashedPassword: true },
    with: { organization: { columns: { status: true } } },
  });

  const isValidPassword = await verifyPassword(input.password, user?.hashedPassword ?? DUMMY_HASH);
  if (!user || !isValidPassword) {
    return null;
  }

  if (user.organization && user.organization.status !== "APPROVED") {
    return null;
  }

  return { id: user.id, email: user.email, role: user.role };
}
