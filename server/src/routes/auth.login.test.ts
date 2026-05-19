import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import jwt from "jsonwebtoken";
import { UserRole } from "../generated/enums.js";
import {
  canUseDatabase,
  createTestUser,
  deleteTestUsers,
  disconnectTestDatabase,
  requestApp,
  skipIfDatabaseUnavailable,
} from "../test/authTestHelpers.js";

const TEST_JWT_SECRET = "login-test-secret";
const TEST_PASSWORD = "password123";
const TEST_USER_EMAILS = [
  "login@example.test",
  "normalized-login@example.test",
];

let hasTestDatabase = false;

describe("POST /api/auth/login", () => {
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

  it("logs in with valid credentials and returns a JWT plus safe user payload", async (t) => {
    if (skipIfDatabaseUnavailable(t, hasTestDatabase)) {
      return;
    }

    const user = await createTestUser({
      name: "Login User",
      email: "login@example.test",
      password: TEST_PASSWORD,
    });

    const response = await postLogin({
      email: "login@example.test",
      password: TEST_PASSWORD,
    });

    assert.equal(response.status, 200);

    const body = await response.json() as LoginResponse;
    assert.equal(typeof body.token, "string");
    assert.equal(body.user.id, user.id);
    assert.equal(body.user.name, "Login User");
    assert.equal(body.user.email, "login@example.test");
    assert.equal(body.user.role, UserRole.USER);
    assert.equal("passwordHash" in body.user, false);

    const decoded = jwt.verify(body.token, TEST_JWT_SECRET);
    assert.ok(typeof decoded === "object" && decoded !== null);
    assert.equal(decoded.userId, user.id);
    assert.equal(decoded.email, "login@example.test");
    assert.equal(decoded.role, UserRole.USER);
  });

  it("normalizes email before credential lookup", async (t) => {
    if (skipIfDatabaseUnavailable(t, hasTestDatabase)) {
      return;
    }

    await createTestUser({
      name: "Normalized Login User",
      email: "normalized-login@example.test",
      password: TEST_PASSWORD,
    });

    const response = await postLogin({
      email: "  Normalized-Login@Example.Test  ",
      password: TEST_PASSWORD,
    });

    assert.equal(response.status, 200);

    const body = await response.json() as LoginResponse;
    assert.equal(body.user.email, "normalized-login@example.test");
  });

  it("rejects an unknown email with a generic credential error", async (t) => {
    if (skipIfDatabaseUnavailable(t, hasTestDatabase)) {
      return;
    }

    const response = await postLogin({
      email: "login@example.test",
      password: TEST_PASSWORD,
    });

    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), { error: "Invalid email or password" });
  });

  it("rejects an incorrect password with a generic credential error", async (t) => {
    if (skipIfDatabaseUnavailable(t, hasTestDatabase)) {
      return;
    }

    await createTestUser({
      name: "Login User",
      email: "login@example.test",
      password: TEST_PASSWORD,
    });

    const response = await postLogin({
      email: "login@example.test",
      password: "wrong-password",
    });

    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), { error: "Invalid email or password" });
  });

  it("rejects an invalid email", async (t) => {
    if (skipIfDatabaseUnavailable(t, hasTestDatabase)) {
      return;
    }

    const response = await postLogin({
      email: "not-an-email",
      password: TEST_PASSWORD,
    });

    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { error: "Valid email is required" });
  });

  it("rejects a missing password", async (t) => {
    if (skipIfDatabaseUnavailable(t, hasTestDatabase)) {
      return;
    }

    const response = await postLogin({
      email: "login@example.test",
      password: "",
    });

    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { error: "Password is required" });
  });

  it("requires JWT_SECRET", async (t) => {
    if (skipIfDatabaseUnavailable(t, hasTestDatabase)) {
      return;
    }

    delete process.env.JWT_SECRET;

    const response = await postLogin({
      email: "login@example.test",
      password: TEST_PASSWORD,
    });

    assert.equal(response.status, 500);
    assert.deepEqual(await response.json(), { error: "JWT secret is not configured" });
  });
});

async function postLogin(body: LoginRequest) {
  return requestApp({
    method: "POST",
    path: "/api/auth/login",
    body,
  });
}

type LoginRequest = {
  email: string;
  password: string;
};

type LoginResponse = {
  token: string;
  user: {
    id: number;
    name: string;
    email: string;
    role: UserRole;
    createdAt: string;
  };
};
