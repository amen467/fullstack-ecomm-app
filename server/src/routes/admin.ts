import { Router } from "express";
import { Prisma } from "../generated/client.js";
import { UserRole } from "../generated/enums.js";
import { prisma } from "../lib/prisma.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { ServiceUnavailableError } from "../errors/http.js";

const router = Router();

router.use(requireAuth, requireRole(UserRole.ADMIN));

router.get("/stats", asyncHandler(async (_req, res) => {
  if (!prisma) {
    throw new ServiceUnavailableError("Database is not available");
  }

  const [totalProducts, totalOrders, revenueAggregate] = await Promise.all([
    prisma.product.count(),
    prisma.order.count(),
    prisma.order.aggregate({
      _sum: {
        totalAmount: true,
      },
    }),
  ]);

  res.json({
    stats: {
      totalProducts,
      totalOrders,
      totalRevenue: (revenueAggregate._sum.totalAmount ?? new Prisma.Decimal(0)).toString(),
    },
  });
}));

export default router;
