import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it, type TestContext } from "node:test";
import { createServer, request, type Server } from "node:http";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { app } from "../app.js";
import { prisma } from "../lib/prisma.js";
import { UserRole } from "../generated/enums.js";

const TEST_JWT_SECRET = "register-test-secret";
const TEST_USER_EMAILS = [
  "register@example.test",
  "duplicate@example.test",
  "normalized@example.test",
];
const DATABASE_TIMEOUT_MS = 5_000;
const REQUEST_TIMEOUT_MS = 5_000;

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

    await deleteTestUsers();
    process.env.JWT_SECRET = TEST_JWT_SECRET;
  });

  after(async () => {
    if (hasTestDatabase && prisma) {
      await deleteTestUsers();
      await prisma.$disconnect();
    }
  });

  it("creates a user, hashes the password, and returns a JWT plus safe user payload", async (t) => {
    if (skipIfDatabaseUnavailable(t)) {
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
    if (skipIfDatabaseUnavailable(t)) {
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
    if (skipIfDatabaseUnavailable(t)) {
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
    if (skipIfDatabaseUnavailable(t)) {
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
    if (skipIfDatabaseUnavailable(t)) {
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
    if (skipIfDatabaseUnavailable(t)) {
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
    if (skipIfDatabaseUnavailable(t)) {
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
  return requestApp("POST", "/api/auth/register", body);
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

type TestResponse = {
  status: number;
  json: () => unknown;
};
