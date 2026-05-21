import { Router } from "express";
import { ServiceUnavailableError } from "../errors/http.js";
import { prisma } from "../lib/prisma.js";
import { asyncHandler } from "../middleware/asyncHandler.js";

const router = Router();

router.get("/", asyncHandler(async (_req, res) => {
  if (!prisma) {
    throw new ServiceUnavailableError("Database is not available");
  }

  const products = await prisma.product.findMany({
    orderBy: { id: "asc" },
    select: {
      id: true,
      name: true,
      description: true,
      price: true,
      imageUrl: true,
      inventoryCount: true,
      createdAt: true,
      category: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
    },
  });

  res.json({
    products: products.map((product) => ({
      ...product,
      price: product.price.toString(),
    })),
  });
}));

router.get("/:id", (_req, res) => {
  res.status(501).json({ error: "Not implemented" });
});

router.post("/", (_req, res) => {
  res.status(501).json({ error: "Not implemented" });
});

router.patch("/:id", (_req, res) => {
  res.status(501).json({ error: "Not implemented" });
});

router.delete("/:id", (_req, res) => {
  res.status(501).json({ error: "Not implemented" });
});

export default router;
