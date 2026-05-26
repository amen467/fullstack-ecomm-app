import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import jwt from "jsonwebtoken";
import { UserRole } from "../generated/enums.js";
import { prisma } from "../lib/prisma.js";
import {
  canUseDatabase,
  createTestUser,
  deleteTestUsers,
  disconnectTestDatabase,
  requestApp,
  skipIfDatabaseUnavailable,
} from "../test/authTestHelpers.js";

const TEST_JWT_SECRET = "orders-test-secret";
const TEST_PASSWORD = "password123";
const TEST_CATEGORY_SLUG = "api-orders-category";
const TEST_USER_EMAILS = [
  "orders-user@example.test",
  "orders-other-user@example.test",
];

let hasTestDatabase = false;

describe("orders API route guards", () => {
  before(async () => {
    process.env.JWT_SECRET = TEST_JWT_SECRET;
    hasTestDatabase = await canUseDatabase();
  });

  beforeEach(() => {
    process.env.JWT_SECRET = TEST_JWT_SECRET;
  });

  after(async () => {
    if (hasTestDatabase) {
      await deleteTestOrderData();
      await disconnectTestDatabase(hasTestDatabase);
    }
  });

  it("requires authentication for order endpoints", async () => {
    const requests = [
      requestApp({
        method: "POST",
        path: "/api/orders",
      }),
      requestApp({
        method: "GET",
        path: "/api/orders",
      }),
      requestApp({
        method: "GET",
        path: "/api/orders/1",
      }),
    ];

    for (const responsePromise of requests) {
      const response = await responsePromise;

      assert.equal(response.status, 401);
      assert.deepEqual(await response.json(), { error: "Authentication required" });
    }
  });

  it("keeps authenticated read endpoints as not implemented stubs", async () => {
    const token = signToken();
    const requests = [
      requestApp({
        method: "GET",
        path: "/api/orders",
        headers: authHeader(token),
      }),
      requestApp({
        method: "GET",
        path: "/api/orders/1",
        headers: authHeader(token),
      }),
    ];

    for (const responsePromise of requests) {
      const response = await responsePromise;

      assert.equal(response.status, 501);
      assert.deepEqual(await response.json(), { error: "Not implemented" });
    }
  });

  it("creates an order from the authenticated user's cart", async (t) => {
    if (skipIfDatabaseUnavailable(t, hasTestDatabase)) {
      return;
    }

    await deleteTestOrderData();

    const user = await createOrderUser("orders-user@example.test");
    const otherUser = await createOrderUser("orders-other-user@example.test");
    const firstProduct = await createTestProduct({
      name: "API Orders Alpha Product",
      price: "12.50",
      inventoryCount: 5,
    });
    const secondProduct = await createTestProduct({
      name: "API Orders Beta Product",
      price: "4.75",
      inventoryCount: 10,
    });
    const otherProduct = await createTestProduct({
      name: "API Orders Other Product",
      price: "20.00",
      inventoryCount: 4,
    });

    await prisma!.cartItem.createMany({
      data: [
        {
          userId: user.id,
          productId: firstProduct.product.id,
          quantity: 2,
        },
        {
          userId: user.id,
          productId: secondProduct.product.id,
          quantity: 3,
        },
        {
          userId: otherUser.id,
          productId: otherProduct.product.id,
          quantity: 1,
        },
      ],
    });

    const response = await createOrder(signToken(user), validCreateOrderBody());

    assert.equal(response.status, 201);

    const body = await response.json() as CreateOrderResponse;
    assert.equal(body.order.userId, user.id);
    assert.equal(body.order.status, "PENDING");
    assert.equal(body.order.totalAmount, "39.25");
    assert.equal(body.order.items.length, 2);
    assert.deepEqual(body.order.items.map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      lineTotal: item.lineTotal,
      product: item.product,
    })), [
      {
        productId: firstProduct.product.id,
        quantity: 2,
        unitPrice: "12.5",
        lineTotal: "25",
        product: {
          id: firstProduct.product.id,
          name: "API Orders Alpha Product",
          imageUrl: "https://example.test/orders-product.png",
          category: {
            id: firstProduct.category.id,
            name: "API Orders Category",
            slug: TEST_CATEGORY_SLUG,
          },
        },
      },
      {
        productId: secondProduct.product.id,
        quantity: 3,
        unitPrice: "4.75",
        lineTotal: "14.25",
        product: {
          id: secondProduct.product.id,
          name: "API Orders Beta Product",
          imageUrl: "https://example.test/orders-product.png",
          category: {
            id: secondProduct.category.id,
            name: "API Orders Category",
            slug: TEST_CATEGORY_SLUG,
          },
        },
      },
    ]);
    assert.match(body.order.createdAt, /^\d{4}-\d{2}-\d{2}T/);

    const storedOrder = await prisma!.order.findUnique({
      where: { id: body.order.id },
      select: {
        userId: true,
        totalAmount: true,
        items: {
          orderBy: { id: "asc" },
          select: {
            productId: true,
            quantity: true,
            unitPrice: true,
          },
        },
      },
    });
    const firstProductAfter = await prisma!.product.findUniqueOrThrow({
      where: { id: firstProduct.product.id },
      select: { inventoryCount: true },
    });
    const secondProductAfter = await prisma!.product.findUniqueOrThrow({
      where: { id: secondProduct.product.id },
      select: { inventoryCount: true },
    });
    const otherUserCart = await prisma!.cartItem.findMany({
      where: { userId: otherUser.id },
      select: { productId: true, quantity: true },
    });
    const userCartCount = await prisma!.cartItem.count({
      where: { userId: user.id },
    });

    assert.equal(storedOrder?.userId, user.id);
    assert.equal(storedOrder?.totalAmount.toString(), "39.25");
    assert.deepEqual(storedOrder?.items.map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
      unitPrice: item.unitPrice.toString(),
    })), [
      {
        productId: firstProduct.product.id,
        quantity: 2,
        unitPrice: "12.5",
      },
      {
        productId: secondProduct.product.id,
        quantity: 3,
        unitPrice: "4.75",
      },
    ]);
    assert.equal(firstProductAfter.inventoryCount, 3);
    assert.equal(secondProductAfter.inventoryCount, 7);
    assert.equal(userCartCount, 0);
    assert.deepEqual(otherUserCart, [
      {
        productId: otherProduct.product.id,
        quantity: 1,
      },
    ]);
  });

  it("rejects checkout when the authenticated user's cart is empty", async (t) => {
    if (skipIfDatabaseUnavailable(t, hasTestDatabase)) {
      return;
    }

    await deleteTestOrderData();

    const user = await createOrderUser("orders-user@example.test");

    const response = await createOrder(signToken(user), validCreateOrderBody());

    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { error: "Cart is empty" });
    assert.equal(await prisma!.order.count({ where: { userId: user.id } }), 0);
  });

  it("rejects checkout for insufficient inventory without changing persisted data", async (t) => {
    if (skipIfDatabaseUnavailable(t, hasTestDatabase)) {
      return;
    }

    await deleteTestOrderData();

    const user = await createOrderUser("orders-user@example.test");
    const { product } = await createTestProduct({
      price: "10.00",
      inventoryCount: 1,
    });

    await prisma!.cartItem.create({
      data: {
        userId: user.id,
        productId: product.id,
        quantity: 2,
      },
    });

    const response = await createOrder(signToken(user), validCreateOrderBody());
    const productAfter = await prisma!.product.findUniqueOrThrow({
      where: { id: product.id },
      select: { inventoryCount: true },
    });

    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), {
      error: "Requested quantity exceeds available inventory",
    });
    assert.equal(await prisma!.order.count({ where: { userId: user.id } }), 0);
    assert.equal(await prisma!.cartItem.count({ where: { userId: user.id } }), 1);
    assert.equal(productAfter.inventoryCount, 1);
  });

  it("rejects checkout for an out-of-stock product without changing persisted data", async (t) => {
    if (skipIfDatabaseUnavailable(t, hasTestDatabase)) {
      return;
    }

    await deleteTestOrderData();

    const user = await createOrderUser("orders-user@example.test");
    const { product } = await createTestProduct({
      price: "10.00",
      inventoryCount: 0,
    });

    await prisma!.cartItem.create({
      data: {
        userId: user.id,
        productId: product.id,
        quantity: 1,
      },
    });

    const response = await createOrder(signToken(user), validCreateOrderBody());
    const productAfter = await prisma!.product.findUniqueOrThrow({
      where: { id: product.id },
      select: { inventoryCount: true },
    });

    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { error: "Product is out of stock" });
    assert.equal(await prisma!.order.count({ where: { userId: user.id } }), 0);
    assert.equal(await prisma!.cartItem.count({ where: { userId: user.id } }), 1);
    assert.equal(productAfter.inventoryCount, 0);
  });

  it("rejects invalid authenticated order ids", async () => {
    const token = signToken();
    const invalidIds = [
      "not-a-number",
      "0",
      "-1",
      "1.5",
    ];

    for (const invalidId of invalidIds) {
      const response = await requestApp({
        method: "GET",
        path: `/api/orders/${invalidId}`,
        headers: authHeader(token),
      });

      assert.equal(response.status, 400);
      assert.deepEqual(await response.json(), {
        error: "Order id must be a positive integer",
      });
    }
  });

  it("rejects invalid mock checkout submissions", async () => {
    const token = signToken();
    const invalidRequests = [
      {
        body: {
          ...validCreateOrderBody(),
          shipping: { ...validCreateOrderBody().shipping, fullName: " " },
        },
        error: "Full name is required",
      },
      {
        body: {
          ...validCreateOrderBody(),
          shipping: { ...validCreateOrderBody().shipping, address: "" },
        },
        error: "Address is required",
      },
      {
        body: {
          ...validCreateOrderBody(),
          shipping: { ...validCreateOrderBody().shipping, city: "" },
        },
        error: "City is required",
      },
      {
        body: {
          ...validCreateOrderBody(),
          shipping: { ...validCreateOrderBody().shipping, zipCode: "1000" },
        },
        error: "ZIP code must be 5 digits",
      },
      {
        body: {
          ...validCreateOrderBody(),
          payment: { ...validCreateOrderBody().payment, cardNumber: "4111 1111 nope" },
        },
        error: "Card number can only contain digits and spaces",
      },
      {
        body: {
          ...validCreateOrderBody(),
          payment: { ...validCreateOrderBody().payment, cardNumber: "4111" },
        },
        error: "Card number must contain 13 to 19 digits",
      },
      {
        body: {
          ...validCreateOrderBody(),
          payment: { ...validCreateOrderBody().payment, expiry: "13/25" },
        },
        error: "Expiry must use MM/YY format",
      },
      {
        body: {
          ...validCreateOrderBody(),
          payment: { ...validCreateOrderBody().payment, cvc: "12" },
        },
        error: "CVC must be 3 or 4 digits",
      },
    ];

    for (const invalidRequest of invalidRequests) {
      const response = await requestApp({
        method: "POST",
        path: "/api/orders",
        headers: authHeader(token),
        body: invalidRequest.body,
      });

      assert.equal(response.status, 400);
      assert.deepEqual(await response.json(), { error: invalidRequest.error });
    }
  });
});

