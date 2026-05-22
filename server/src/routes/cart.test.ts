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

const TEST_JWT_SECRET = "cart-test-secret";
const TEST_PASSWORD = "password123";
const TEST_CATEGORY_SLUG = "api-cart-category";
const TEST_USER_EMAILS = [
  "cart-user@example.test",
  "cart-other-user@example.test",
];

let hasTestDatabase = false;

describe("persisted cart API", () => {
  before(async () => {
    process.env.JWT_SECRET = TEST_JWT_SECRET;
    hasTestDatabase = await canUseDatabase();
  });

  beforeEach(async () => {
    process.env.JWT_SECRET = TEST_JWT_SECRET;

    if (!hasTestDatabase) {
      return;
    }

    await deleteTestCartData();
  });

  after(async () => {
    if (hasTestDatabase) {
      await deleteTestCartData();
      await disconnectTestDatabase(hasTestDatabase);
    }
  });

  it("requires authentication for cart endpoints", async () => {
    const response = await requestApp({
      method: "GET",
      path: "/api/cart",
    });

    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), { error: "Authentication required" });
  });

  it("returns an empty cart for a logged-in user", async (t) => {
    if (skipIfDatabaseUnavailable(t, hasTestDatabase)) {
      return;
    }

    const user = await createCartUser("cart-user@example.test");

    const response = await getCart(signToken(user));

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      items: [],
      subtotal: "0",
    });
  });

  it("adds an item and returns product data with subtotal", async (t) => {
    if (skipIfDatabaseUnavailable(t, hasTestDatabase)) {
      return;
    }

    const user = await createCartUser("cart-user@example.test");
    const { product } = await createTestProduct({
      price: "12.50",
      inventoryCount: 5,
    });

    const response = await addCartItem(signToken(user), {
      productId: product.id,
      quantity: 2,
    });

    assert.equal(response.status, 201);

    const body = await response.json() as CartResponse;
    assert.equal(body.subtotal, "25");
    assert.equal(body.items.length, 1);
    assert.equal(body.items[0]!.productId, product.id);
    assert.equal(body.items[0]!.quantity, 2);
    assert.equal(body.items[0]!.lineTotal, "25");
    assert.deepEqual(body.items[0]!.product, {
      id: product.id,
      name: "API Cart Product",
      price: "12.5",
      imageUrl: "https://example.test/cart-product.png",
      inventoryCount: 5,
      category: {
        id: product.category.id,
        name: "API Cart Category",
        slug: TEST_CATEGORY_SLUG,
      },
    });
  });

  it("increments an existing item when adding the same product", async (t) => {
    if (skipIfDatabaseUnavailable(t, hasTestDatabase)) {
      return;
    }

    const user = await createCartUser("cart-user@example.test");
    const { product } = await createTestProduct({
      price: "10.00",
      inventoryCount: 5,
    });
    const token = signToken(user);

    await addCartItem(token, {
      productId: product.id,
      quantity: 1,
    });

    const response = await addCartItem(token, {
      productId: product.id,
      quantity: 2,
    });

    assert.equal(response.status, 201);

    const body = await response.json() as CartResponse;
    assert.equal(body.items.length, 1);
    assert.equal(body.items[0]!.quantity, 3);
    assert.equal(body.items[0]!.lineTotal, "30");
    assert.equal(body.subtotal, "30");
  });

  it("rejects adding an item beyond inventory or for an unknown product", async (t) => {
    if (skipIfDatabaseUnavailable(t, hasTestDatabase)) {
      return;
    }

    const user = await createCartUser("cart-user@example.test");
    const { product } = await createTestProduct({
      price: "10.00",
      inventoryCount: 1,
    });
    const token = signToken(user);

    const overInventoryResponse = await addCartItem(token, {
      productId: product.id,
      quantity: 2,
    });

    assert.equal(overInventoryResponse.status, 400);
    assert.deepEqual(await overInventoryResponse.json(), {
      error: "Requested quantity exceeds available inventory",
    });

    const unknownProductResponse = await addCartItem(token, {
      productId: 999_999_999,
      quantity: 1,
    });

    assert.equal(unknownProductResponse.status, 404);
    assert.deepEqual(await unknownProductResponse.json(), { error: "Product not found" });
  });

  it("rejects adding an out-of-stock product", async (t) => {
    if (skipIfDatabaseUnavailable(t, hasTestDatabase)) {
      return;
    }

    const user = await createCartUser("cart-user@example.test");
    const { product } = await createTestProduct({
      price: "10.00",
      inventoryCount: 0,
    });

    const response = await addCartItem(signToken(user), {
      productId: product.id,
      quantity: 1,
    });

    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { error: "Product is out of stock" });
  });

  it("updates quantities for owned items and rejects quantities beyond inventory", async (t) => {
    if (skipIfDatabaseUnavailable(t, hasTestDatabase)) {
      return;
    }

    const user = await createCartUser("cart-user@example.test");
    const { product } = await createTestProduct({
      price: "7.25",
      inventoryCount: 3,
    });
    const token = signToken(user);
    const addResponse = await addCartItem(token, {
      productId: product.id,
      quantity: 1,
    });
    const cart = await addResponse.json() as CartResponse;
    const itemId = cart.items[0]!.id;

    const overInventoryResponse = await updateCartItem(token, itemId, { quantity: 4 });

    assert.equal(overInventoryResponse.status, 400);
    assert.deepEqual(await overInventoryResponse.json(), {
      error: "Requested quantity exceeds available inventory",
    });

    const response = await updateCartItem(token, itemId, { quantity: 3 });

    assert.equal(response.status, 200);

    const body = await response.json() as CartResponse;
    assert.equal(body.items[0]!.quantity, 3);
    assert.equal(body.items[0]!.lineTotal, "21.75");
    assert.equal(body.subtotal, "21.75");
  });

  it("does not update or delete another user's cart item", async (t) => {
    if (skipIfDatabaseUnavailable(t, hasTestDatabase)) {
      return;
    }

    const user = await createCartUser("cart-user@example.test");
    const otherUser = await createCartUser("cart-other-user@example.test");
    const { product } = await createTestProduct({
      price: "9.99",
      inventoryCount: 5,
    });
    const otherToken = signToken(otherUser);
    const otherCartResponse = await addCartItem(otherToken, {
      productId: product.id,
      quantity: 2,
    });
    const otherCart = await otherCartResponse.json() as CartResponse;
    const otherItemId = otherCart.items[0]!.id;
    const token = signToken(user);

    const updateResponse = await updateCartItem(token, otherItemId, { quantity: 1 });
    const deleteResponse = await deleteCartItem(token, otherItemId);

    assert.equal(updateResponse.status, 404);
    assert.deepEqual(await updateResponse.json(), { error: "Cart item not found" });
    assert.equal(deleteResponse.status, 404);
    assert.deepEqual(await deleteResponse.json(), { error: "Cart item not found" });

    const otherCartAfter = await (await getCart(otherToken)).json() as CartResponse;
    assert.equal(otherCartAfter.items.length, 1);
    assert.equal(otherCartAfter.items[0]!.quantity, 2);
  });

  it("deletes an owned cart item", async (t) => {
    if (skipIfDatabaseUnavailable(t, hasTestDatabase)) {
      return;
    }

    const user = await createCartUser("cart-user@example.test");
    const { product } = await createTestProduct({
      price: "9.99",
      inventoryCount: 5,
    });
    const token = signToken(user);
    const addResponse = await addCartItem(token, {
      productId: product.id,
      quantity: 2,
    });
    const cart = await addResponse.json() as CartResponse;
    const itemId = cart.items[0]!.id;

    const response = await deleteCartItem(token, itemId);

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      items: [],
      subtotal: "0",
    });
  });

  it("rejects invalid item params and request bodies", async (t) => {
    if (skipIfDatabaseUnavailable(t, hasTestDatabase)) {
      return;
    }

    const user = await createCartUser("cart-user@example.test");
    const token = signToken(user);

    const invalidAddResponse = await addCartItem(token, {
      productId: 1,
      quantity: 0,
    });
    const invalidPatchBodyResponse = await updateCartItem(token, 1, { quantity: 1.5 });
    const invalidPatchParamResponse = await requestApp({
      method: "PATCH",
      path: "/api/cart/items/not-a-number",
      headers: authHeader(token),
      body: { quantity: 1 },
    });

    assert.equal(invalidAddResponse.status, 400);
    assert.deepEqual(await invalidAddResponse.json(), { error: "Quantity must be a positive integer" });
    assert.equal(invalidPatchBodyResponse.status, 400);
    assert.deepEqual(await invalidPatchBodyResponse.json(), { error: "Quantity must be a positive integer" });
    assert.equal(invalidPatchParamResponse.status, 400);
    assert.deepEqual(await invalidPatchParamResponse.json(), {
      error: "Cart item id must be a positive integer",
    });
  });
});

