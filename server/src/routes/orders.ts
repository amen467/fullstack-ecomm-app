import { Router } from "express";
import { BadRequestError, AuthError, NotFoundError, ServiceUnavailableError } from "../errors/http.js";
import { Prisma } from "../generated/client.js";
import { UserRole } from "../generated/enums.js";
import { prisma } from "../lib/prisma.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { validateBody, validateParams } from "../middleware/validation.js";
import {
  createOrderSchema,
  orderParamsSchema,
  updateOrderStatusSchema,
  type OrderParams,
  type UpdateOrderStatusBody,
} from "../validation/orders.js";

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

router.get("/", requireRole(UserRole.ADMIN), asyncHandler(async (_req, res) => {
  if (!prisma) {
    throw new ServiceUnavailableError("Database is not available");
  }

  const orders = await prisma.order.findMany({
    orderBy: [
      { createdAt: "desc" },
      { id: "desc" },
    ],
    select: adminOrderSelect,
  });

  res.json({ orders: orders.map(serializeAdminOrder) });
}));

router.patch(
  "/:id/status",
  requireRole(UserRole.ADMIN),
  validateParams(orderParamsSchema),
  validateBody(updateOrderStatusSchema),
  asyncHandler(async (req, res) => {
    if (!prisma) {
      throw new ServiceUnavailableError("Database is not available");
    }

    const { id } = req.params as unknown as OrderParams;
    const { status } = req.body as UpdateOrderStatusBody;

    await assertOrderExists(id);

    const order = await prisma.order.update({
      where: { id },
      data: { status },
      select: adminOrderSelect,
    });

    res.json({ order: serializeAdminOrder(order) });
  }),
);

router.get("/:id", validateParams(orderParamsSchema), asyncHandler(async (req, res) => {
  if (!prisma) {
    throw new ServiceUnavailableError("Database is not available");
  }

  const userId = getAuthenticatedUserId(req);
  const { id } = req.params as unknown as { id: number };
  const order = await prisma.order.findFirst({
    where: {
      id,
      userId,
    },
    select: orderSelect,
  });

  if (!order) {
    throw new NotFoundError("Order not found");
  }

  res.json({ order: serializeOrder(order) });
}));

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

const adminOrderSelect = {
  ...orderSelect,
  user: {
    select: {
      id: true,
      name: true,
      email: true,
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

function serializeAdminOrder(order: AdminOrderWithItems) {
  return {
    ...serializeOrder(order),
    customer: order.user,
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

async function assertOrderExists(id: number) {
  if (!prisma) {
    throw new ServiceUnavailableError("Database is not available");
  }

  const order = await prisma.order.findUnique({
    where: { id },
    select: { id: true },
  });

  if (!order) {
    throw new NotFoundError("Order not found");
  }
}

type OrderWithItems = Prisma.OrderGetPayload<{ select: typeof orderSelect }>;
type AdminOrderWithItems = Prisma.OrderGetPayload<{ select: typeof adminOrderSelect }>;

export default router;
