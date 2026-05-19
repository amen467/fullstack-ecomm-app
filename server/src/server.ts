import { app } from "./app.js";
import { prisma } from "./lib/prisma.js";

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
