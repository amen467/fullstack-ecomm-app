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

const TEST_JWT_SECRET = "products-admin-test-secret";
const TEST_CATEGORY_SLUG_A = "api-admin-products-category-a";
const TEST_CATEGORY_SLUG_B = "api-admin-products-category-b";
const TEST_USER_EMAIL = "products-admin-user@example.test";
const TEST_PASSWORD = "password123";

let hasTestDatabase = false;

describe("admin product API", () => {
  before(async () => {
    process.env.JWT_SECRET = TEST_JWT_SECRET;
    hasTestDatabase = await canUseDatabase();
  });

  beforeEach(async () => {
    process.env.JWT_SECRET = TEST_JWT_SECRET;

    if (hasTestDatabase) {
      await deleteTestProductData();
    }
  });

  after(async () => {
    if (hasTestDatabase) {
      await deleteTestProductData();
      await disconnectTestDatabase(hasTestDatabase);
    }

    delete process.env.JWT_SECRET;
  });

  it("requires authentication for product write endpoints", async () => {
    for (const request of productWriteRequests()) {
      const response = await requestApp(request);

      assert.equal(response.status, 401);
      assert.deepEqual(await response.json(), { error: "Authentication required" });
    }
  });

  it("rejects authenticated non-admin users for product write endpoints", async () => {
    const token = signToken(UserRole.USER);

    for (const request of productWriteRequests(authHeader(token))) {
      const response = await requestApp(request);

      assert.equal(response.status, 403);
      assert.deepEqual(await response.json(), { error: "Forbidden" });
    }
  });

  it("creates a product and returns serialized category and price data", async (t) => {
    if (skipIfDatabaseUnavailable(t, hasTestDatabase)) {
      return;
    }

    const category = await createTestCategory(TEST_CATEGORY_SLUG_A, "API Admin Products Category A");
    const token = signToken(UserRole.ADMIN);

    const response = await requestApp({
      method: "POST",
      path: "/api/products",
      headers: authHeader(token),
      body: buildProductBody({ categoryId: category.id }),
    });

    assert.equal(response.status, 201);

    const body = await response.json() as ProductResponse;
    assertProductPayload(body.product, {
      name: "API Admin Product",
      description: "Created by the admin product API test",
      price: "19.99",
      imageUrl: "https://example.test/admin-product.png",
      inventoryCount: 12,
      category: {
        id: category.id,
        name: "API Admin Products Category A",
        slug: TEST_CATEGORY_SLUG_A,
      },
    });
  });

  it("updates product fields and category", async (t) => {
    if (skipIfDatabaseUnavailable(t, hasTestDatabase)) {
      return;
    }

    const originalCategory = await createTestCategory(TEST_CATEGORY_SLUG_A, "API Admin Products Category A");
    const nextCategory = await createTestCategory(TEST_CATEGORY_SLUG_B, "API Admin Products Category B");
    const product = await createTestProduct(originalCategory.id);
    const token = signToken(UserRole.ADMIN);

    const response = await requestApp({
      method: "PATCH",
      path: `/api/products/${product.id}`,
      headers: authHeader(token),
      body: {
        name: "Updated API Admin Product",
        price: "29.50",
        inventoryCount: 3,
        categoryId: nextCategory.id,
      },
    });

    assert.equal(response.status, 200);

    const body = await response.json() as ProductResponse;
    assertProductPayload(body.product, {
      name: "Updated API Admin Product",
      description: "Created by the admin product API test",
      price: "29.5",
      imageUrl: "https://example.test/admin-product.png",
      inventoryCount: 3,
      category: {
        id: nextCategory.id,
        name: "API Admin Products Category B",
        slug: TEST_CATEGORY_SLUG_B,
      },
    });
  });

  it("rejects invalid create and update bodies", async (t) => {
    if (skipIfDatabaseUnavailable(t, hasTestDatabase)) {
      return;
    }

    const category = await createTestCategory(TEST_CATEGORY_SLUG_A, "API Admin Products Category A");
    const product = await createTestProduct(category.id);
    const token = signToken(UserRole.ADMIN);
    const invalidRequests = [
      {
        method: "POST",
        path: "/api/products",
        body: buildProductBody({ categoryId: category.id, name: " " }),
        error: "Product name is required",
      },
      {
        method: "POST",
        path: "/api/products",
        body: buildProductBody({ categoryId: category.id, price: "0" }),
        error: "Price must be a positive number",
      },
      {
        method: "POST",
        path: "/api/products",
        body: buildProductBody({ categoryId: category.id, inventoryCount: -1 }),
        error: "Inventory count must be a non-negative integer",
      },
      {
        method: "POST",
        path: "/api/products",
        body: buildProductBody({ categoryId: 0 }),
        error: "Category id must be a positive integer",
      },
      {
        method: "PATCH",
        path: `/api/products/${product.id}`,
        body: {},
        error: "At least one product field is required",
      },
    ];

    for (const invalidRequest of invalidRequests) {
      const response = await requestApp({
        method: invalidRequest.method,
        path: invalidRequest.path,
        headers: authHeader(token),
        body: invalidRequest.body,
      });

      assert.equal(response.status, 400);
      assert.deepEqual(await response.json(), { error: invalidRequest.error });
    }
  });

  it("returns not found for unknown categories on create and update", async (t) => {
    if (skipIfDatabaseUnavailable(t, hasTestDatabase)) {
      return;
    }

    const category = await createTestCategory(TEST_CATEGORY_SLUG_A, "API Admin Products Category A");
    const product = await createTestProduct(category.id);
    const token = signToken(UserRole.ADMIN);

    const createResponse = await requestApp({
      method: "POST",
      path: "/api/products",
      headers: authHeader(token),
      body: buildProductBody({ categoryId: 999_999_999 }),
    });

    assert.equal(createResponse.status, 404);
    assert.deepEqual(await createResponse.json(), { error: "Category not found" });

    const updateResponse = await requestApp({
      method: "PATCH",
      path: `/api/products/${product.id}`,
      headers: authHeader(token),
      body: { categoryId: 999_999_999 },
    });

    assert.equal(updateResponse.status, 404);
    assert.deepEqual(await updateResponse.json(), { error: "Category not found" });
  });

  it("returns not found for unknown products on update and delete", async (t) => {
    if (skipIfDatabaseUnavailable(t, hasTestDatabase)) {
      return;
    }

    const token = signToken(UserRole.ADMIN);

    const updateResponse = await requestApp({
      method: "PATCH",
      path: "/api/products/999999999",
      headers: authHeader(token),
      body: { name: "Missing Product" },
    });

    assert.equal(updateResponse.status, 404);
    assert.deepEqual(await updateResponse.json(), { error: "Product not found" });

    const deleteResponse = await requestApp({
      method: "DELETE",
      path: "/api/products/999999999",
      headers: authHeader(token),
    });

    assert.equal(deleteResponse.status, 404);
    assert.deepEqual(await deleteResponse.json(), { error: "Product not found" });
  });

  it("deletes an unordered product and associated cart items", async (t) => {
    if (skipIfDatabaseUnavailable(t, hasTestDatabase)) {
      return;
    }

    const category = await createTestCategory(TEST_CATEGORY_SLUG_A, "API Admin Products Category A");
    const product = await createTestProduct(category.id);
    const user = await createTestUser({
      name: "Product Admin Test User",
      email: TEST_USER_EMAIL,
      password: TEST_PASSWORD,
    });
    const cartItem = await prisma!.cartItem.create({
      data: {
        userId: user.id,
        productId: product.id,
        quantity: 2,
      },
    });
    const token = signToken(UserRole.ADMIN);

    const response = await requestApp({
      method: "DELETE",
      path: `/api/products/${product.id}`,
      headers: authHeader(token),
    });

    assert.equal(response.status, 204);
    assert.equal(await prisma!.product.count({ where: { id: product.id } }), 0);
    assert.equal(await prisma!.cartItem.count({ where: { id: cartItem.id } }), 0);
  });

  it("rejects deleting a product with order history", async (t) => {
    if (skipIfDatabaseUnavailable(t, hasTestDatabase)) {
      return;
    }

    const category = await createTestCategory(TEST_CATEGORY_SLUG_A, "API Admin Products Category A");
    const product = await createTestProduct(category.id);
    const user = await createTestUser({
      name: "Product Admin Test User",
      email: TEST_USER_EMAIL,
      password: TEST_PASSWORD,
    });
    await prisma!.order.create({
      data: {
        userId: user.id,
        totalAmount: "19.99",
        items: {
          create: {
            productId: product.id,
            quantity: 1,
            unitPrice: "19.99",
          },
        },
      },
    });
    const token = signToken(UserRole.ADMIN);

    const response = await requestApp({
      method: "DELETE",
      path: `/api/products/${product.id}`,
      headers: authHeader(token),
    });

    assert.equal(response.status, 409);
    assert.deepEqual(await response.json(), { error: "Product has existing orders" });
    assert.equal(await prisma!.product.count({ where: { id: product.id } }), 1);
  });
});

