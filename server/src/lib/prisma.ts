import dotenv from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/client.js";

dotenv.config();

let prisma: PrismaClient | null = null;

try {
  const connectionString = process.env.DATABASE_URL || "";
  const adapter = new PrismaPg({
    connectionString,
    connectionTimeoutMillis: 5_000,
  });
  prisma = new PrismaClient({ adapter });
} catch {
  console.warn("Failed to initialize Prisma Client (database may not be running yet)");
}

export { prisma };