function signToken(user?: { id: number; email: string; role: UserRole }) {
  return jwt.sign(
    {
      userId: user?.id ?? 1,
      email: user?.email ?? "orders-user@example.test",
      role: user?.role ?? UserRole.USER,
    },
    TEST_JWT_SECRET,
    { expiresIn: "7d" },
  );
}

function authHeader(token: string) {
  return {
    authorization: `Bearer ${token}`,
  };
}

async function createOrder(token: string, body: unknown) {
  return requestApp({
    method: "POST",
    path: "/api/orders",
    headers: authHeader(token),
    body,
  });
}

async function createOrderUser(email: string) {
  return createTestUser({
    name: "Orders User",
    email,
    password: TEST_PASSWORD,
  });
}

async function createTestProduct(input: { name?: string; price: string; inventoryCount: number }) {
  const category = await prisma!.category.upsert({
    where: { slug: TEST_CATEGORY_SLUG },
    update: {},
    create: {
      name: "API Orders Category",
      slug: TEST_CATEGORY_SLUG,
    },
  });
  const product = await prisma!.product.create({
    data: {
      name: input.name ?? "API Orders Product",
      description: "Product used by the orders API tests",
      price: input.price,
      imageUrl: "https://example.test/orders-product.png",
      inventoryCount: input.inventoryCount,
      categoryId: category.id,
    },
    select: {
      id: true,
      name: true,
      price: true,
      imageUrl: true,
      inventoryCount: true,
    },
  });

  return { category, product };
}

function validCreateOrderBody() {
  return {
    shipping: {
      fullName: "Test Customer",
      address: "123 Test Street",
      city: "Testville",
      zipCode: "10001",
    },
    payment: {
      cardNumber: "4111 1111 1111 1111",
      expiry: "12/30",
      cvc: "123",
    },
  };
}

async function deleteTestOrderData() {
  await deleteTestUsers(TEST_USER_EMAILS);

  const category = await prisma!.category.findUnique({
    where: { slug: TEST_CATEGORY_SLUG },
    select: { id: true },
  });

  if (!category) {
    return;
  }

  await prisma!.product.deleteMany({
    where: { categoryId: category.id },
  });
  await prisma!.category.delete({
    where: { id: category.id },
  });
}

type CreateOrderResponse = {
  order: {
    id: number;
    userId: number;
    status: string;
    totalAmount: string;
    createdAt: string;
    items: Array<{
      id: number;
      productId: number;
      quantity: number;
      unitPrice: string;
      lineTotal: string;
      product: {
        id: number;
        name: string;
        imageUrl: string;
        category: {
          id: number;
          name: string;
          slug: string;
        };
      };
    }>;
  };
};