function productWriteRequests(headers?: Record<string, string>) {
  const requests = [
    {
      method: "POST",
      path: "/api/products",
    },
    {
      method: "PATCH",
      path: "/api/products/1",
    },
    {
      method: "DELETE",
      path: "/api/products/1",
    },
  ];

  if (!headers) {
    return requests;
  }

  return requests.map((request) => ({
    ...request,
    headers,
  }));
}

function signToken(role: UserRole) {
  return jwt.sign(
    {
      userId: 1,
      email: "products-admin@example.test",
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

function buildProductBody(overrides: Partial<CreateProductRequest>) {
  return {
    name: "API Admin Product",
    description: "Created by the admin product API test",
    price: "19.99",
    imageUrl: "https://example.test/admin-product.png",
    inventoryCount: 12,
    ...overrides,
  };
}

async function createTestCategory(slug: string, name: string) {
  return prisma!.category.create({
    data: {
      name,
      slug,
    },
  });
}

async function createTestProduct(categoryId: number) {
  return prisma!.product.create({
    data: buildProductBody({ categoryId }),
  });
}

async function deleteTestProductData() {
  await deleteTestUsers([TEST_USER_EMAIL]);

  const categories = await prisma!.category.findMany({
    where: {
      slug: {
        in: [TEST_CATEGORY_SLUG_A, TEST_CATEGORY_SLUG_B],
      },
    },
    select: { id: true },
  });

  if (categories.length === 0) {
    return;
  }

  const categoryIds = categories.map((category) => category.id);
  const products = await prisma!.product.findMany({
    where: {
      categoryId: { in: categoryIds },
    },
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

  await prisma!.category.deleteMany({
    where: {
      id: { in: categoryIds },
    },
  });
}

function assertProductPayload(product: ProductPayload, expected: ExpectedProductPayload) {
  assert.equal(typeof product.id, "number");
  assert.equal(typeof product.createdAt, "string");
  assert.equal(product.name, expected.name);
  assert.equal(product.description, expected.description);
  assert.equal(product.price, expected.price);
  assert.equal(product.imageUrl, expected.imageUrl);
  assert.equal(product.inventoryCount, expected.inventoryCount);
  assert.deepEqual(product.category, expected.category);
}

type CreateProductRequest = {
  name: string;
  description: string;
  price: string;
  imageUrl: string;
  inventoryCount: number;
  categoryId: number;
};

type ProductResponse = {
  product: ProductPayload;
};

type ProductPayload = {
  id: number;
  name: string;
  description: string;
  price: string;
  imageUrl: string;
  inventoryCount: number;
  createdAt: string;
  category: {
    id: number;
    name: string;
    slug: string;
  };
};

type ExpectedProductPayload = Omit<ProductPayload, "id" | "createdAt">;
