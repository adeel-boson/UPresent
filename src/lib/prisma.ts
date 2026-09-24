import "server-only";

import { PrismaClient } from "@prisma/client";

// Dev hot reloads re-evaluate this module; caching the client on globalThis
// stops each reload opening a new connection pool. The cast only adds that
// one optional slot to globalThis's type.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
