import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import jwt from "jsonwebtoken";
import { UserRole } from "../generated/enums.js";
import { requestApp } from "../test/authTestHelpers.js";

const TEST_JWT_SECRET = "products-admin-test-secret";

describe("admin product API route guards", () => {
  before(() => {
    process.env.JWT_SECRET = TEST_JWT_SECRET;
  });

  beforeEach(() => {
    process.env.JWT_SECRET = TEST_JWT_SECRET;
  });

  after(() => {
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

  it("allows admin users through to the existing product write stubs", async () => {
    const token = signToken(UserRole.ADMIN);

    for (const request of productWriteRequests(authHeader(token))) {
      const response = await requestApp(request);

      assert.equal(response.status, 501);
      assert.deepEqual(await response.json(), { error: "Not implemented" });
    }
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
