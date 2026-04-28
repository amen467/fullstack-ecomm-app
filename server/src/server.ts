// server/src/server.ts
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { PrismaClient } from "./generated/client.js";
import { PrismaPg } from "@prisma/adapter-pg";

dotenv.config();

const app = express();

// Initialize Prisma Client with PostgreSQL adapter
let prisma: any;
try {
  const connectionString = process.env.DATABASE_URL || "";
  const adapter = new PrismaPg({ connectionString });
  prisma = new PrismaClient({ adapter });
} catch (error) {
  console.warn("Failed to initialize Prisma Client (database may not be running yet)");
  // Continue without Prisma for now
}

// Middleware
app.use(cors());
app.use(express.json());

// Health check with database connectivity
app.get("/api/health", async (_req, res) => {
  if (!prisma) {
    return res.status(500).json({ status: "error", database: "not_initialized" });
  }
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: "ok", database: "connected" });
  } catch (error) {
    res.status(500).json({ status: "error", database: "disconnected" });
  }
});

// Stub API routes
import authRouter from "./routes/auth.js";
import productsRouter from "./routes/products.js";
import cartRouter from "./routes/cart.js";
import ordersRouter from "./routes/orders.js";

app.use("/api/auth", authRouter);
app.use("/api/products", productsRouter);
app.use("/api/cart", cartRouter);
app.use("/api/orders", ordersRouter);

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: "Not Found" });
});

// Graceful shutdown
process.on("SIGINT", async () => {
  console.log("\nShutting down gracefully...");
  if (prisma) {
    await prisma.$disconnect();
  }
  process.exit(0);
});

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
});
