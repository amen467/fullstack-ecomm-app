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

const TEST_JWT_SECRET = "admin-stats-test-secret";
const TEST_CATEGORY_SLUG = "api-admin-stats-category";
const TEST_USER_EMAIL = "admin-stats-user@example.test";
const TEST_PASSWORD = "password123";

let hasTestDatabase = false;

describe("admin stats API", () => {
  before(async () => {
    process.env.JWT_SECRET = TEST_JWT_SECRET;
    hasTestDatabase = await canUseDatabase();
  });

  beforeEach(async () => {
    process.env.JWT_SECRET = TEST_JWT_SECRET;

    if (hasTestDatabase) {
      await deleteTestAdminStatsData();
    }
  });

  after(async () => {
    if (hasTestDatabase) {
      await deleteTestAdminStatsData();
      await disconnectTestDatabase(hasTestDatabase);
    }

    delete process.env.JWT_SECRET;
  });

  it("requires authentication for admin stats", async () => {
    const response = await requestApp({
      method: "GET",
      path: "/api/admin/stats",
    });

    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), { error: "Authentication required" });
  });

  it("rejects authenticated non-admin users for admin stats", async () => {
    const response = await requestApp({
      method: "GET",
      path: "/api/admin/stats",
      headers: authHeader(signToken(UserRole.USER)),
    });

    assert.equal(response.status, 403);
    assert.deepEqual(await response.json(), { error: "Forbidden" });
  });

  it("returns product count, order count, and total revenue for admin users", async (t) => {
    if (skipIfDatabaseUnavailable(t, hasTestDatabase)) {
      return;
    }

    const firstProduct = await createTestProduct("API Admin Stats First Product", "12.50");
    const secondProduct = await createTestProduct("API Admin Stats Second Product", "9.25");
    const user = await createTestUser({
      name: "Admin Stats User",
      email: TEST_USER_EMAIL,
      password: TEST_PASSWORD,
    });

    await prisma!.order.createMany({
      data: [
        {
          userId: user.id,
          totalAmount: "25.00",
        },
        {
          userId: user.id,
          totalAmount: "9.25",
        },
      ],
    });
    const orders = await prisma!.order.findMany({
      where: { userId: user.id },
      orderBy: { id: "asc" },
      select: { id: true },
    });

    await prisma!.orderItem.createMany({
      data: [
        {
          orderId: orders[0]!.id,
          productId: firstProduct.id,
          quantity: 2,
          unitPrice: "12.50",
        },
        {
          orderId: orders[1]!.id,
          productId: secondProduct.id,
          quantity: 1,
          unitPrice: "9.25",
        },
      ],
    });

    const response = await getAdminStats();
    const expectedStats = await getCurrentStats();

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { stats: expectedStats });
  });

  it("returns zero revenue when there are no orders", async (t) => {
    if (skipIfDatabaseUnavailable(t, hasTestDatabase)) {
      return;
    }

    const existingOrderCount = await prisma!.order.count();

    if (existingOrderCount > 0) {
      t.skip("test database has pre-existing orders");
      return;
    }

    const response = await getAdminStats();

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      stats: {
        totalProducts: await prisma!.product.count(),
        totalOrders: 0,
        totalRevenue: "0",
      },
    });
  });
});

function getAdminStats() {
  return requestApp({
    method: "GET",
    path: "/api/admin/stats",
    headers: authHeader(signToken(UserRole.ADMIN)),
  });
}

function signToken(role: UserRole) {
  return jwt.sign(
    {
      userId: 1,
      email: "admin-stats@example.test",
      role,
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

async function createTestProduct(name: string, price: string) {
  const category = await prisma!.category.upsert({
    where: { slug: TEST_CATEGORY_SLUG },
    update: {},
    create: {
      name: "API Admin Stats Category",
      slug: TEST_CATEGORY_SLUG,
    },
  });

  return prisma!.product.create({
    data: {
      name,
      description: "Created by the admin stats API test",
      price,
      imageUrl: "https://example.test/admin-stats-product.png",
      inventoryCount: 10,
      categoryId: category.id,
    },
  });
}

async function getCurrentStats() {
  const [totalProducts, totalOrders, revenueAggregate] = await Promise.all([
    prisma!.product.count(),
    prisma!.order.count(),
    prisma!.order.aggregate({
      _sum: {
        totalAmount: true,
      },
    }),
  ]);

  return {
    totalProducts,
    totalOrders,
    totalRevenue: revenueAggregate._sum.totalAmount?.toString() ?? "0",
  };
}

async function deleteTestAdminStatsData() {
  await deleteTestUsers([TEST_USER_EMAIL]);

  const category = await prisma!.category.findUnique({
    where: { slug: TEST_CATEGORY_SLUG },
    select: { id: true },
  });

  if (!category) {
    return;
  }

  const products = await prisma!.product.findMany({
    where: { categoryId: category.id },
    select: { id: true },
  });
  const productIds = products.map((product) => product.id);

  if (productIds.length > 0) {
    await prisma!.orderItem.deleteMany({
      where: {
        productId: { in: productIds },
      },
    });
    await prisma!.cartItem.deleteMany({
      where: {
        productId: { in: productIds },
      },
    });
    await prisma!.product.deleteMany({
      where: {
        id: { in: productIds },
      },
    });
  }

  await prisma!.category.delete({
    where: { id: category.id },
  });
}
