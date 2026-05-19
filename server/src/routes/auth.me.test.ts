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

const TEST_JWT_SECRET = "me-test-secret";
const TEST_PASSWORD = "password123";
const TEST_USER_EMAILS = [
  "me@example.test",
  "deleted-me@example.test",
];

let hasTestDatabase = false;

describe("GET /api/auth/me", () => {
  before(async () => {
    process.env.JWT_SECRET = TEST_JWT_SECRET;
    hasTestDatabase = await canUseDatabase();
  });

  beforeEach(async () => {
    if (!hasTestDatabase) {
      return;
    }

    await deleteTestUsers(TEST_USER_EMAILS);
    process.env.JWT_SECRET = TEST_JWT_SECRET;
  });

  after(async () => {
    if (hasTestDatabase) {
      await deleteTestUsers(TEST_USER_EMAILS);
      await disconnectTestDatabase(hasTestDatabase);
    }
  });

  it("returns the current user for a valid bearer token", async (t) => {
    if (skipIfDatabaseUnavailable(t, hasTestDatabase)) {
      return;
    }

    const user = await createTestUser({
      name: "Me User",
      email: "me@example.test",
      password: TEST_PASSWORD,
    });

    const token = signToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    const response = await getMe({ authorization: `Bearer ${token}` });

    assert.equal(response.status, 200);

    const body = await response.json() as MeResponse;
    assert.equal(body.user.id, user.id);
    assert.equal(body.user.name, "Me User");
    assert.equal(body.user.email, "me@example.test");
    assert.equal(body.user.role, UserRole.USER);
    assert.equal("passwordHash" in body.user, false);
  });

  it("rejects a missing authorization header", async () => {
    const response = await getMe();

    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), { error: "Authentication required" });
  });

  it("rejects a malformed bearer header", async () => {
    const response = await getMe({ authorization: "Token not-a-bearer-token" });

    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), { error: "Authentication required" });
  });

  it("rejects an empty bearer token", async () => {
    const response = await getMe({ authorization: "Bearer   " });

    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), { error: "Authentication required" });
  });

  it("rejects an invalid token", async () => {
    const response = await getMe({ authorization: "Bearer invalid-token" });

    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), { error: "Invalid authentication token" });
  });

  it("rejects a validly signed token with an invalid payload shape", async () => {
    const token = jwt.sign(
      {
        userId: "1",
        email: "me@example.test",
        role: UserRole.USER,
      },
      TEST_JWT_SECRET,
    );

    const response = await getMe({ authorization: `Bearer ${token}` });

    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), { error: "Invalid authentication token" });
  });

  it("rejects a valid token for a deleted user", async (t) => {
    if (skipIfDatabaseUnavailable(t, hasTestDatabase)) {
      return;
    }

    const user = await createTestUser({
      name: "Deleted Me User",
      email: "deleted-me@example.test",
      password: TEST_PASSWORD,
    });
    const token = signToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    await prisma!.user.delete({ where: { id: user.id } });

    const response = await getMe({ authorization: `Bearer ${token}` });

    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), { error: "Invalid authentication token" });
  });

  it("requires JWT_SECRET", async () => {
    delete process.env.JWT_SECRET;

    const response = await getMe({ authorization: "Bearer any-token" });

    assert.equal(response.status, 500);
    assert.deepEqual(await response.json(), { error: "JWT secret is not configured" });
  });
});

function signToken(payload: { userId: number; email: string; role: UserRole }) {
  return jwt.sign(payload, TEST_JWT_SECRET, { expiresIn: "7d" });
}

async function getMe(headers: RequestHeaders = {}) {
  return requestApp({
    method: "GET",
    path: "/api/auth/me",
    headers,
  });
}

type RequestHeaders = {
  authorization?: string;
};

type MeResponse = {
  user: {
    id: number;
    name: string;
    email: string;
    role: UserRole;
    createdAt: string;
  };
};
