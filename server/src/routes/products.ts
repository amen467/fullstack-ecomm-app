import { Router } from "express";
import type { Prisma } from "../generated/client.js";
import { ConflictError, NotFoundError, ServiceUnavailableError } from "../errors/http.js";
import { UserRole } from "../generated/enums.js";
import { prisma } from "../lib/prisma.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { validateBody, validateParams, validateQuery } from "../middleware/validation.js";
import {
  createProductSchema,
  productListQuerySchema,
  productParamsSchema,
  updateProductSchema,
  type CreateProductBody,
  type ProductListQuery,
  type ProductParams,
  type UpdateProductBody,
} from "../validation/products.js";

const router = Router();

router.get("/", validateQuery(productListQuerySchema), asyncHandler(async (req, res) => {
  if (!prisma) {
    throw new ServiceUnavailableError("Database is not available");
  }

  const query = req.query as unknown as ProductListQuery;
  const products = await prisma.product.findMany({
    where: buildProductListWhere(query),
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

const requireAdmin = [requireAuth, requireRole(UserRole.ADMIN)] as const;

router.post(
  "/",
  ...requireAdmin,
  validateBody(createProductSchema),
  asyncHandler(async (req, res) => {
    if (!prisma) {
      throw new ServiceUnavailableError("Database is not available");
    }

    const body = req.body as CreateProductBody;
    await assertCategoryExists(body.categoryId);

    const product = await prisma.product.create({
      data: {
        name: body.name,
        description: body.description,
        price: body.price,
        imageUrl: body.imageUrl,
        inventoryCount: body.inventoryCount,
        categoryId: body.categoryId,
      },
      select: productSelect,
    });

    res.status(201).json({ product: serializeProduct(product) });
  }),
);

router.patch(
  "/:id",
  ...requireAdmin,
  validateParams(productParamsSchema),
  validateBody(updateProductSchema),
  asyncHandler(async (req, res) => {
    if (!prisma) {
      throw new ServiceUnavailableError("Database is not available");
    }

    const { id } = req.params as unknown as ProductParams;
    const body = req.body as UpdateProductBody;

    await assertProductExists(id);

    if (body.categoryId !== undefined) {
      await assertCategoryExists(body.categoryId);
    }

    const product = await prisma.product.update({
      where: { id },
      data: buildProductUpdateData(body),
      select: productSelect,
    });

    res.json({ product: serializeProduct(product) });
  }),
);

router.delete(
  "/:id",
  ...requireAdmin,
  validateParams(productParamsSchema),
  asyncHandler(async (req, res) => {
    if (!prisma) {
      throw new ServiceUnavailableError("Database is not available");
    }

    const { id } = req.params as unknown as ProductParams;
    await assertProductExists(id);

    const orderItemCount = await prisma.orderItem.count({
      where: { productId: id },
    });

    if (orderItemCount > 0) {
      throw new ConflictError("Product has existing orders");
    }

    await prisma.$transaction([
      prisma.cartItem.deleteMany({
        where: { productId: id },
      }),
      prisma.product.delete({
        where: { id },
      }),
    ]);

    res.status(204).send();
  }),
);

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

function buildProductListWhere(query: ProductListQuery): Prisma.ProductWhereInput {
  const filters: Prisma.ProductWhereInput[] = [];

  if (query.category) {
    filters.push({
      category: {
        slug: query.category,
      },
    });
  }

  if (query.search) {
    filters.push({
      OR: [
        {
          name: {
            contains: query.search,
            mode: "insensitive",
          },
        },
        {
          description: {
            contains: query.search,
            mode: "insensitive",
          },
        },
      ],
    });
  }

  if (filters.length === 0) {
    return {};
  }

  return { AND: filters };
}

async function assertCategoryExists(categoryId: number) {
  if (!prisma) {
    throw new ServiceUnavailableError("Database is not available");
  }

  const category = await prisma.category.findUnique({
    where: { id: categoryId },
    select: { id: true },
  });

  if (!category) {
    throw new NotFoundError("Category not found");
  }
}

async function assertProductExists(id: number) {
  if (!prisma) {
    throw new ServiceUnavailableError("Database is not available");
  }

  const product = await prisma.product.findUnique({
    where: { id },
    select: { id: true },
  });

  if (!product) {
    throw new NotFoundError("Product not found");
  }
}

function buildProductUpdateData(body: UpdateProductBody): Prisma.ProductUpdateInput {
  const data: Prisma.ProductUpdateInput = {};

  if (body.name !== undefined) {
    data.name = body.name;
  }

  if (body.description !== undefined) {
    data.description = body.description;
  }

  if (body.price !== undefined) {
    data.price = body.price;
  }

  if (body.imageUrl !== undefined) {
    data.imageUrl = body.imageUrl;
  }

  if (body.inventoryCount !== undefined) {
    data.inventoryCount = body.inventoryCount;
  }

  if (body.categoryId !== undefined) {
    data.category = {
      connect: { id: body.categoryId },
    };
  }

  return data;
}

type ProductWithCategory = Prisma.ProductGetPayload<{ select: typeof productSelect }>;

export default router;
