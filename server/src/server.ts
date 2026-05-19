// server/src/server.ts
import express from "express";
import cors from "cors";
import { prisma } from "./lib/prisma.js";

const app = express();
const HEALTH_CHECK_TIMEOUT_MS = 5_000;

// Middleware
app.use(cors());
app.use(express.json());

// Health check with database connectivity
app.get("/api/health", async (_req, res) => {
  if (!prisma) {
    return res.status(500).json({ status: "error", database: "not_initialized" });
  }
  try {
    await withTimeout(prisma.$queryRaw`SELECT 1`, HEALTH_CHECK_TIMEOUT_MS);
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

function withTimeout<T>(promise: Promise<T>, timeoutMs: number) {
  return Promise.race([
    promise,
    new Promise<never>((_resolve, reject) => {
      setTimeout(() => reject(new Error("Operation timed out")), timeoutMs);
    }),
  ]);
}
