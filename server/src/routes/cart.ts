import { Router } from "express";
import { BadRequestError, AuthError, NotFoundError, ServiceUnavailableError } from "../errors/http.js";
import { Prisma } from "../generated/client.js";
import { prisma } from "../lib/prisma.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { requireAuth } from "../middleware/auth.js";
import { validateBody, validateParams } from "../middleware/validation.js";
import {
  addCartItemSchema,
  cartItemParamsSchema,
  updateCartItemSchema,
  type AddCartItemBody,
  type CartItemParams,
  type UpdateCartItemBody,
} from "../validation/cart.js";

const router = Router();

router.use(requireAuth);

router.get("/", asyncHandler(async (req, res) => {
  const userId = getAuthenticatedUserId(req);
  res.json(await getCartPayload(userId));
}));

router.post("/items", validateBody(addCartItemSchema), asyncHandler(async (req, res) => {
  if (!prisma) {
    throw new ServiceUnavailableError("Database is not available");
  }

  const userId = getAuthenticatedUserId(req);
  const { productId, quantity } = req.body as AddCartItemBody;

  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: {
      id: true,
      inventoryCount: true,
    },
  });

  if (!product) {
    throw new NotFoundError("Product not found");
  }

  const existingItem = await prisma.cartItem.findUnique({
    where: {
      userId_productId: {
        userId,
        productId,
      },
    },
    select: {
      id: true,
      quantity: true,
    },
  });

  assertAvailableQuantity(product.inventoryCount, (existingItem?.quantity ?? 0) + quantity);

  if (existingItem) {
    await prisma.cartItem.update({
      where: { id: existingItem.id },
      data: {
        quantity: {
          increment: quantity,
        },
      },
    });
  } else {
    await prisma.cartItem.create({
      data: {
        userId,
        productId,
        quantity,
      },
    });
  }

  res.status(201).json(await getCartPayload(userId));
}));

router.patch(
  "/items/:id",
  validateParams(cartItemParamsSchema),
  validateBody(updateCartItemSchema),
  asyncHandler(async (req, res) => {
    if (!prisma) {
      throw new ServiceUnavailableError("Database is not available");
    }

    const userId = getAuthenticatedUserId(req);
    const { id } = req.params as unknown as CartItemParams;
    const { quantity } = req.body as UpdateCartItemBody;

    const item = await prisma.cartItem.findFirst({
      where: {
        id,
        userId,
      },
      select: {
        product: {
          select: {
            inventoryCount: true,
          },
        },
      },
    });

    if (!item) {
      throw new NotFoundError("Cart item not found");
    }

    assertAvailableQuantity(item.product.inventoryCount, quantity);

    await prisma.cartItem.update({
      where: { id },
      data: { quantity },
    });

    res.json(await getCartPayload(userId));
  }),
);

router.delete(
  "/items/:id",
  validateParams(cartItemParamsSchema),
  asyncHandler(async (req, res) => {
    if (!prisma) {
      throw new ServiceUnavailableError("Database is not available");
    }

    const userId = getAuthenticatedUserId(req);
    const { id } = req.params as unknown as CartItemParams;
    const item = await prisma.cartItem.findFirst({
      where: {
        id,
        userId,
      },
      select: { id: true },
    });

    if (!item) {
      throw new NotFoundError("Cart item not found");
    }

    await prisma.cartItem.delete({
      where: { id },
    });

    res.json(await getCartPayload(userId));
  }),
);

const cartItemSelect = {
  id: true,
  productId: true,
  quantity: true,
  product: {
    select: {
      id: true,
      name: true,
      price: true,
      imageUrl: true,
      inventoryCount: true,
      category: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
    },
  },
} as const;

async function getCartPayload(userId: number) {
  if (!prisma) {
    throw new ServiceUnavailableError("Database is not available");
  }

  const items = await prisma.cartItem.findMany({
    where: { userId },
    orderBy: { id: "asc" },
    select: cartItemSelect,
  });

  return serializeCart(items);
}

function serializeCart(items: CartItemWithProduct[]) {
  const subtotal = items.reduce(
    (total, item) => total.add(item.product.price.mul(item.quantity)),
    new Prisma.Decimal(0),
  );

  return {
    items: items.map((item) => ({
      id: item.id,
      productId: item.productId,
      quantity: item.quantity,
      lineTotal: item.product.price.mul(item.quantity).toString(),
      product: {
        ...item.product,
        price: item.product.price.toString(),
      },
    })),
    subtotal: subtotal.toString(),
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

type CartItemWithProduct = Prisma.CartItemGetPayload<{ select: typeof cartItemSelect }>;

export default router;
