import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma.js";
import { UserRole } from "../generated/enums.js";
import {
  canUseDatabase,
  deleteTestUsers,
  disconnectTestDatabase,
  requestApp,
  skipIfDatabaseUnavailable,
} from "../test/authTestHelpers.js";

const TEST_JWT_SECRET = "register-test-secret";
const TEST_USER_EMAILS = [
  "register@example.test",
  "duplicate@example.test",
  "normalized@example.test",
];

let hasTestDatabase = false;

describe("POST /api/auth/register", () => {
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

  it("creates a user, hashes the password, and returns a JWT plus safe user payload", async (t) => {
    if (skipIfDatabaseUnavailable(t, hasTestDatabase)) {
      return;
    }

    const response = await postRegister({
      name: "Register User",
      email: "register@example.test",
      password: "password123",
    });

    assert.equal(response.status, 201);

    const body = await response.json() as RegisterResponse;
    assert.equal(typeof body.token, "string");
    assert.equal(body.user.name, "Register User");
    assert.equal(body.user.email, "register@example.test");
    assert.equal(body.user.role, UserRole.USER);
    assert.equal("passwordHash" in body.user, false);

    const decoded = jwt.verify(body.token, TEST_JWT_SECRET);
    assert.ok(typeof decoded === "object" && decoded !== null);
    assert.equal(decoded.userId, body.user.id);
    assert.equal(decoded.email, body.user.email);
    assert.equal(decoded.role, UserRole.USER);

    const storedUser = await prisma?.user.findUniqueOrThrow({
      where: { email: "register@example.test" },
      select: { name: true, email: true, passwordHash: true, role: true },
    });

    assert.equal(storedUser?.name, "Register User");
    assert.equal(storedUser?.email, "register@example.test");
    assert.equal(storedUser?.role, UserRole.USER);
    assert.notEqual(storedUser?.passwordHash, "password123");
    assert.equal(await bcrypt.compare("password123", storedUser?.passwordHash ?? ""), true);
  });

  it("trims name and normalizes email before storing the user", async (t) => {
    if (skipIfDatabaseUnavailable(t, hasTestDatabase)) {
      return;
    }

    const response = await postRegister({
      name: "  Normalized User  ",
      email: "  Normalized@Example.Test  ",
      password: "password123",
    });

    assert.equal(response.status, 201);

    const body = await response.json() as RegisterResponse;
    assert.equal(body.user.name, "Normalized User");
    assert.equal(body.user.email, "normalized@example.test");

    const storedUser = await prisma?.user.findUnique({
      where: { email: "normalized@example.test" },
      select: { name: true, email: true },
    });

    assert.deepEqual(storedUser, {
      name: "Normalized User",
      email: "normalized@example.test",
    });
  });

  it("rejects duplicate email registrations", async (t) => {
    if (skipIfDatabaseUnavailable(t, hasTestDatabase)) {
      return;
    }

    await postRegister({
      name: "Duplicate User",
      email: "duplicate@example.test",
      password: "password123",
    });

    const response = await postRegister({
      name: "Duplicate User Two",
      email: "DUPLICATE@example.test",
      password: "password123",
    });

    assert.equal(response.status, 409);
    assert.deepEqual(await response.json(), { error: "Email is already registered" });
  });

  it("rejects a missing or blank name", async (t) => {
    if (skipIfDatabaseUnavailable(t, hasTestDatabase)) {
      return;
    }

    const response = await postRegister({
      name: "   ",
      email: "register@example.test",
      password: "password123",
    });

    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { error: "Name is required" });
  });

  it("rejects an invalid email", async (t) => {
    if (skipIfDatabaseUnavailable(t, hasTestDatabase)) {
      return;
    }

    const response = await postRegister({
      name: "Register User",
      email: "not-an-email",
      password: "password123",
    });

    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { error: "Valid email is required" });
  });

  it("rejects a short password", async (t) => {
    if (skipIfDatabaseUnavailable(t, hasTestDatabase)) {
      return;
    }

    const response = await postRegister({
      name: "Register User",
      email: "register@example.test",
      password: "short",
    });

    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { error: "Password must be at least 8 characters" });
  });

  it("requires JWT_SECRET", async (t) => {
    if (skipIfDatabaseUnavailable(t, hasTestDatabase)) {
      return;
    }

    delete process.env.JWT_SECRET;

    const response = await postRegister({
      name: "Register User",
      email: "register@example.test",
      password: "password123",
    });

    assert.equal(response.status, 500);
    assert.deepEqual(await response.json(), { error: "JWT secret is not configured" });
  });
});

async function postRegister(body: RegisterRequest) {
  return requestApp({
    method: "POST",
    path: "/api/auth/register",
    body,
  });
}

type RegisterRequest = {
  name: string;
  email: string;
  password: string;
};

type RegisterResponse = {
  token: string;
  user: {
    id: number;
    name: string;
    email: string;
    role: UserRole;
    createdAt: string;
  };
};
