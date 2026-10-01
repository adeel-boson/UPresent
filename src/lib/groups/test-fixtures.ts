import { users } from "@/lib/db/schema";
import { createApprovedTestOrganization, type TestDatabase } from "@/lib/db/testing";
import type { Email } from "@/lib/email/email-sender";

// Test-only: two approved Organizations, so every groups test can check that
// one Organization's data stays out of the other's reach.

export const SPRINGFIELD = {
  id: "springfield",
  name: "Springfield Elementary",
  schemaName: "org_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
};
export const SHELBYVILLE = {
  id: "shelbyville",
  name: "Shelbyville Elementary",
  schemaName: "org_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
};

export const springfieldAdmin = { id: "springfield-admin", email: "skinner@springfield.example" };
export const shelbyvilleAdmin = { id: "shelbyville-admin", email: "admin@shelbyville.example" };
export const springfieldHost = { id: "springfield-host", email: "hoover@springfield.example" };

export async function seedOrganizations(db: TestDatabase): Promise<void> {
  await createApprovedTestOrganization(db, SPRINGFIELD);
  await createApprovedTestOrganization(db, SHELBYVILLE);
  await db.insert(users).values([
    {
      ...springfieldAdmin,
      hashedPassword: "not-a-real-hash",
      role: "ORG_ADMIN",
      emailVerified: new Date(),
      organizationId: SPRINGFIELD.id,
    },
    {
      ...shelbyvilleAdmin,
      hashedPassword: "not-a-real-hash",
      role: "ORG_ADMIN",
      emailVerified: new Date(),
      organizationId: SHELBYVILLE.id,
    },
    {
      ...springfieldHost,
      hashedPassword: "not-a-real-hash",
      role: "HOST",
      emailVerified: new Date(),
      organizationId: SPRINGFIELD.id,
    },
  ]);
}

export function recordingSender(): { sent: Email[]; send: (email: Email) => Promise<void> } {
  const sent: Email[] = [];
  return { sent, send: async (email) => void sent.push(email) };
}

export function readToken(email: Email | undefined): string {
  const link = email?.text.match(/https?:\/\/\S+/)?.[0];
  const token = link ? new URL(link).searchParams.get("token") : null;
  if (!token) {
    throw new Error("The email carries no link with a token.");
  }
  return token;
}
