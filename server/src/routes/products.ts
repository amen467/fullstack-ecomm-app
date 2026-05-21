import { Router } from "express";
import type { Prisma } from "../generated/client.js";
import { NotFoundError, ServiceUnavailableError } from "../errors/http.js";
import { prisma } from "../lib/prisma.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { validateParams } from "../middleware/validation.js";
import { productParamsSchema, type ProductParams } from "../validation/products.js";

const router = Router();

router.get("/", asyncHandler(async (_req, res) => {
  if (!prisma) {
    throw new ServiceUnavailableError("Database is not available");
  }

  const products = await prisma.product.findMany({
    orderBy: { id: "asc" },
    select: productSelect,
  });

  res.json({
    products: products.map(serializeProduct),
  });
}));

router.get("/:id", validateParams(productParamsSchema), asyncHandler(async (req, res) => {
  if (!prisma) {
    throw new ServiceUnavailableError("Database is not available");
  }

  const { id } = req.params as unknown as ProductParams;

  const product = await prisma.product.findUnique({
    where: { id },
    select: productSelect,
  });

  if (!product) {
    throw new NotFoundError("Product not found");
  }

  res.json({ product: serializeProduct(product) });
}));

router.post("/", (_req, res) => {
  res.status(501).json({ error: "Not implemented" });
});

router.patch("/:id", (_req, res) => {
  res.status(501).json({ error: "Not implemented" });
});

router.delete("/:id", (_req, res) => {
  res.status(501).json({ error: "Not implemented" });
});

const productSelect = {
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
} as const;

function serializeProduct(product: ProductWithCategory) {
  return {
    ...product,
    price: product.price.toString(),
  };
}

type ProductWithCategory = Prisma.ProductGetPayload<{ select: typeof productSelect }>;

export default router;
