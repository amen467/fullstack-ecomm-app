import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import { prisma } from "../lib/prisma.js";
import {
  canUseDatabase,
  disconnectTestDatabase,
  requestApp,
  skipIfDatabaseUnavailable,
} from "../test/authTestHelpers.js";

const TEST_CATEGORY_SLUG = "api-detail-category";

let hasTestDatabase = false;

describe("GET /api/products/:id", () => {
  before(async () => {
    hasTestDatabase = await canUseDatabase();
  });

  beforeEach(async () => {
    if (!hasTestDatabase) {
      return;
    }

    await deleteTestCatalogData();
  });

  after(async () => {
    if (hasTestDatabase) {
      await deleteTestCatalogData();
      await disconnectTestDatabase(hasTestDatabase);
    }
  });

  it("returns a product from Prisma with category data and a serialized price", async (t) => {
    if (skipIfDatabaseUnavailable(t, hasTestDatabase)) {
      return;
    }

    const category = await prisma!.category.create({
      data: {
        name: "API Detail Category",
        slug: TEST_CATEGORY_SLUG,
      },
    });
    const product = await prisma!.product.create({
      data: {
        name: "API Detail Product",
        description: "Product returned by the detail endpoint",
        price: "42.50",
        imageUrl: "https://example.test/detail-product.png",
        inventoryCount: 11,
        categoryId: category.id,
      },
    });

    const response = await getProduct(product.id);

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      product: {
        id: product.id,
        name: "API Detail Product",
        description: "Product returned by the detail endpoint",
        price: "42.5",
        imageUrl: "https://example.test/detail-product.png",
        inventoryCount: 11,
        createdAt: product.createdAt.toISOString(),
        category: {
          id: category.id,
          name: "API Detail Category",
          slug: TEST_CATEGORY_SLUG,
        },
      },
    });
  });

  it("returns not found for an unknown product id", async (t) => {
    if (skipIfDatabaseUnavailable(t, hasTestDatabase)) {
      return;
    }

    const response = await getProduct(999_999_999);

    assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), { error: "Product not found" });
  });

  it("rejects invalid product ids", async () => {
    const invalidIds = [
      "not-a-number",
      "0",
      "-1",
      "1.5",
    ];

    for (const invalidId of invalidIds) {
      const response = await requestApp({
        method: "GET",
        path: `/api/products/${invalidId}`,
      });

      assert.equal(response.status, 400);
      assert.deepEqual(await response.json(), { error: "Product id must be a positive integer" });
    }
  });
});

async function getProduct(id: number) {
  return requestApp({
    method: "GET",
    path: `/api/products/${id}`,
  });
}

async function deleteTestCatalogData() {
  const testCategory = await prisma!.category.findUnique({
    where: { slug: TEST_CATEGORY_SLUG },
    select: { id: true },
  });

  if (!testCategory) {
    return;
  }

  await prisma!.product.deleteMany({
    where: { categoryId: testCategory.id },
  });
  await prisma!.category.delete({
    where: { id: testCategory.id },
  });
}
