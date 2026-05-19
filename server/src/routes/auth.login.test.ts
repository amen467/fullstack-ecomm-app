import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it, type TestContext } from "node:test";
import { createServer, request, type Server } from "node:http";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { app } from "../app.js";
import { UserRole } from "../generated/enums.js";
import { prisma } from "../lib/prisma.js";

const TEST_JWT_SECRET = "login-test-secret";
const TEST_PASSWORD = "password123";
const TEST_USER_EMAILS = [
  "login@example.test",
  "normalized-login@example.test",
];
const DATABASE_TIMEOUT_MS = 5_000;
const REQUEST_TIMEOUT_MS = 5_000;

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

    await deleteTestUsers();
    process.env.JWT_SECRET = TEST_JWT_SECRET;
  });

  after(async () => {
    if (hasTestDatabase && prisma) {
      await deleteTestUsers();
      await prisma.$disconnect();
    }
  });

  it("logs in with valid credentials and returns a JWT plus safe user payload", async (t) => {
    if (skipIfDatabaseUnavailable(t)) {
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
    if (skipIfDatabaseUnavailable(t)) {
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
    if (skipIfDatabaseUnavailable(t)) {
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
    if (skipIfDatabaseUnavailable(t)) {
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
    if (skipIfDatabaseUnavailable(t)) {
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
    if (skipIfDatabaseUnavailable(t)) {
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
    if (skipIfDatabaseUnavailable(t)) {
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

async function createTestUser(input: CreateTestUserInput) {
  const passwordHash = await bcrypt.hash(input.password, 10);

  return prisma!.user.create({
    data: {
      name: input.name,
      email: input.email,
      passwordHash,
      role: UserRole.USER,
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
    },
  });
}

async function postLogin(body: LoginRequest) {
  return requestApp("POST", "/api/auth/login", body);
}

async function requestApp(method: string, path: string, body: unknown) {
  const server = createServer(app);

  try {
    await listen(server);
    const address = server.address();

    if (!address || typeof address === "string") {
      throw new Error("Failed to bind test server to a local port");
    }

    const bodyText = JSON.stringify(body);

    return await new Promise<TestResponse>((resolve, reject) => {
      const timeout = setTimeout(() => {
        req.destroy(new Error(`Request timed out after ${REQUEST_TIMEOUT_MS}ms`));
      }, REQUEST_TIMEOUT_MS);

      const req = request(
        {
          host: "127.0.0.1",
          port: address.port,
          path,
          method,
          headers: {
            "connection": "close",
            "content-type": "application/json",
            "content-length": Buffer.byteLength(bodyText),
          },
        },
        (res) => {
          const chunks: Buffer[] = [];

          res.on("data", (chunk: Buffer) => {
            chunks.push(chunk);
          });

          res.on("end", () => {
            clearTimeout(timeout);
            resolve({
              status: res.statusCode ?? 0,
              json: () => JSON.parse(Buffer.concat(chunks).toString("utf8")),
            });
          });
        },
      );

      req.on("error", (error) => {
        clearTimeout(timeout);
        reject(error);
      });

      req.end(bodyText);
    });
  } finally {
    server.closeAllConnections();
    await close(server);
  }
}

function listen(server: Server) {
  return new Promise<void>((resolve, reject) => {
    server.listen(0, "127.0.0.1", resolve);
    server.on("error", reject);
  });
}

function close(server: Server) {
  return new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

function skipIfDatabaseUnavailable(t: TestContext) {
  if (!hasTestDatabase) {
    t.skip("DATABASE_URL is not configured or the test database is unavailable");
    return true;
  }

  return false;
}

async function canUseDatabase() {
  if (!process.env.DATABASE_URL || !prisma) {
    return false;
  }

  try {
    await withTimeout(prisma.$queryRaw`SELECT 1`, DATABASE_TIMEOUT_MS);
    return true;
  } catch {
    return false;
  }
}

async function deleteTestUsers() {
  await prisma?.user.deleteMany({
    where: {
      email: { in: TEST_USER_EMAILS },
    },
  });
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number) {
  return Promise.race([
    promise,
    new Promise<never>((_resolve, reject) => {
      setTimeout(() => reject(new Error("Operation timed out")), timeoutMs);
    }),
  ]);
}

type CreateTestUserInput = {
  name: string;
  email: string;
  password: string;
};

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

type TestResponse = {
  status: number;
  json: () => unknown;
};
