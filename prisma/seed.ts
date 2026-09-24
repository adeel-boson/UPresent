import { PrismaClient } from "@prisma/client";

import { hashPassword } from "@/lib/auth/password";

const prisma = new PrismaClient();

async function main() {
  const email = process.env.SEED_SUPER_ADMIN_EMAIL;
  const password = process.env.SEED_SUPER_ADMIN_PASSWORD;

  if (!email || !password) {
    throw new Error(
      "SEED_SUPER_ADMIN_EMAIL and SEED_SUPER_ADMIN_PASSWORD must be set (see .env.example).",
    );
  }

  const hashedPassword = await hashPassword(password);

  const superAdmin = await prisma.user.upsert({
    where: { email },
    update: { hashedPassword, role: "SUPER_ADMIN" },
    create: {
      email,
      hashedPassword,
      role: "SUPER_ADMIN",
      emailVerified: new Date(),
    },
  });

  console.log(`Seeded super-admin: ${superAdmin.email}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
