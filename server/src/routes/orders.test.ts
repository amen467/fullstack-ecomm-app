import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import jwt from "jsonwebtoken";
import { UserRole } from "../generated/enums.js";
import { requestApp } from "../test/authTestHelpers.js";

const TEST_JWT_SECRET = "orders-test-secret";

describe("orders API route guards", () => {
  beforeEach(() => {
    process.env.JWT_SECRET = TEST_JWT_SECRET;
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

  it("keeps authenticated order endpoints as not implemented stubs", async () => {
    const token = signToken();
    const requests = [
      requestApp({
        method: "POST",
        path: "/api/orders",
        headers: authHeader(token),
        body: validCreateOrderBody(),
      }),
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

function signToken() {
  return jwt.sign(
    {
      userId: 1,
      email: "orders-user@example.test",
      role: UserRole.USER,
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
