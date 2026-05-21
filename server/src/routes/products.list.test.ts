import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import { prisma } from "../lib/prisma.js";
import {
  canUseDatabase,
  disconnectTestDatabase,
  requestApp,
  skipIfDatabaseUnavailable,
} from "../test/authTestHelpers.js";

const TEST_CATEGORY_SLUGS = [
  "api-list-category-a",
  "api-list-category-b",
];

let hasTestDatabase = false;

describe("GET /api/products", () => {
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

  it("returns products from Prisma with category data and serialized prices", async (t) => {
    if (skipIfDatabaseUnavailable(t, hasTestDatabase)) {
      return;
    }

    const categoryA = await prisma!.category.create({
      data: {
        name: "API List Category A",
        slug: TEST_CATEGORY_SLUGS[0]!,
      },
    });
    const categoryB = await prisma!.category.create({
      data: {
        name: "API List Category B",
        slug: TEST_CATEGORY_SLUGS[1]!,
      },
    });
    const firstProduct = await prisma!.product.create({
      data: {
        name: "API List First Product",
        description: "First product returned by the list endpoint",
        price: "12.34",
        imageUrl: "https://example.test/first-product.png",
        inventoryCount: 7,
        categoryId: categoryA.id,
      },
    });
    const secondProduct = await prisma!.product.create({
      data: {
        name: "API List Second Product",
        description: "Second product returned by the list endpoint",
        price: "56.78",
        imageUrl: "https://example.test/second-product.png",
        inventoryCount: 3,
        categoryId: categoryB.id,
      },
    });

    const response = await getProducts();

    assert.equal(response.status, 200);

    const body = await response.json() as ProductListResponse;
    const returnedProducts = body.products.filter((product) =>
      product.id === firstProduct.id || product.id === secondProduct.id
    );

    assert.equal(returnedProducts.length, 2);
    assert.equal(returnedProducts[0]!.id, firstProduct.id);
    assert.equal(returnedProducts[1]!.id, secondProduct.id);
    assert.deepEqual(returnedProducts[0], {
      id: firstProduct.id,
      name: "API List First Product",
      description: "First product returned by the list endpoint",
      price: "12.34",
      imageUrl: "https://example.test/first-product.png",
      inventoryCount: 7,
      createdAt: firstProduct.createdAt.toISOString(),
      category: {
        id: categoryA.id,
        name: "API List Category A",
        slug: "api-list-category-a",
      },
    });
    assert.deepEqual(returnedProducts[1], {
      id: secondProduct.id,
      name: "API List Second Product",
      description: "Second product returned by the list endpoint",
      price: "56.78",
      imageUrl: "https://example.test/second-product.png",
      inventoryCount: 3,
      createdAt: secondProduct.createdAt.toISOString(),
      category: {
        id: categoryB.id,
        name: "API List Category B",
        slug: "api-list-category-b",
      },
    });
  });

  it("returns an empty list when the catalog has no products", async (t) => {
    if (skipIfDatabaseUnavailable(t, hasTestDatabase)) {
      return;
    }

    const existingProductCount = await prisma!.product.count();

    if (existingProductCount > 0) {
      t.skip("database already has non-test products");
      return;
    }

    const response = await getProducts();

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { products: [] });
  });
});

async function getProducts() {
  return requestApp({
    method: "GET",
    path: "/api/products",
  });
}

async function deleteTestCatalogData() {
  const testCategories = await prisma!.category.findMany({
    where: {
      slug: { in: TEST_CATEGORY_SLUGS },
    },
    select: { id: true },
  });

  if (testCategories.length === 0) {
    return;
  }

  await prisma!.product.deleteMany({
    where: {
      categoryId: { in: testCategories.map((category) => category.id) },
    },
  });
  await prisma!.category.deleteMany({
    where: {
      id: { in: testCategories.map((category) => category.id) },
    },
  });
}

type ProductListResponse = {
  products: Array<{
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
  }>;
};
