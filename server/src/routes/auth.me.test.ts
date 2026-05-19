import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it, type TestContext } from "node:test";
import { createServer, request, type Server } from "node:http";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { app } from "../app.js";
import { UserRole } from "../generated/enums.js";
import { prisma } from "../lib/prisma.js";

const TEST_JWT_SECRET = "me-test-secret";
const TEST_PASSWORD = "password123";
const TEST_USER_EMAILS = [
  "me@example.test",
  "deleted-me@example.test",
];
const DATABASE_TIMEOUT_MS = 5_000;
const REQUEST_TIMEOUT_MS = 5_000;

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

    await deleteTestUsers();
    process.env.JWT_SECRET = TEST_JWT_SECRET;
  });

  after(async () => {
    if (hasTestDatabase && prisma) {
      await deleteTestUsers();
      await prisma.$disconnect();
    }
  });

  it("returns the current user for a valid bearer token", async (t) => {
    if (skipIfDatabaseUnavailable(t)) {
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
    if (skipIfDatabaseUnavailable(t)) {
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

function signToken(payload: { userId: number; email: string; role: UserRole }) {
  return jwt.sign(payload, TEST_JWT_SECRET, { expiresIn: "7d" });
}

async function getMe(headers: RequestHeaders = {}) {
  return requestApp("GET", "/api/auth/me", headers);
}

async function requestApp(method: string, path: string, headers: RequestHeaders) {
  const server = createServer(app);

  try {
    await listen(server);
    const address = server.address();

    if (!address || typeof address === "string") {
      throw new Error("Failed to bind test server to a local port");
    }

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
            ...headers,
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

      req.end();
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

type TestResponse = {
  status: number;
  json: () => unknown;
};
