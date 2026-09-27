import "server-only";

import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as schema from "@/lib/db/schema";

export type Database = NodePgDatabase<typeof schema>;
export type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

// One pool per server instance, shared by the shared schema and every
// Organization's tenant schema (ADR-0009), so connection count doesn't grow
// with the number of Organizations. Sized for serverless: each function
// instance holds only a few connections, and idle ones close quickly so a
// suspended instance doesn't pin database slots.
function createPool(): Pool {
  return new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 5,
    idleTimeoutMillis: 5_000,
    connectionTimeoutMillis: 10_000,
  });
}

// Dev hot reloads re-evaluate this module; caching the pool on globalThis
// stops each reload opening a new one. The cast only adds that one optional
// slot to globalThis's type.
const globalForDb = globalThis as unknown as { databasePool: Pool | undefined };

export const pool = globalForDb.databasePool ?? createPool();

if (process.env.NODE_ENV !== "production") {
  globalForDb.databasePool = pool;
}

export const db: Database = drizzle({ client: pool, schema });
