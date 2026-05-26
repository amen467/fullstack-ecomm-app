import { Router } from "express";
import { BadRequestError, AuthError, ServiceUnavailableError } from "../errors/http.js";
import { Prisma } from "../generated/client.js";
import { prisma } from "../lib/prisma.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { requireAuth } from "../middleware/auth.js";
import { validateBody, validateParams } from "../middleware/validation.js";
import { createOrderSchema, orderParamsSchema } from "../validation/orders.js";

const router = Router();

router.use(requireAuth);

router.post("/", validateBody(createOrderSchema), asyncHandler(async (req, res) => {
  if (!prisma) {
    throw new ServiceUnavailableError("Database is not available");
  }

  const userId = getAuthenticatedUserId(req);
  const order = await prisma.$transaction(async (tx) => {
    const cartItems = await tx.cartItem.findMany({
      where: { userId },
      orderBy: { id: "asc" },
      select: cartItemSelect,
    });

    if (cartItems.length === 0) {
      throw new BadRequestError("Cart is empty");
    }

    for (const item of cartItems) {
      assertAvailableQuantity(item.product.inventoryCount, item.quantity);
    }

    const totalAmount = cartItems.reduce(
      (total, item) => total.add(item.product.price.mul(item.quantity)),
      new Prisma.Decimal(0),
    );

    const order = await tx.order.create({
      data: {
        userId,
        totalAmount,
        items: {
          create: cartItems.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: item.product.price,
          })),
        },
      },
      select: orderSelect,
    });

    for (const item of cartItems) {
      const updateResult = await tx.product.updateMany({
        where: {
          id: item.productId,
          inventoryCount: {
            gte: item.quantity,
          },
        },
        data: {
          inventoryCount: {
            decrement: item.quantity,
          },
        },
      });

      if (updateResult.count === 0) {
        throw new BadRequestError("Requested quantity exceeds available inventory");
      }
    }

    await tx.cartItem.deleteMany({
      where: { userId },
    });

    return order;
  });

  res.status(201).json({ order: serializeOrder(order) });
}));

router.get("/", (_req, res) => {
  res.status(501).json({ error: "Not implemented" });
});

router.get("/:id", validateParams(orderParamsSchema), (_req, res) => {
  res.status(501).json({ error: "Not implemented" });
});

const cartItemSelect = {
  id: true,
  productId: true,
  quantity: true,
  product: {
    select: {
      id: true,
      price: true,
      inventoryCount: true,
    },
  },
} as const;

const orderSelect = {
  id: true,
  userId: true,
  status: true,
  totalAmount: true,
  createdAt: true,
  items: {
    orderBy: { id: "asc" },
    select: {
      id: true,
      productId: true,
      quantity: true,
      unitPrice: true,
      product: {
        select: {
          id: true,
          name: true,
          imageUrl: true,
          category: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
        },
      },
    },
  },
} as const;

function serializeOrder(order: OrderWithItems) {
  return {
    id: order.id,
    userId: order.userId,
    status: order.status,
    totalAmount: order.totalAmount.toString(),
    createdAt: order.createdAt.toISOString(),
    items: order.items.map((item) => ({
      id: item.id,
      productId: item.productId,
      quantity: item.quantity,
      unitPrice: item.unitPrice.toString(),
      lineTotal: item.unitPrice.mul(item.quantity).toString(),
      product: item.product,
    })),
  };
}

function assertAvailableQuantity(inventoryCount: number, requestedQuantity: number) {
  if (inventoryCount <= 0) {
    throw new BadRequestError("Product is out of stock");
  }

  if (requestedQuantity > inventoryCount) {
    throw new BadRequestError("Requested quantity exceeds available inventory");
  }
}

function getAuthenticatedUserId(req: { user?: { id: number } }) {
  if (!req.user) {
    throw new AuthError();
  }

  return req.user.id;
}

type OrderWithItems = Prisma.OrderGetPayload<{ select: typeof orderSelect }>;

export default router;
