import type { Role } from "@prisma/client";
import type { Session } from "next-auth";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";

export type SessionUser = Session["user"];

// The one place pages and server actions authenticate. A page's own render
// gating is not a security boundary — a server action is a public endpoint
// callable without the UI — so every entry point calls one of these first.
export async function requireUser(): Promise<SessionUser> {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }
  return session.user;
}

export async function requireRole(...allowedRoles: [Role, ...Role[]]): Promise<SessionUser> {
  const user = await requireUser();
  if (!allowedRoles.includes(user.role)) {
    redirect("/dashboard");
  }
  return user;
}
