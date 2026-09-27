import { drizzle } from "drizzle-orm/node-postgres";

import { hashPassword } from "@/lib/auth/password";
import * as schema from "@/lib/db/schema";

import { loadEnv } from "./load-env";

loadEnv();

// Its own connection rather than `@/lib/db/client`: that module is
// `server-only`, which throws outside Next (CODING_STANDARDS §10).
const db = drizzle({ connection: process.env.DATABASE_URL ?? "", schema });

async function main() {
  // Lowercased like signup and login, which match emails case-insensitively.
  const email = process.env.SEED_SUPER_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SEED_SUPER_ADMIN_PASSWORD;

  if (!email || !password) {
    throw new Error(
      "SEED_SUPER_ADMIN_EMAIL and SEED_SUPER_ADMIN_PASSWORD must be set (see .env.example).",
    );
  }

  const hashedPassword = await hashPassword(password);

  // The password is a static local-dev value from .env, and the update
  // deliberately resets it on every run, so re-seeding always restores a
  // known login and a changed value in .env takes effect. Local dev only:
  // run against a real database, this would overwrite a real password.
  const [superAdmin] = await db
    .insert(schema.users)
    .values({ email, hashedPassword, role: "SUPER_ADMIN", emailVerified: new Date() })
    .onConflictDoUpdate({
      target: schema.users.email,
      set: { hashedPassword, role: "SUPER_ADMIN" },
    })
    .returning({ email: schema.users.email });

  console.log(`Seeded super-admin: ${superAdmin?.email}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$client.end();
  });
