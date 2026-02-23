import { PrismaClient } from "@/app/generated/prisma"
import { PrismaNeon } from "@prisma/adapter-neon"

// Use { connectionString } instead of neon(url) — PrismaNeon creates a
// WebSocket-based Pool internally, which supports Prisma interactive transactions
// (db.$transaction(async tx => {...})). Required for the workflow engine.
function createPrismaClient() {
  const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! })
  return new PrismaClient({ adapter })
}

// Singleton: prevents multiple PrismaClient instances during Next.js hot reload in dev
const globalForPrisma = globalThis as unknown as { db: PrismaClient }

export const db = globalForPrisma.db ?? createPrismaClient()

if (process.env.NODE_ENV !== "production") globalForPrisma.db = db