function signToken(user: { id: number; email: string; role: UserRole }) {
  return jwt.sign(
    {
      userId: user.id,
      email: user.email,
      role: user.role,
    },
    TEST_JWT_SECRET,
    { expiresIn: "7d" },
  );
}

async function createCartUser(email: string) {
  return createTestUser({
    name: "Cart User",
    email,
    password: TEST_PASSWORD,
  });
}

async function createTestProduct(input: { price: string; inventoryCount: number }) {
  const category = await prisma!.category.upsert({
    where: { slug: TEST_CATEGORY_SLUG },
    update: {},
    create: {
      name: "API Cart Category",
      slug: TEST_CATEGORY_SLUG,
    },
  });
  const product = await prisma!.product.create({
    data: {
      name: "API Cart Product",
      description: "Product used by the cart API tests",
      price: input.price,
      imageUrl: "https://example.test/cart-product.png",
      inventoryCount: input.inventoryCount,
      categoryId: category.id,
    },
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
  });

  return { category, product };
}

async function getCart(token: string) {
  return requestApp({
    method: "GET",
    path: "/api/cart",
    headers: authHeader(token),
  });
}

async function addCartItem(token: string, body: { productId: number; quantity: number }) {
  return requestApp({
    method: "POST",
    path: "/api/cart/items",
    headers: authHeader(token),
    body,
  });
}

async function updateCartItem(token: string, id: number, body: { quantity: number }) {
  return requestApp({
    method: "PATCH",
    path: `/api/cart/items/${id}`,
    headers: authHeader(token),
    body,
  });
}

async function deleteCartItem(token: string, id: number) {
  return requestApp({
    method: "DELETE",
    path: `/api/cart/items/${id}`,
    headers: authHeader(token),
  });
}

function authHeader(token: string) {
  return {
    authorization: `Bearer ${token}`,
  };
}

async function deleteTestCartData() {
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

type CartResponse = {
  items: Array<{
    id: number;
    productId: number;
    quantity: number;
    lineTotal: string;
    product: {
      id: number;
      name: string;
      price: string;
      imageUrl: string;
      inventoryCount: number;
      category: {
        id: number;
        name: string;
        slug: string;
      };
    };
  }>;
  subtotal: string;
};
